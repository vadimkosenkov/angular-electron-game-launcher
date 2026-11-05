import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Whether an address the launcher is about to request is out on the public
 * internet, or points back at this machine and the network around it.
 *
 * The link check never takes a URL from a caller, which was supposed to be
 * the end of the question. It is not: a catalog host answers with a
 * `Location` header, and that header is a URL chosen by somebody else. A site
 * that redirected to `http://127.0.0.1:9200/` would have the launcher probe
 * whatever is listening there and report the result in its own interface --
 * a port scanner with a button, driven from outside. Browsers have their own
 * private-network rules for this; Node has none.
 *
 * So every address is checked before it is requested: the first one as well
 * as each redirect, because a catalog hostname could equally resolve
 * somewhere local.
 */

/** Returns why this address must not be requested, or null if it may be. */
export async function describeNonPublicTarget(url: URL): Promise<string | null> {
  const host = url.hostname;

  // `localhost` is a name, not an address, and resolving it is not required
  // to produce a loopback answer -- but it is the obvious spelling and it
  // costs nothing to refuse by name as well as by address.
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return 'points at localhost';
  }

  const literal = stripBrackets(host);
  if (isIP(literal) !== 0) {
    return isPublicAddress(literal) ? null : 'is not a public address';
  }

  let addresses: readonly { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    // A name that does not resolve cannot be requested anyway, and the
    // request about to be made will say so in its own words.
    return null;
  }

  // Every answer has to be public, not just the first: a name that resolves
  // to one public address and one loopback address is the same attack with
  // an extra step.
  return addresses.every((entry) => isPublicAddress(entry.address))
    ? null
    : 'resolves to an address that is not public';
}

/**
 * What this does not do is pin the connection to the address it checked.
 * Between this lookup and the one `fetch` makes, a name under someone else's
 * control can answer differently -- DNS rebinding. Closing that would mean
 * dialling a literal address and carrying the original name in the `Host`
 * header and the TLS handshake, which is a custom dispatcher's worth of
 * machinery for a launcher that checks sixteen links on a button press. The
 * redirect itself, which is the part an outside server actually controls, is
 * covered.
 */
function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isPublicIPv4(address);
  }
  if (version === 6) {
    return isPublicIPv6(address.toLowerCase());
  }
  return false;
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];

  return !(
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, and the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0) || // IETF protocol assignments, incl. 192.0.0.0/24
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved, up to 255.255.255.255
  );
}

/**
 * Compared as numbers, and allowed by one positive rule rather than refused
 * by a list.
 *
 * Two mistakes to avoid here, and the first version made both. An IPv6
 * address has many spellings of the same value -- `::ffff:127.0.0.1` is
 * handed back by `new URL()` as `::ffff:7f00:1` -- so matching on the written
 * form is a check the next normalisation walks straight past. And naming the
 * ranges to refuse means the check is only as good as the list is complete:
 * that version named unique-local and link-local, and let the deprecated
 * site-local `fec0::/10` and the whole of multicast `ff00::/8` through.
 *
 * So the question is turned around. Exactly one block, `2000::/3`, is
 * assigned as global unicast; everything else -- the unassigned blocks,
 * `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8`, `64:ff9b::/96` and the
 * rest -- fails by not being in it, including the ranges nobody has thought
 * of yet. A list that has to stay complete to be correct is the wrong shape
 * for this.
 */
function isPublicIPv6(address: string): boolean {
  const groups = expandIPv6(address);
  if (groups === null) {
    return false;
  }

  // An IPv4 address wearing an IPv6 coat, in either of the two forms:
  // `::ffff:7f00:1` (mapped) and the deprecated `::7f00:1` (compatible).
  // Both reach `127.0.0.1` exactly as `127.0.0.1` does, so both are answered
  // by the IPv4 rules -- which also disposes of `::` and `::1`, since
  // `0.0.0.0` and `0.0.0.1` are not public either.
  const prefix = groups.slice(0, 5);
  if (prefix.every((group) => group === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    return isPublicIPv4(toIPv4(groups[6]!, groups[7]!));
  }

  if ((groups[0]! & 0xe000) !== 0x2000) {
    return false;
  }

  // Two blocks inside global unicast still do not reach anybody's internet.
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) {
    return false; // reserved for documentation
  }
  if (groups[0] === 0x2002) {
    // 6to4 carries an IPv4 address in the next two groups, and
    // `2002:7f00:1::` is a perfectly ordinary way to write loopback.
    return isPublicIPv4(toIPv4(groups[1]!, groups[2]!));
  }

  return true;
}

/** Two 16-bit groups read back out as the IPv4 address they carry. */
function toIPv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/** The eight 16-bit groups of an IPv6 address, with `::` filled back in. */
function expandIPv6(address: string): number[] | null {
  const [head, tail, ...rest] = address.split('::');
  if (rest.length > 0 || head === undefined) {
    return null;
  }

  const toGroups = (part: string): number[] =>
    part === '' ? [] : part.split(':').map((group) => Number.parseInt(group, 16));

  const left = toGroups(head);
  const right = tail === undefined ? [] : toGroups(tail);
  const filled = [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];

  return filled.length === 8 && filled.every((group) => Number.isInteger(group)) ? filled : null;
}

/** `[::1]` in a URL's hostname keeps its brackets; `isIP` does not want them. */
function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

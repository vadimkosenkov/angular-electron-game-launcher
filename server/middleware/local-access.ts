import type { RequestHandler } from 'express';

import { ApiError } from '../api-error';

/** Loopback names as they appear in a Host header. */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * A server bound to 127.0.0.1 is reachable by anything running as this user,
 * and by any web page the user has open: a browser will happily send requests
 * to loopback. Two header checks close the cheapest attacks.
 *
 * The Host check defeats DNS rebinding, where a hostile domain resolves to
 * 127.0.0.1 so that the page's own origin follows the request in.
 *
 * The Origin check rejects pages that were not served by us. A request with no
 * Origin at all (curl, another local process) is allowed through here and
 * stopped by the session token instead.
 */
export function requireLocalAccess(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const hostname = parseHostname(req.header('host'));
    if (hostname === undefined || !LOOPBACK_HOSTNAMES.has(hostname)) {
      next(new ApiError('UNAUTHORIZED', 'Request host is not a loopback address.'));
      return;
    }

    const origin = req.header('origin');
    const originAllowed =
      origin === undefined || isSameOrigin(origin, req.header('host')) || allowedOrigins.includes(origin);
    if (!originAllowed) {
      next(new ApiError('UNAUTHORIZED', 'Request origin is not allowed.'));
      return;
    }

    next();
  };
}

function parseHostname(host: string | undefined): string | undefined {
  if (host === undefined) {
    return undefined;
  }
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

/**
 * True when the request came from a page this very server served.
 *
 * Not a loosening of the rule: a page from any other origin still fails. It is
 * needed because same-origin is not the same as origin-less. A
 * `<script type="module">` is always fetched in CORS mode, even from the page
 * that references it, so in a packaged launcher the renderer's own bundle
 * arrives carrying an Origin header -- and without this branch the application
 * would serve its own index.html and then refuse to serve its own JavaScript.
 *
 * Compared against the Host header rather than a configured value, because the
 * port is assigned by the OS at startup. Host is only trusted here because it
 * was already checked to be a loopback name above. The scheme is fixed:
 * nothing local is served over https.
 */
function isSameOrigin(origin: string, host: string | undefined): boolean {
  return host !== undefined && origin === `http://${host}`;
}

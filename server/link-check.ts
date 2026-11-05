import type { LinkCheck, LinkStatus } from '../shared/availability.model';
import type { Game } from '../shared/game.model';
import { describeNonPublicTarget } from './public-address';

/**
 * Asks each game's address whether it is still there.
 *
 * This runs in Node, in the same process as the API, and that is not an
 * implementation detail: the renderer could not do it at all. A page cannot
 * read a cross-origin response without CORS headers those sites have no
 * reason to send, our own Content-Security-Policy restricts `connect-src` to
 * this origin on purpose, and giving the page outbound access to sixteen
 * third-party hosts is precisely what that policy exists to prevent. Node has
 * no origin, no cookie jar and no cache, so what comes back here is the
 * answer to the question actually asked.
 *
 * Nothing in this file takes a URL from a caller. It is handed games out of
 * the catalog the server validated at startup, and no address from the
 * renderer ever reaches it.
 *
 * That is not quite the whole answer, though, and the part it misses is worth
 * spelling out: a redirect is a URL chosen by whoever answered. Redirects are
 * therefore followed by hand here rather than by `fetch`, so that every hop
 * can be looked at before it is requested -- see `public-address.ts`.
 */

/**
 * Long enough for a slow host on a slow connection, short enough that sixteen
 * of them cannot make the button look stuck. A timeout is reported as
 * `unknown`, never as broken: this machine's network is also a candidate.
 */
const TIMEOUT_MS = 8_000;

/**
 * Four at a time. Sixteen sockets at once is not kind to a laptop on hotel
 * wifi and makes every timeout fire together; one at a time would take the
 * worst case to over two minutes.
 */
const CONCURRENCY = 4;

/**
 * Enough for the usual apex-to-www or trailing-slash hop and then some. A
 * chain longer than this is a loop or a site arguing with itself, and either
 * way the launcher has learned what it is going to learn.
 */
const MAX_REDIRECTS = 5;

/**
 * We say who we are.
 *
 * Borrowing a browser's User-Agent would get past more of these sites, and it
 * would be a lie told to make a number look better -- and the number it
 * improves is one this feature reports to the user as fact. A site that turns
 * an honest client away is reported as having turned us away.
 */
const USER_AGENT = 'GameLauncher (desktop launcher; link availability check)';

/** Statuses that mean "answered, but not to us". */
const REFUSED_STATUSES = new Set([401, 403, 407, 429]);

/** Statuses that mean the address itself is gone. */
const MISSING_STATUSES = new Set([404, 410]);

/**
 * Checks every game, four at a time, and returns the results in catalog
 * order.
 *
 * Never rejects. One address failing to answer is the normal case this
 * function exists to describe, so every outcome -- including an error nobody
 * anticipated -- comes back as a `LinkCheck`.
 */
export async function checkCatalogLinks(games: readonly Game[]): Promise<readonly LinkCheck[]> {
  return mapWithLimit(games, CONCURRENCY, checkGameLink);
}

async function checkGameLink(game: Game): Promise<LinkCheck> {
  const outcome = await probe(game.playUrl);
  return { gameId: game.id, checkedAt: new Date().toISOString(), ...outcome };
}

type Outcome = Omit<LinkCheck, 'gameId' | 'checkedAt'>;

/**
 * Walks the redirect chain one hop at a time.
 *
 * `fetch` would do this itself, and that is exactly the problem: it would
 * also follow a `Location` pointing at `http://127.0.0.1:9200/`, and the
 * result -- open or refused -- would be reported in the launcher's own
 * interface. Following by hand is what makes room for the check in front of
 * every request.
 */
async function probe(url: string): Promise<Outcome> {
  try {
    let target = new URL(url);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const refusal = await describeNonPublicTarget(target);
      if (refusal !== null) {
        return {
          status: 'unknown',
          detail: hop === 0 ? `address ${refusal}` : `redirect target ${refusal}`,
        };
      }

      let response = await request(target, 'HEAD');

      // A good many sites have never been asked a HEAD question and answer
      // it badly -- 405 by the book, 403 or 501 in practice -- while serving
      // the same address to GET without complaint. Asking again is what
      // keeps those out of the `refused` column, where they would be wrong.
      if (response.status === 405 || response.status === 501 || response.status === 403) {
        response = await request(target, 'GET');
      }

      const location = response.headers.get('location');
      if (!isRedirect(response.status) || location === null) {
        return readResponse(response);
      }

      const next = new URL(location, target);

      // A chain that leaves https is not followed at all. It is already the
      // answer -- the catalog promises https and this address does not keep
      // the promise -- and following would mean this machine making a plain
      // http request to a third party to learn something it already knows.
      if (next.protocol !== 'https:') {
        return {
          status: 'insecure',
          httpStatus: response.status,
          detail: `redirected to ${next.protocol.replace(':', '')}`,
        };
      }

      target = next;
    }

    return { status: 'unknown', detail: `more than ${MAX_REDIRECTS} redirects` };
  } catch (error: unknown) {
    return { status: 'unknown', detail: describeFailure(error) };
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function request(url: URL, method: 'HEAD' | 'GET'): Promise<Response> {
  const response = await fetch(url, {
    method,
    // Followed by `probe` instead, one validated hop at a time.
    redirect: 'manual',
    // No cookies are sent and none are kept: this is a reachability check,
    // not a visit, and it must not become one.
    credentials: 'omit',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // Nothing here reads the body, and a GET's body would otherwise be
  // downloaded in full in the background -- sixteen game pages' worth of
  // traffic for information that is entirely in the status line.
  await response.body?.cancel();

  return response;
}

/** The end of the chain: a response that is not a redirect. */
function readResponse(response: Response): Outcome {
  const status = classify(response.status);

  return {
    status,
    httpStatus: response.status,
    // A status in the 200s needs no explaining; anything else is worth a word
    // in the diagnostics table.
    ...(status === 'reachable' ? {} : { detail: `HTTP ${response.status}` }),
  };
}

function classify(httpStatus: number): LinkStatus {
  if (httpStatus < 400) {
    return 'reachable';
  }
  if (REFUSED_STATUSES.has(httpStatus)) {
    return 'refused';
  }
  if (MISSING_STATUSES.has(httpStatus)) {
    return 'missing';
  }
  // Every other 4xx and all of 5xx. A 500 says the site is having a bad day,
  // not that the game is gone, and neither conclusion is available from here.
  return 'unknown';
}

/**
 * Turns whatever `fetch` threw into one short phrase.
 *
 * The useful part is almost never the message -- `fetch failed` is all undici
 * says -- but the `cause` underneath it, which carries the system error code:
 * `ENOTFOUND` for a name that does not resolve, `ECONNREFUSED` for a closed
 * port, `CERT_HAS_EXPIRED` for a lapsed certificate. Those are worth showing;
 * a stack is not.
 */
function describeFailure(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `timed out after ${TIMEOUT_MS / 1000}s`;
  }

  if (error instanceof Error && error.cause instanceof Error) {
    const cause = error.cause;
    const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : null;
    return code ?? cause.message;
  }

  return error instanceof Error ? error.message : 'request failed';
}

/**
 * Runs `task` over `items` with at most `limit` in flight, preserving order.
 *
 * `limit` workers share one cursor, so each takes the next item as it frees
 * up rather than waiting for a batch to finish together. Results go back into
 * the slot the item came from, which is what keeps the output in catalog
 * order without a sort.
 */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

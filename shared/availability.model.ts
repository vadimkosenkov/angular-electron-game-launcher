/**
 * What the launcher knows about whether a game's address still answers.
 *
 * Shared by the checker in the server and the renderer that displays the
 * result, so the four states below are the same four on both sides.
 */

/**
 * The outcome of one check. Five states, and none of them is "works".
 *
 * The launcher cannot know that a game works: it is not the game, and a page
 * that loads may still be broken inside. What it can know is whether the
 * address answered, and how. Each state is therefore a statement about the
 * response, not about the game:
 *
 * - `reachable` -- the address answered over https with a status below 400.
 * - `insecure`  -- it redirected off https, and the launcher stopped there
 *                  rather than following. So this says the catalog's promise
 *                  of https is not kept, and deliberately says nothing about
 *                  whether the address behind the redirect answers: that was
 *                  never asked. `slither.io` does exactly this, and finding
 *                  it is the reason this state exists.
 * - `refused`   -- it answered, and turned us away (401, 403, 407, 429). The
 *                  site is up; it does not serve automated requests. Nothing
 *                  follows from this about the game in a real browser, which
 *                  is exactly why it is not called broken.
 * - `missing`   -- 404 or 410. The address itself is gone.
 * - `unknown`   -- a timeout, a DNS or TLS failure, a 5xx. The check did not
 *                  finish; it may be the site, it may be this machine's
 *                  network, and the launcher cannot tell which.
 */
export const LINK_STATUSES = ['reachable', 'insecure', 'refused', 'missing', 'unknown'] as const;

export type LinkStatus = (typeof LINK_STATUSES)[number];

export interface LinkCheck {
  readonly gameId: string;
  readonly status: LinkStatus;
  /** ISO-8601, UTC, stamped by the server. The renderer never supplies it. */
  readonly checkedAt: string;
  /** The final HTTP status, when there was a response at all. */
  readonly httpStatus?: number;
  /**
   * One short English phrase for the diagnostics table: `timed out after 8s`,
   * `ENOTFOUND`, `HTTP 503`. Never used as interface prose -- it is a
   * measurement, in the same register as the rest of that page.
   */
  readonly detail?: string;
}

export interface AvailabilityReport {
  /** One entry per game checked, in catalog order. Empty before a first run. */
  readonly checks: readonly LinkCheck[];
}

export const EMPTY_AVAILABILITY: AvailabilityReport = { checks: [] };

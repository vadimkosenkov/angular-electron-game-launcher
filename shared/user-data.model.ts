/**
 * The data that belongs to the person using the launcher, rather than to the
 * launcher itself. Shared by the Express API and the Angular renderer, so the
 * stored shape and the displayed shape cannot drift apart.
 *
 * Everything here survives a restart. That is the whole difference from the
 * catalog: the catalog ships with the application and is read-only, while this
 * is written at runtime and has to be defended against a half-written file,
 * an edit by hand, and a version of the launcher that wrote a different shape.
 */

import type { Language } from './game.model';

/**
 * `system` is not a third colour scheme -- it means "ask the operating system
 * and follow it", which is why the stored preference and the colours actually
 * applied are two different things in the renderer.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** The resolved answer: what `system` turned out to mean right now. */
export type ColorScheme = 'light' | 'dark';

export interface UserSettings {
  readonly language: Language;
  readonly theme: ThemePreference;
}

/**
 * What the launcher remembers about one game having been played.
 *
 * A record per game rather than an entry per launch, which is the decision
 * worth noticing. An event log would grow without bound, and nobody has ever
 * wanted to read the four-thousandth line of one; two numbers answer both
 * questions the interface actually asks -- how often, and how long ago -- in
 * space bounded by the size of the catalog. A timeline would be a different
 * feature with a different shape, not a bigger version of this one.
 */
export interface PlayRecord {
  readonly gameId: string;
  /** Launches that the main process actually allowed. At least 1. */
  readonly launchCount: number;
  /** ISO-8601, UTC, written by the server. The renderer never supplies it. */
  readonly lastPlayedAt: string;
}

export interface UserData {
  readonly settings: UserSettings;
  /**
   * Game ids, most recently added first. Ids rather than copies of the games:
   * the catalog is the single source of truth for what a game is, and a title
   * corrected in a later version should not leave a stale copy in favourites.
   */
  readonly favourites: readonly string[];
  /**
   * Most recently played first, so the order the interface wants is the order
   * on disk and no sort is needed to answer "what did I play last".
   *
   * An array rather than an object keyed by game id. A JSON object read from
   * a file the user can edit is an object with attacker-chosen keys, and
   * `__proto__` among them is a class of bug this shape simply does not have.
   */
  readonly history: readonly PlayRecord[];
}

/**
 * What a first run looks like, and what a damaged file falls back to.
 *
 * English and `system` are deliberate: the launcher cannot know a preferred
 * language before it is told one, and following the operating system is the
 * only theme choice that is never wrong on first launch.
 */
export const DEFAULT_USER_DATA: UserData = {
  settings: { language: 'en', theme: 'system' },
  favourites: [],
  history: [],
};

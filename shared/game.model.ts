/**
 * The catalog model. Shared by the Express API and the Angular renderer so a
 * change to the data shape breaks both sides at compile time.
 */

/** Declared as a const array so the zod schema can reuse it verbatim. */
export const GENRES = [
  'action',
  'adventure',
  'board',
  'idle',
  'party',
  'puzzle',
  'racing',
  'sandbox',
  'shooter',
  'strategy',
] as const;

export type Genre = (typeof GENRES)[number];

export const GAME_TAGS = [
  'multiplayer',
  'singleplayer',
  'no-account',
  'offline-capable',
] as const;

export type GameTag = (typeof GAME_TAGS)[number];

export const LANGUAGES = ['en', 'ru'] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * Catalog prose exists in both languages at once. Unlike interface labels it
 * is data, not translations of the user interface, so it lives with the game
 * rather than in the i18n dictionaries.
 */
export type LocalizedText = Record<Language, string>;

export interface Game {
  /** Stable slug. Favourites are stored by this value, so it must not change. */
  readonly id: string;
  readonly title: string;
  readonly genres: readonly Genre[];
  readonly tags: readonly GameTag[];
  /** One sentence, shown on the card. */
  readonly summary: LocalizedText;
  /** A paragraph, shown on the game page. */
  readonly description: LocalizedText;
  /** Always https. Opened in the system browser, never inside the window. */
  readonly playUrl: string;
  /** Drives the generated cover and the hover accent. */
  readonly accentColor: string;
  /** Relative to the Angular assets folder. Absent means a generated cover. */
  readonly coverUrl?: string;
  readonly developer?: string;
  readonly releaseYear?: number;
}

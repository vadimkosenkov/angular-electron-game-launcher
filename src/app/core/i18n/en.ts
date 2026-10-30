/**
 * The English dictionary, and the shape every other language must match.
 *
 * Kept as TypeScript rather than JSON so the two files cannot drift: `ru.ts`
 * declares itself as `Translations`, so a key added here and forgotten there
 * fails to compile instead of surfacing as a raw key in the interface.
 */
export const en = {
  nav: {
    discover: 'Discover',
    diagnostics: 'Diagnostics',
    sectionLibrary: 'Library',
    sectionSystem: 'System',
  },
  discover: {
    title: 'Discover',
    lede: 'Browser games that run without an account or a download.',
    search: 'Search by title or description',
    searchClear: 'Clear search',
    genre: 'Genre',
    genreAll: 'All genres',
    sort: 'Sort',
    sortTitleAsc: 'Title A–Z',
    sortTitleDesc: 'Title Z–A',
    sortYearDesc: 'Newest first',
    counted: '{{shown}} of {{total}} games',
    emptyTitle: 'Nothing matches those filters',
    emptyHint: 'Try a shorter search term, or pick a different genre.',
    reset: 'Reset filters',
  },
  card: {
    open: 'Open {{title}}',
  },
  game: {
    back: 'Back to catalog',
    play: 'Play',
    playHint: 'Opens in your browser',
    opening: 'Opening…',
    about: 'About',
    details: 'Details',
    developer: 'Developer',
    releaseYear: 'Released',
    genres: 'Genres',
    tags: 'Features',
    link: 'Address',
    unknown: 'Not recorded',
    notFoundTitle: 'No such game',
    notFoundHint: 'The catalog has no entry with that address.',
  },
  genre: {
    action: 'Action',
    adventure: 'Adventure',
    board: 'Board',
    idle: 'Idle',
    party: 'Party',
    puzzle: 'Puzzle',
    racing: 'Racing',
    sandbox: 'Sandbox',
    shooter: 'Shooter',
    strategy: 'Strategy',
  },
  tag: {
    multiplayer: 'Multiplayer',
    singleplayer: 'Singleplayer',
    'no-account': 'No account',
    'offline-capable': 'Works offline',
  },
  state: {
    loading: 'Loading the catalog…',
    errorTitle: 'The catalog could not be loaded',
    retry: 'Try again',
  },
};

/**
 * The contract every dictionary has to satisfy.
 *
 * Deliberately not `as const`: literal types would demand the same words, not
 * the same structure, and every translated string would be a type error.
 */
export type Translations = typeof en;

/**
 * The English dictionary, and the shape every other language must match.
 *
 * Kept as TypeScript rather than JSON so the two files cannot drift: `ru.ts`
 * declares itself as `Translations`, so a key added here and forgotten there
 * fails to compile instead of surfacing as a raw key in the interface.
 */
export const en = {
  nav: {
    label: 'Sections',
    discover: 'Discover',
    favourites: 'Favourites',
    settings: 'Settings',
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
  favourite: {
    action: 'Favourite {{title}}',
    save: 'Favourite',
    saved: 'In favourites',
  },
  favourites: {
    title: 'Favourites',
    lede: 'The games you kept, most recently added first.',
    counted: '{{count}} saved',
    emptyTitle: 'Nothing saved yet',
    emptyHint: 'Open a game and press the heart to keep it here.',
    browse: 'Browse the catalog',
  },
  settings: {
    title: 'Settings',
    lede: 'Saved on this machine as you change them.',
    language: 'Interface language',
    languageHint: 'Game descriptions follow the interface language.',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeFollowing: 'Following the system, currently {{scheme}}.',
    themeFixed: 'Fixed, whatever the system is set to.',
    scheme: {
      light: 'light',
      dark: 'dark',
    },
    unreadTitle: 'Your saved settings could not be read',
  },
  game: {
    back: 'Back to catalog',
    play: 'Play',
    playHint: 'Opens in your browser',
    opening: 'Opening…',
    playRejected: 'The launcher refused to open that address.',
    playFailed: 'The system browser could not be opened.',
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
    saveFailed: 'That change was not saved.',
  },
};

/**
 * The contract every dictionary has to satisfy.
 *
 * Deliberately not `as const`: literal types would demand the same words, not
 * the same structure, and every translated string would be a type error.
 */
export type Translations = typeof en;

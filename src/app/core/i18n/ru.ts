import type { Translations } from './en';

/**
 * The Russian dictionary.
 *
 * Typed as `Translations`, so a key added to `en.ts` and missed here is a
 * compile error rather than a raw key appearing in the interface.
 */
export const ru: Translations = {
  nav: {
    discover: 'Каталог',
    diagnostics: 'Диагностика',
    sectionLibrary: 'Библиотека',
    sectionSystem: 'Система',
  },
  discover: {
    title: 'Каталог',
    lede: 'Браузерные игры, которые запускаются без аккаунта и установки.',
    search: 'Поиск по названию или описанию',
    searchClear: 'Очистить поиск',
    genre: 'Жанр',
    genreAll: 'Все жанры',
    sort: 'Сортировка',
    sortTitleAsc: 'Название А–Я',
    sortTitleDesc: 'Название Я–А',
    sortYearDesc: 'Сначала новые',
    counted: '{{shown}} из {{total}} игр',
    emptyTitle: 'По этим условиям ничего нет',
    emptyHint: 'Попробуйте более короткий запрос или другой жанр.',
    reset: 'Сбросить фильтры',
  },
  card: {
    open: 'Открыть «{{title}}»',
  },
  game: {
    back: 'Назад к каталогу',
    play: 'Играть',
    playHint: 'Откроется в браузере',
    opening: 'Открываю…',
    about: 'Об игре',
    details: 'Подробности',
    developer: 'Разработчик',
    releaseYear: 'Год выхода',
    genres: 'Жанры',
    tags: 'Особенности',
    link: 'Адрес',
    unknown: 'Не указано',
    notFoundTitle: 'Такой игры нет',
    notFoundHint: 'В каталоге нет записи с таким адресом.',
  },
  genre: {
    action: 'Экшен',
    adventure: 'Приключение',
    board: 'Настольная',
    idle: 'Идл',
    party: 'Для компании',
    puzzle: 'Головоломка',
    racing: 'Гонки',
    sandbox: 'Песочница',
    shooter: 'Шутер',
    strategy: 'Стратегия',
  },
  tag: {
    multiplayer: 'Мультиплеер',
    singleplayer: 'Одиночная',
    'no-account': 'Без аккаунта',
    'offline-capable': 'Работает офлайн',
  },
  state: {
    loading: 'Загружаю каталог…',
    errorTitle: 'Не удалось загрузить каталог',
    retry: 'Повторить',
  },
};

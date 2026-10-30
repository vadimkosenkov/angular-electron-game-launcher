import { Injectable, computed, inject, signal } from '@angular/core';

import type { Game, Genre } from '@shared/game.model';

import { describeApiError } from '../api/api-error';
import { ApiClient } from '../api/api.client';
import { LanguageService } from '../i18n/language.service';

export const SORT_ORDERS = ['title-asc', 'title-desc', 'year-desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

type CatalogState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly games: readonly Game[] }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Holds the catalog and the three controls that narrow it.
 *
 * The whole catalog arrives in one request and the narrowing happens here, in
 * memory. With sixteen games a round trip per keystroke would cost more than
 * the filtering it replaces, and the empty-result state stays instant. If the
 * catalog ever grew past what is reasonable to hold, this is the one class
 * that would have to change.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly api = inject(ApiClient);
  private readonly language = inject(LanguageService);

  private readonly state = signal<CatalogState>({ kind: 'loading' });

  /** The three controls. Components write to these and read `visible`. */
  readonly search = signal('');
  readonly genre = signal<Genre | null>(null);
  readonly order = signal<SortOrder>('title-asc');

  readonly isLoading = computed(() => this.state().kind === 'loading');

  readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.message : null;
  });

  readonly all = computed<readonly Game[]>(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.games : [];
  });

  /** Genres that actually occur in the catalog, so the filter never offers an empty result. */
  readonly availableGenres = computed<readonly Genre[]>(() => {
    const used = new Set<Genre>();
    for (const game of this.all()) {
      for (const genre of game.genres) {
        used.add(genre);
      }
    }
    return [...used].sort();
  });

  readonly visible = computed<readonly Game[]>(() => {
    const term = this.search().trim().toLocaleLowerCase();
    const genre = this.genre();

    const matched = this.all().filter((game) => {
      if (genre !== null && !game.genres.includes(genre)) {
        return false;
      }
      if (term === '') {
        return true;
      }
      const haystack = `${game.title} ${this.language.text(game.summary)}`.toLocaleLowerCase();
      return haystack.includes(term);
    });

    return this.sort(matched);
  });

  readonly isFiltered = computed(() => this.search().trim() !== '' || this.genre() !== null);

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set({ kind: 'loading' });
    this.api.getGames().subscribe({
      next: (games) => this.state.set({ kind: 'ready', games }),
      error: (error: unknown) =>
        this.state.set({ kind: 'failed', message: describeApiError(error) }),
    });
  }

  resetFilters(): void {
    this.search.set('');
    this.genre.set(null);
  }

  /**
   * `filter` already copied the array, so sorting it in place is safe. Titles
   * are compared with the active locale rather than by code point, which is
   * what keeps a Russian interface from ordering them strangely.
   */
  private sort(games: Game[]): readonly Game[] {
    const locale = this.language.current();

    switch (this.order()) {
      case 'title-asc':
        return games.sort((a, b) => a.title.localeCompare(b.title, locale));
      case 'title-desc':
        return games.sort((a, b) => b.title.localeCompare(a.title, locale));
      case 'year-desc':
        // Games with no recorded year sort last rather than as year zero.
        return games.sort((a, b) => (b.releaseYear ?? -Infinity) - (a.releaseYear ?? -Infinity));
    }
  }
}

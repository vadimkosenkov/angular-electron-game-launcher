import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TranslocoDirective } from '@jsverse/transloco';
import { GENRES, type Game, type Genre } from '@shared/game.model';

import { CatalogStore, SORT_ORDERS, type SortOrder } from '../../core/catalog/catalog.store';
import { RelativeTimeService } from '../../core/i18n/relative-time.service';
import { UserDataStore } from '../../core/user-data/user-data.store';
import { GameCard } from '../../shared/game-card/game-card';

/** A game from the history, with the words that go under its card. */
interface RecentGame {
  readonly game: Game;
  readonly when: string;
}

/**
 * How many games the strip shows. Four fills one row at the widths this
 * window is used at, and a shortcut that needed scrolling would just be the
 * catalog again.
 */
const RECENT_LIMIT = 4;

/**
 * The catalog. Owns no state of its own: it writes the three controls on the
 * store and renders what the store derives from them. The recently-played
 * strip above the grid is the same thing -- a view over the stored history,
 * paired with the catalog this page already has.
 */
@Component({
  selector: 'app-discover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCard, TranslocoDirective],
  styleUrl: './discover.scss',
  templateUrl: './discover.html',
})
export class Discover {
  protected readonly store = inject(CatalogStore);

  private readonly userData = inject(UserDataStore);
  private readonly relativeTime = inject(RelativeTimeService);

  protected readonly sortOrders = SORT_ORDERS;

  /** Keyed by order so a new option cannot be added without a label. */
  protected readonly sortLabels: Record<SortOrder, string> = {
    'title-asc': 'discover.sortTitleAsc',
    'title-desc': 'discover.sortTitleDesc',
    'year-desc': 'discover.sortYearDesc',
    'last-played': 'discover.sortLastPlayed',
  };

  /**
   * The most recently played games, paired with how long ago.
   *
   * The history holds ids, so the games are looked up in the catalog the
   * renderer already has. An id with no game is skipped rather than rendered
   * as a gap: the server prunes unknown ids on read, but the two could differ
   * for as long as it takes this page's catalog request to arrive.
   */
  protected readonly recent = computed<readonly RecentGame[]>(() => {
    const games = new Map(this.store.all().map((game) => [game.id, game]));

    return this.userData
      .history()
      .slice(0, RECENT_LIMIT)
      .flatMap((record) => {
        const game = games.get(record.gameId);
        return game === undefined
          ? []
          : [{ game, when: this.relativeTime.format(record.lastPlayedAt) }];
      });
  });

  /**
   * Hidden while a search or a genre is active. The strip answers "what was I
   * playing", which is a different question from the one the filters are
   * asking, and leaving it above a filtered grid makes the page look like it
   * ignored the filter.
   */
  protected readonly showRecent = computed(
    () => !this.store.isFiltered() && this.recent().length > 0,
  );

  protected onSearch(event: Event): void {
    this.store.search.set((event.target as HTMLInputElement).value);
  }

  /**
   * The value arrives as a string, so it is matched against the known genres
   * rather than cast to one: an unexpected value becomes "no filter" instead
   * of a `Genre` the type system was told to believe in.
   */
  protected onGenre(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.genre.set(GENRES.find((genre) => genre === value) ?? null);
  }

  protected onOrder(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.order.set(SORT_ORDERS.find((order) => order === value) ?? 'title-asc');
  }

  protected genreLabelKey(genre: Genre): string {
    return `genre.${genre}`;
  }
}

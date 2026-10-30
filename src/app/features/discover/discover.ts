import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslocoDirective } from '@jsverse/transloco';
import { GENRES, type Genre } from '@shared/game.model';

import { CatalogStore, SORT_ORDERS, type SortOrder } from '../../core/catalog/catalog.store';
import { GameCard } from '../../shared/game-card/game-card';

/**
 * The catalog. Owns no state of its own: it writes the three controls on the
 * store and renders what the store derives from them.
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

  protected readonly sortOrders = SORT_ORDERS;

  /** Keyed by order so a new option cannot be added without a label. */
  protected readonly sortLabels: Record<SortOrder, string> = {
    'title-asc': 'discover.sortTitleAsc',
    'title-desc': 'discover.sortTitleDesc',
    'year-desc': 'discover.sortYearDesc',
  };

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

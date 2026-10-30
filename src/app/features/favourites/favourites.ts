import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslocoDirective } from '@jsverse/transloco';
import type { Game } from '@shared/game.model';

import { CatalogStore } from '../../core/catalog/catalog.store';
import { UserDataStore } from '../../core/user-data/user-data.store';
import { GameCard } from '../../shared/game-card/game-card';

/**
 * The favourites, which are stored as ids and shown as games.
 *
 * Nothing here is fetched: the catalog is already in memory and the ids are
 * already in the user-data store, so this page is the join of the two. That
 * is the payoff of storing ids rather than copies -- a game whose summary
 * changed in a later version shows its new summary here without a migration.
 */
@Component({
  selector: 'app-favourites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCard, RouterLink, TranslocoDirective],
  templateUrl: './favourites.html',
})
export class Favourites {
  private readonly catalog = inject(CatalogStore);
  private readonly userData = inject(UserDataStore);

  protected readonly isLoading = this.catalog.isLoading;
  protected readonly failure = this.catalog.failure;

  protected readonly games = computed<readonly Game[]>(() => {
    const byId = new Map(this.catalog.all().map((game) => [game.id, game]));

    // The order is the stored one, newest first, so this maps over the ids
    // rather than filtering the catalog -- filtering would give the catalog's
    // alphabetical order instead.
    return this.userData
      .favouriteIds()
      .map((id) => byId.get(id))
      .filter((game): game is Game => game !== undefined);
  });
}

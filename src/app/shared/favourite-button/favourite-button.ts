import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslocoDirective } from '@jsverse/transloco';

import { UserDataStore } from '../../core/user-data/user-data.store';

/**
 * The heart. Used twice: as an overlay on a catalog card, and as a labelled
 * button on the game page.
 *
 * It owns no state. Whether a game is a favourite is a question for the store,
 * which is also the only thing that can answer it correctly while a write is
 * in flight -- the store shows the change at once and rolls it back if the
 * write fails, and this button simply renders whatever it currently says.
 */
@Component({
  selector: 'app-favourite-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  styleUrl: './favourite-button.scss',
  templateUrl: './favourite-button.html',
})
export class FavouriteButton {
  readonly gameId = input.required<string>();
  /** Only for the accessible name, which says which game it belongs to. */
  readonly gameTitle = input.required<string>();
  /** The card wants the icon alone; the game page wants a labelled button. */
  readonly withLabel = input(false);

  private readonly userData = inject(UserDataStore);

  protected readonly isFavourite = computed(() => this.userData.isFavourite(this.gameId()));

  protected toggle(): void {
    this.userData.toggleFavourite(this.gameId());
  }
}

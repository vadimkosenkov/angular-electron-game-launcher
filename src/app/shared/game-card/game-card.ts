import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslocoDirective } from '@jsverse/transloco';
import type { Game, Genre } from '@shared/game.model';

import { LanguageService } from '../../core/i18n/language.service';
import { FavouriteButton } from '../favourite-button/favourite-button';
import { GameCover } from '../game-cover/game-cover';

/**
 * One game in a grid. Shared by the catalog and the favourites page, which
 * is why it was lifted out of the catalog's template in this stage: the two
 * pages differ in which games they show, not in how a game looks.
 */
@Component({
  selector: 'app-game-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FavouriteButton, GameCover, RouterLink, TranslocoDirective],
  styleUrl: './game-card.scss',
  templateUrl: './game-card.html',
})
export class GameCard {
  readonly game = input.required<Game>();

  protected readonly language = inject(LanguageService);

  protected genreLabelKey(genre: Genre): string {
    return `genre.${genre}`;
  }
}

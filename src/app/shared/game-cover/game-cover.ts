import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { Game } from '@shared/game.model';

import { COVER_HEIGHT, COVER_WIDTH, buildCoverArt } from './cover-art';

/**
 * A game's cover: the image it ships with, or art generated from its own data.
 *
 * Drawn as inline SVG rather than a canvas or a background image so it scales
 * with the card, costs no network request, and carries no raster asset into
 * the package.
 */
@Component({
  selector: 'app-game-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-cover.scss',
  templateUrl: './game-cover.html',
})
export class GameCover {
  readonly game = input.required<Game>();

  protected readonly width = COVER_WIDTH;
  protected readonly height = COVER_HEIGHT;

  protected readonly art = computed(() => buildCoverArt(this.game()));

  /** A shipped image wins; generated art is the fallback, not the default. */
  protected readonly imageUrl = computed(() => this.game().coverUrl ?? null);

  /** Unique per game, because several covers share one document. */
  protected readonly gradientId = computed(() => `cover-gradient-${this.game().id}`);

  protected polygonPoints(size: number): string {
    const half = size / 2;
    return `0,${-half} ${half},${half} ${-half},${half}`;
  }
}

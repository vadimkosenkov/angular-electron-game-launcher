import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { TranslocoDirective } from '@jsverse/transloco';
import type { Game } from '@shared/game.model';

import { describeApiError, isNotFound } from '../../core/api/api-error';
import { ApiClient } from '../../core/api/api.client';
import { LauncherBridgeService } from '../../core/bridge/launcher-bridge';
import { LanguageService } from '../../core/i18n/language.service';
import { GameCover } from '../../shared/game-cover/game-cover';

type PageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly game: Game }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed'; readonly message: string };

/** What happened the last time Play was pressed. */
type PlayState = 'idle' | 'opening' | 'rejected' | 'failed';

/**
 * One game, and the only button in the application that reaches outside it.
 *
 * The page asks the API for the game by id rather than reading it out of the
 * catalog store, so a deep link works on its own and the server's own 404 is
 * what produces the "no such game" state.
 */
@Component({
  selector: 'app-game-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GameCover, RouterLink, TranslocoDirective],
  styleUrl: './game-page.scss',
  templateUrl: './game-page.html',
})
export class GamePage {
  /** Bound from the `games/:id` route by `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly api = inject(ApiClient);
  private readonly launcher = inject(LauncherBridgeService);
  protected readonly language = inject(LanguageService);

  private readonly state = signal<PageState>({ kind: 'loading' });

  protected readonly playState = signal<PlayState>('idle');

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly isMissing = computed(() => this.state().kind === 'missing');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.message : null;
  });
  protected readonly game = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.game : null;
  });

  constructor() {
    // Reacting to the input rather than reading it once keeps the page correct
    // when the router reuses this component for a different id.
    toObservable(this.id)
      .pipe(
        switchMap((id) => {
          this.state.set({ kind: 'loading' });
          this.playState.set('idle');
          return this.api.getGame(id).pipe(
            map((game): PageState => ({ kind: 'ready', game })),
            catchError((error: unknown) =>
              of<PageState>(
                isNotFound(error)
                  ? { kind: 'missing' }
                  : { kind: 'failed', message: describeApiError(error) },
              ),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  /**
   * Hands the address to the main process, which decides whether to open it.
   * A refusal is shown rather than swallowed: silence here would look exactly
   * like a game that simply failed to load.
   */
  protected async play(game: Game): Promise<void> {
    this.playState.set('opening');
    const outcome = await this.launcher.openGame(game.playUrl);
    this.playState.set(outcome === 'opened' ? 'idle' : outcome);
  }
}

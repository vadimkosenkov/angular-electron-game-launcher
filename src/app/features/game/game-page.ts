import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { TranslocoDirective } from '@jsverse/transloco';
import type { Game } from '@shared/game.model';

import { describeApiError, isNotFound } from '../../core/api/api-error';
import { ApiClient } from '../../core/api/api.client';
import { AvailabilityStore } from '../../core/availability/availability.store';
import { LauncherBridgeService } from '../../core/bridge/launcher-bridge';
import { LanguageService } from '../../core/i18n/language.service';
import { RelativeTimeService } from '../../core/i18n/relative-time.service';
import { UserDataStore } from '../../core/user-data/user-data.store';
import { FavouriteButton } from '../../shared/favourite-button/favourite-button';
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
  imports: [FavouriteButton, GameCover, RouterLink, TranslocoDirective],
  styleUrl: './game-page.scss',
  templateUrl: './game-page.html',
})
export class GamePage {
  /** Bound from the `games/:id` route by `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly api = inject(ApiClient);
  private readonly launcher = inject(LauncherBridgeService);
  private readonly userData = inject(UserDataStore);
  private readonly availability = inject(AvailabilityStore);
  protected readonly language = inject(LanguageService);
  protected readonly relativeTime = inject(RelativeTimeService);

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

  /** What the launcher remembers about this game, or nothing. */
  protected readonly record = computed(() => {
    const game = this.game();
    return game === null ? undefined : this.userData.playRecord(game.id);
  });

  /**
   * Computed rather than called from the template, so that the language and
   * the minute-by-minute clock the service reads are both tracked here.
   */
  protected readonly lastPlayed = computed(() => {
    const record = this.record();
    return record === undefined ? '' : this.relativeTime.format(record.lastPlayedAt);
  });

  /**
   * What the last link check said about this game's address, or nothing if no
   * check has run. Not run from here: opening a game page must not send a
   * request to the game's own server before the person has asked for one.
   */
  protected readonly linkCheck = computed(() => {
    const game = this.game();
    return game === null ? undefined : this.availability.statusOf(game.id);
  });

  /**
   * The relative time of that check, computed here so the language and the
   * service's minute-by-minute clock are both tracked.
   */
  protected readonly linkCheckedWhen = computed(() => {
    const check = this.linkCheck();
    return check === undefined ? '' : this.relativeTime.format(check.checkedAt);
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

    // Counted only when the main process says it actually opened the address.
    // A refused or failed launch is not a game that was played, and counting
    // the press rather than the result would make the number mean nothing in
    // exactly the cases worth knowing about.
    if (outcome === 'opened') {
      this.userData.recordLaunch(game.id);
    }
  }
}

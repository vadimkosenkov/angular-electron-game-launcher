import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import type { Language } from '@shared/game.model';
import {
  DEFAULT_USER_DATA,
  type ThemePreference,
  type UserData,
  type UserSettings,
} from '@shared/user-data.model';

import { describeApiError } from '../api/api-error';
import { ApiClient } from '../api/api.client';

/**
 * The renderer's copy of the user's favourites and settings.
 *
 * It starts from the shared defaults so the first frame has something to
 * render, replaces them with the server's answer once it arrives, and treats
 * every change as a guess that the server confirms or overturns. Nothing is
 * kept in `localStorage`: it is scoped to an origin, and in production the
 * launcher's origin includes a port the operating system picks fresh on every
 * start -- favourites stored there would appear to vanish at each launch.
 */
@Injectable({ providedIn: 'root' })
export class UserDataStore {
  private readonly api = inject(ApiClient);

  private readonly state = signal<UserData>(DEFAULT_USER_DATA);
  private readonly loaded = signal(false);

  // Reading and writing fail for different reasons and are reported in
  // different places -- the settings page explains a failed read, the shell
  // explains a failed write -- so one signal for both would put the wrong
  // words under whichever happened.
  private readonly readError = signal<string | null>(null);
  private readonly writeError = signal<string | null>(null);

  readonly settings = computed(() => this.state().settings);

  /** Favourite ids in the server's order: most recently added first. */
  readonly favouriteIds = computed(() => this.state().favourites);

  /** Membership is asked once per card, so the set is derived once per change. */
  private readonly favouriteSet = computed(() => new Set(this.state().favourites));

  /**
   * True once the file has been read. Bootstrap waits for that, so this is
   * false only when the read actually failed -- and then these are defaults
   * standing in for data that exists, which is why the settings page refuses
   * to write over it until a retry succeeds.
   */
  readonly isLoaded = this.loaded.asReadonly();

  /** Why the stored data could not be read, if it could not. */
  readonly loadFailure = this.readError.asReadonly();

  /** Why the last change did not reach the disk, if it did not. */
  readonly saveFailure = this.writeError.asReadonly();

  /**
   * Reads the stored data, and never rejects: a failure here must not stop the
   * application booting.
   *
   * Bootstrap waits for this, which is what makes `settings()` safe to send
   * back to the server. A write to the settings replaces the whole object, so
   * a renderer that had not finished reading would send a default in the field
   * the user did not touch and overwrite the saved value with it. Loading
   * before the first component renders removes that window rather than
   * narrowing it -- and incidentally means the interface is never briefly in
   * the wrong language or theme.
   */
  async load(): Promise<void> {
    try {
      this.state.set(await firstValueFrom(this.api.getUserData()));
      this.loaded.set(true);
      this.readError.set(null);
    } catch (error: unknown) {
      this.readError.set(describeApiError(error));
    }
  }

  isFavourite(gameId: string): boolean {
    return this.favouriteSet().has(gameId);
  }

  toggleFavourite(gameId: string): void {
    const shouldBeFavourite = !this.isFavourite(gameId);
    const current = this.state().favourites;

    // The guessed order matches the server's rule -- newest first -- so the
    // confirmed answer usually looks identical to the optimistic one.
    const favourites = shouldBeFavourite
      ? [gameId, ...current]
      : current.filter((id) => id !== gameId);

    this.save(
      { ...this.state(), favourites },
      this.api.setFavourite(gameId, shouldBeFavourite),
    );
  }

  setLanguage(language: Language): void {
    this.saveSettings({ ...this.settings(), language });
  }

  setTheme(theme: ThemePreference): void {
    this.saveSettings({ ...this.settings(), theme });
  }

  private saveSettings(settings: UserSettings): void {
    this.save({ ...this.state(), settings }, this.api.putSettings(settings));
  }

  /**
   * Applies a change at once and asks the server to confirm it.
   *
   * Waiting for the round trip would make a heart take a visible moment to
   * fill, for an API on this machine that will almost always succeed. So the
   * change is shown immediately and the previous state is kept: if the write
   * fails -- a full disk, a read-only directory -- it is put back and the
   * failure is reported, rather than leaving the interface claiming something
   * that is not on disk.
   *
   * On success the server's own answer replaces the guess. That matters for
   * more than tidiness: the server is the one that knows the resulting order.
   */
  private save(optimistic: UserData, request: Observable<UserData>): void {
    const previous = this.state();

    this.state.set(optimistic);
    this.writeError.set(null);

    request.subscribe({
      next: (confirmed) => this.state.set(confirmed),
      error: (error: unknown) => {
        this.state.set(previous);
        this.writeError.set(describeApiError(error));
      },
    });
  }
}

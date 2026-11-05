import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

import type { Language } from '@shared/game.model';
import {
  DEFAULT_USER_DATA,
  type PlayRecord,
  type ThemePreference,
  type UserData,
  type UserSettings,
} from '@shared/user-data.model';

import { describeApiError } from '../api/api-error';
import { ApiClient } from '../api/api.client';
import { createRequestQueue } from '../api/request-queue';

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

  /**
   * Every request goes through here, one at a time. `request-queue.ts` has
   * the reasoning; the short version is that two whole-state answers must
   * never be outstanding together.
   *
   * Neither this nor `confirmed` is a signal: nothing renders them, and a
   * signal written from inside a subscription would be change detection for
   * its own sake.
   */
  private readonly enqueue = createRequestQueue();

  /**
   * The last state the server actually gave us, which is the only thing a
   * failed write can safely fall back to. It is not what the interface shows:
   * `state` is this plus whatever guesses are still waiting for an answer.
   */
  private confirmed: UserData = DEFAULT_USER_DATA;

  readonly settings = computed(() => this.state().settings);

  /** Favourite ids in the server's order: most recently added first. */
  readonly favouriteIds = computed(() => this.state().favourites);

  /** Membership is asked once per card, so the set is derived once per change. */
  private readonly favouriteSet = computed(() => new Set(this.state().favourites));

  /** Play records in the server's order: most recently played first. */
  readonly history = computed(() => this.state().history);

  /**
   * Derived once per change rather than searched per card. The catalog page
   * asks for every visible game at once, which would otherwise be a linear
   * scan of the history for each one.
   */
  private readonly historyByGame = computed(
    () => new Map(this.state().history.map((record) => [record.gameId, record])),
  );

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
    // In the same queue as the writes. A read is another whole-state answer,
    // and the retry on the settings page can be pressed while a write is
    // still in flight.
    await this.enqueue(async () => {
      try {
        this.apply(await firstValueFrom(this.api.getUserData()));
        this.loaded.set(true);
        this.readError.set(null);
      } catch (error: unknown) {
        this.readError.set(describeApiError(error));
      }
    });
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

  /** What is known about this game having been played, or nothing. */
  playRecord(gameId: string): PlayRecord | undefined {
    return this.historyByGame().get(gameId);
  }

  /**
   * Counts a launch the main process already allowed.
   *
   * Not optimistic, unlike the other writes: nobody is waiting to see a
   * counter move, the game has just opened in another window, and a guess
   * that had to be rolled back would be a number flickering for no reason.
   * A failure here is reported like any other failed write.
   */
  recordLaunch(gameId: string): void {
    this.send(this.api.recordLaunch(gameId));
  }

  clearHistory(): void {
    this.send(this.api.clearHistory());
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
   * change is shown immediately, and if the write fails -- a full disk, a
   * read-only directory -- the interface falls back rather than going on
   * claiming something that is not on disk.
   *
   * It falls back to the last answer the server gave, not to what was on
   * screen a moment ago. Those differ exactly when two guesses overlap: the
   * second one captures the first one's guess as its "before", so restoring
   * that would leave a rejected change on screen once both writes fail. The
   * last confirmed state is the only thing here known to be true.
   *
   * The cost is a guess still in flight disappearing for a moment when an
   * unrelated one fails. It comes back as soon as its own answer lands, and a
   * flicker is a smaller thing to be wrong about than a favourite the file
   * does not have.
   *
   * On success the server's own answer replaces the guess. That matters for
   * more than tidiness: the server is the one that knows the resulting order.
   */
  private save(optimistic: UserData, request: Observable<UserData>): void {
    this.state.set(optimistic);
    this.send(request, () => this.state.set(this.confirmed));
  }

  /**
   * Sends one write and installs whatever the server answers.
   *
   * `onFailure` is how the optimistic callers put their guess away again;
   * `recordLaunch` and `clearHistory` pass nothing, because they never made
   * one -- the state is left alone until the server answers, and there is
   * therefore nothing to roll back if it does not.
   */
  private send(request: Observable<UserData>, onFailure?: () => void): void {
    this.writeError.set(null);

    void this.enqueue(async () => {
      try {
        // Subscribing is what sends the request, and `firstValueFrom` only
        // subscribes when the queue reaches it. That is the whole mechanism:
        // the request is built when the person acts and sent when its turn
        // comes.
        this.apply(await firstValueFrom(request));
      } catch (error: unknown) {
        onFailure?.();
        this.writeError.set(describeApiError(error));
      }
    });
  }

  /**
   * Installs a whole-state answer as the new truth.
   *
   * There is no ordering check here, and that is the point of the queue: no
   * second answer can be outstanding, so the latest one to arrive is the
   * latest the server gave.
   */
  private apply(data: UserData): void {
    this.confirmed = data;
    this.state.set(data);
  }
}

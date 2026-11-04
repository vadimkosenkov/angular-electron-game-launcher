import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  EMPTY_AVAILABILITY,
  type AvailabilityReport,
  type LinkCheck,
} from '@shared/availability.model';

import { describeApiError } from '../api/api-error';
import { ApiClient } from '../api/api.client';
import { createRequestQueue } from '../api/request-queue';

/**
 * What the launcher last measured about its own links.
 *
 * Loaded when something first asks for it rather than at bootstrap: the
 * catalog and the favourites are needed to draw the first frame, and this is
 * not. Because the service is created on first injection, the constructor is
 * that moment -- opening a game page or the diagnostics page reads the stored
 * report, and a session that visits neither never asks for it.
 *
 * Running a check is never automatic. It sends a request to each address in
 * the catalog, which tells sixteen third-party servers this machine's IP
 * address and the fact that somebody here opened a game launcher. That is a
 * reasonable thing to do when the person asks for it and an unreasonable
 * thing to do behind their back on every start.
 */
@Injectable({ providedIn: 'root' })
export class AvailabilityStore {
  private readonly api = inject(ApiClient);

  private readonly state = signal<AvailabilityReport>(EMPTY_AVAILABILITY);
  private readonly running = signal(false);
  private readonly failure = signal<string | null>(null);

  /** Same serialization as the user data store, for the same reason. */
  private readonly enqueue = createRequestQueue();

  readonly checks = computed(() => this.state().checks);

  /** Derived once per change rather than searched per lookup. */
  private readonly byGame = computed(
    () => new Map(this.state().checks.map((check) => [check.gameId, check])),
  );

  /** True while a check is in flight, so the button can say so. */
  readonly isChecking = this.running.asReadonly();

  /** Why the last read or check failed, if it did. */
  readonly loadFailure = this.failure.asReadonly();

  /**
   * When the most recent stored result was measured, or null if nothing has
   * been. Taken as a maximum rather than off the first entry: the report is
   * in catalog order, and a run where one address timed out finishes several
   * seconds after one that answered at once.
   */
  readonly lastCheckedAt = computed(() => {
    const times = this.state().checks.map((check) => Date.parse(check.checkedAt));
    return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
  });

  constructor() {
    this.read();
  }

  /** What was last measured about this game's address, or nothing. */
  statusOf(gameId: string): LinkCheck | undefined {
    return this.byGame().get(gameId);
  }

  /** Asks the server to check every address in the catalog, now. */
  check(): void {
    this.running.set(true);
    this.request(() => firstValueFrom(this.api.checkLinks())).finally(() =>
      this.running.set(false),
    );
  }

  private read(): void {
    void this.request(() => firstValueFrom(this.api.getAvailability()));
  }

  private request(send: () => Promise<AvailabilityReport>): Promise<void> {
    this.failure.set(null);

    return this.enqueue(async () => {
      try {
        this.state.set(await send());
      } catch (error: unknown) {
        // A failure leaves the previous report on screen. It is dated, and
        // the date is shown, so what stays is honest rather than stale.
        this.failure.set(describeApiError(error));
      }
    });
  }
}

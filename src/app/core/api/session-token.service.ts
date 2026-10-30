import { Injectable, inject, signal } from '@angular/core';

import { LauncherBridgeService } from '../bridge/launcher-bridge';

/**
 * Holds the API token for the lifetime of the application.
 *
 * It is resolved once during bootstrap, before the first component renders, so
 * no request can go out without it. The alternative -- fetching it lazily on
 * the first call -- would make every consumer deal with a token that is not
 * there yet.
 */
@Injectable({ providedIn: 'root' })
export class SessionTokenService {
  private readonly launcher = inject(LauncherBridgeService);
  private readonly token = signal('');
  private readonly failure = signal<string | null>(null);

  /** Set when the token could not be obtained at all. */
  readonly unavailableReason = this.failure.asReadonly();

  get value(): string {
    return this.token();
  }

  /** Never rejects: a failure here must not stop the application booting. */
  async load(): Promise<void> {
    try {
      this.token.set(await this.launcher.readSessionToken());
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : String(error));
    }
  }
}

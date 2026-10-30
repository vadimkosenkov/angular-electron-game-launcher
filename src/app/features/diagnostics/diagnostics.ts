import { ChangeDetectionStrategy, Component, computed, inject, signal, VERSION } from '@angular/core';
import { forkJoin } from 'rxjs';

import { TranslocoDirective } from '@jsverse/transloco';
import type { HealthStatus } from '@shared/api.model';

import { describeApiError } from '../../core/api/api-error';
import { ApiClient } from '../../core/api/api.client';
import { SessionTokenService } from '../../core/api/session-token.service';
import { LauncherBridgeService } from '../../core/bridge/launcher-bridge';

type DiagnosticState = 'ok' | 'danger' | 'neutral';

interface DiagnosticRow {
  readonly label: string;
  readonly value: string;
  readonly state: DiagnosticState;
}

interface DiagnosticPanel {
  readonly heading: string;
  readonly rows: readonly DiagnosticRow[];
}

type ApiState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly health: HealthStatus; readonly gameCount: number }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * What the running renderer can actually see about itself.
 *
 * Deliberately left in the application rather than deleted once the catalog
 * arrived: these rows are measurements of the live process, not a restatement
 * of the configuration, and they are the fastest way to tell a broken preload
 * from a broken API. The labels stay in English -- this page is for whoever is
 * debugging the launcher, not for the person using it.
 */
@Component({
  selector: 'app-diagnostics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  styleUrl: './diagnostics.scss',
  templateUrl: './diagnostics.html',
})
export class Diagnostics {
  private readonly launcher = inject(LauncherBridgeService);
  private readonly sessionToken = inject(SessionTokenService);
  private readonly api = inject(ApiClient);

  private readonly apiState = signal<ApiState>({ kind: 'loading' });

  // Narrowing a discriminated union inside a template needs a value the type
  // checker can hold on to, so each case is exposed as its own signal. The
  // alternative, casting in the template, would switch type checking off at
  // exactly the place it is worth having.
  protected readonly isApiLoading = computed(() => this.apiState().kind === 'loading');
  protected readonly apiFailure = computed(() => {
    const state = this.apiState();
    return state.kind === 'failed' ? state.message : null;
  });
  protected readonly apiResult = computed(() => {
    const state = this.apiState();
    return state.kind === 'ready' ? state : null;
  });

  protected readonly panels: readonly DiagnosticPanel[] = [
    { heading: 'Runtime', rows: buildRuntimeRows(this.launcher) },
    {
      heading: 'Renderer isolation',
      rows: buildIsolationRows(this.launcher, this.sessionToken),
    },
  ];

  constructor() {
    forkJoin({ health: this.api.getHealth(), games: this.api.getGames() }).subscribe({
      next: ({ health, games }) =>
        this.apiState.set({ kind: 'ready', health, gameCount: games.length }),
      error: (error: unknown) =>
        this.apiState.set({ kind: 'failed', message: describeApiError(error) }),
    });
  }
}

function buildRuntimeRows(launcher: LauncherBridgeService): DiagnosticRow[] {
  const versions = launcher.bridge?.versions;

  return [
    {
      label: 'Environment',
      value: launcher.isElectron ? 'Electron desktop shell' : 'Plain browser',
      state: launcher.isElectron ? 'ok' : 'neutral',
    },
    { label: 'Angular', value: VERSION.full, state: 'neutral' },
    { label: 'Electron', value: versions?.electron ?? 'not available', state: 'neutral' },
    { label: 'Chromium', value: versions?.chromium ?? 'not available', state: 'neutral' },
    { label: 'Node.js', value: versions?.node ?? 'not available', state: 'neutral' },
  ];
}

function buildIsolationRows(
  launcher: LauncherBridgeService,
  sessionToken: SessionTokenService,
): DiagnosticRow[] {
  const security = launcher.bridge?.security;
  const leaked = launcher.leakedNodeGlobals;
  const tokenProblem = sessionToken.unavailableReason();

  return [
    {
      label: 'contextIsolation',
      value: describeFlag(security?.contextIsolation, 'enabled', 'DISABLED'),
      state: toFlagState(security?.contextIsolation),
    },
    {
      label: 'sandbox',
      value: describeFlag(security?.sandbox, 'enabled', 'DISABLED'),
      state: toFlagState(security?.sandbox),
    },
    {
      label: 'Node globals in page',
      value: leaked.length === 0 ? 'none found' : `leaked: ${leaked.join(', ')}`,
      state: leaked.length === 0 ? 'ok' : 'danger',
    },
    {
      label: 'External links',
      // The renderer cannot open anything by itself; it can only ask.
      value: launcher.isElectron ? 'main process decides' : 'browser fallback',
      state: launcher.isElectron ? 'ok' : 'neutral',
    },
    {
      label: 'Session token',
      // The token itself is never rendered: the page proves it has one by
      // getting answers from the API, not by printing it.
      value: tokenProblem ?? (sessionToken.value === '' ? 'empty' : 'held, not shown'),
      state: tokenProblem !== null || sessionToken.value === '' ? 'danger' : 'ok',
    },
  ];
}

function describeFlag(flag: boolean | undefined, whenOn: string, whenOff: string): string {
  if (flag === undefined) {
    return 'not reported (no Electron bridge)';
  }
  return flag ? whenOn : whenOff;
}

function toFlagState(flag: boolean | undefined): DiagnosticState {
  if (flag === undefined) {
    return 'neutral';
  }
  return flag ? 'ok' : 'danger';
}

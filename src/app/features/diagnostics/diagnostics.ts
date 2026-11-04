import { ChangeDetectionStrategy, Component, computed, inject, signal, VERSION } from '@angular/core';
import { forkJoin } from 'rxjs';

import { TranslocoDirective } from '@jsverse/transloco';
import type { HealthStatus } from '@shared/api.model';
import type { LinkCheck, LinkStatus } from '@shared/availability.model';

import { describeApiError } from '../../core/api/api-error';
import { ApiClient } from '../../core/api/api.client';
import { SessionTokenService } from '../../core/api/session-token.service';
import { AvailabilityStore } from '../../core/availability/availability.store';
import { LauncherBridgeService } from '../../core/bridge/launcher-bridge';

type DiagnosticState = 'ok' | 'warn' | 'danger' | 'neutral';

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

  /**
   * Exposed to the template rather than wrapped, because the button drives it
   * directly: this panel is the only place in the application that can start
   * a link check.
   */
  protected readonly links = inject(AvailabilityStore);

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

  /** One row per game, in catalog order, in the same register as the rest. */
  protected readonly linkRows = computed<readonly DiagnosticRow[]>(() =>
    this.links.checks().map((check) => ({
      label: check.gameId,
      value: describeCheck(check),
      state: toLinkState(check.status),
    })),
  );

  /** `15 reachable, 1 insecure`, or null before any check has run. */
  protected readonly linkTally = computed(() => {
    const counts = new Map<LinkStatus, number>();
    for (const check of this.links.checks()) {
      counts.set(check.status, (counts.get(check.status) ?? 0) + 1);
    }
    return counts.size === 0
      ? null
      : [...counts].map(([status, count]) => `${count} ${status}`).join(', ');
  });

  /**
   * The instant itself, in UTC, rather than "nine minutes ago".
   *
   * Everywhere a person reads this it is relative and translated; here the
   * surrounding labels are deliberately English, and a localised phrase in
   * the middle of them reads as a bug. An ISO timestamp belongs to no
   * language, which is the same reason the rest of this page prints raw
   * measurements.
   */
  protected readonly lastCheckedAt = computed(() => {
    const at = this.links.lastCheckedAt();
    return at === null ? null : at.replace(/\.\d+Z$/, 'Z');
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

/**
 * The status, and the one fact behind it. `detail` carries the HTTP status
 * when there is anything to say about it, so printing both would repeat
 * `HTTP 503` next to `503`.
 */
function describeCheck(check: LinkCheck): string {
  const detail = check.detail ?? (check.httpStatus === undefined ? null : `${check.httpStatus}`);
  return detail === null ? check.status : `${check.status} · ${detail}`;
}

/**
 * Three colours for five states. `refused` and `unknown` are the launcher
 * saying it learned nothing, and a colour would dress that as a verdict.
 */
function toLinkState(status: LinkStatus): DiagnosticState {
  switch (status) {
    case 'reachable':
      return 'ok';
    case 'insecure':
      return 'warn';
    case 'missing':
      return 'danger';
    default:
      return 'neutral';
  }
}

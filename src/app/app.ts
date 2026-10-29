import { Component, inject, VERSION } from '@angular/core';

import { LauncherBridgeService } from './core/bridge/launcher-bridge';

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

@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly launcher = inject(LauncherBridgeService);

  protected readonly isElectron = this.launcher.isElectron;

  protected readonly panels: readonly DiagnosticPanel[] = [
    { heading: 'Runtime', rows: buildRuntimeRows(this.launcher) },
    { heading: 'Renderer isolation', rows: buildIsolationRows(this.launcher) },
  ];
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

function buildIsolationRows(launcher: LauncherBridgeService): DiagnosticRow[] {
  const security = launcher.bridge?.security;
  const leaked = launcher.leakedNodeGlobals;

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

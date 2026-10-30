import { Injectable, isDevMode } from '@angular/core';

import type { LauncherBridge } from '@shared/bridge.model';
import { DEV_SESSION_TOKEN } from '@shared/dev-config';

/** Node globals that must never be reachable from the page's own scope. */
const NODE_GLOBALS = ['require', 'process', 'module', 'Buffer', 'global'] as const;

/**
 * Single point of access to whatever the preload script exposed.
 *
 * Later stages extend the bridge with the API base URL, the session token and
 * `openExternal`; keeping every read of `window.launcher` in one place means
 * the rest of the application never has to know Electron exists.
 */
@Injectable({ providedIn: 'root' })
export class LauncherBridgeService {
  /** `null` when the app runs in a plain browser (`npm run start:browser`). */
  readonly bridge: LauncherBridge | null = readBridge();

  /**
   * Node globals actually found in the page. With `nodeIntegration` off and
   * `contextIsolation` on this must stay empty -- it is a measurement of the
   * running renderer, not a restatement of the configuration.
   */
  readonly leakedNodeGlobals: readonly string[] = findLeakedNodeGlobals();

  get isElectron(): boolean {
    return this.bridge !== null;
  }

  /**
   * The API token for this run.
   *
   * Inside Electron it is asked of the main process over IPC. In the
   * browser-only development mode there is no bridge, so the fixed token of
   * `npm run dev:api` is used instead -- a placeholder, not a secret: it only
   * ever matches that standalone server, and a packaged launcher always has a
   * bridge, so this branch is never taken there.
   */
  async readSessionToken(): Promise<string> {
    if (this.bridge !== null) {
      return this.bridge.getSessionToken();
    }
    if (isDevMode()) {
      return DEV_SESSION_TOKEN;
    }
    throw new Error('No Electron bridge is available, so the API cannot be reached.');
  }
}

function readBridge(): LauncherBridge | null {
  const candidate = (globalThis as { launcher?: LauncherBridge }).launcher;
  return candidate?.isElectron === true ? candidate : null;
}

function findLeakedNodeGlobals(): string[] {
  const scope = globalThis as unknown as Record<string, unknown>;
  return NODE_GLOBALS.filter((name) => scope[name] !== undefined);
}

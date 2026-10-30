/**
 * Contract of the object the preload script exposes on `window.launcher`.
 *
 * It is shared between the preload script (Node side) and the Angular
 * renderer (browser side), so that both ends of the context bridge break at
 * compile time whenever the contract changes.
 */

/**
 * Name of the IPC channel the renderer uses to ask for the session token.
 *
 * It is exported as a type as well as a value for a reason. A sandboxed
 * preload script cannot import application modules: its `require` resolves
 * only `electron` and a few built-ins, and a relative import makes the entire
 * preload fail to load -- after which the page silently looks like a plain
 * browser. The preload therefore writes the literal out and annotates it with
 * this type, which fails to compile if the two ever disagree. The main
 * process is under no such restriction and imports the constant.
 */
export type SessionTokenChannel = 'launcher:session-token';

export const SESSION_TOKEN_CHANNEL: SessionTokenChannel = 'launcher:session-token';

export interface LauncherBridge {
  /** Always `true`. Lets the renderer tell Electron from a plain browser. */
  readonly isElectron: true;
  readonly versions: RuntimeVersions;
  readonly security: SecurityFlags;
  /**
   * Asks the main process for this run's API token.
   *
   * It is fetched rather than handed over at window creation on purpose:
   * `additionalArguments` would put the token on the renderer's command line,
   * where any process owned by this user can read it with `ps`.
   */
  getSessionToken(): Promise<string>;
}

export interface RuntimeVersions {
  readonly electron: string;
  readonly chromium: string;
  readonly node: string;
}

/** Values reported by the preload script about its own renderer process. */
export interface SecurityFlags {
  readonly contextIsolation: boolean;
  readonly sandbox: boolean;
}

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

/**
 * Name of the IPC channel the renderer uses to ask for a game to be opened in
 * the system browser. Written out in the preload for the same reason as above.
 */
export type OpenExternalChannel = 'launcher:open-external';

export const OPEN_EXTERNAL_CHANNEL: OpenExternalChannel = 'launcher:open-external';

/** Why an open was refused, or that it went ahead. */
export type OpenExternalOutcome = 'opened' | 'rejected' | 'failed';

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
  /**
   * Asks the main process to open a game in the system browser.
   *
   * The renderer passes a URL and gets a verdict; it never performs the open
   * itself. The decision is made in the main process against the catalog it
   * validated at startup, because the renderer is precisely the part whose
   * copy of that catalog cannot be trusted.
   */
  openExternal(url: string): Promise<OpenExternalOutcome>;
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

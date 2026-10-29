/**
 * Contract of the object the preload script exposes on `window.launcher`.
 *
 * It is shared between the preload script (Node side) and the Angular
 * renderer (browser side), so that both ends of the context bridge break at
 * compile time whenever the contract changes.
 */
export interface LauncherBridge {
  /** Always `true`. Lets the renderer tell Electron from a plain browser. */
  readonly isElectron: true;
  readonly versions: RuntimeVersions;
  readonly security: SecurityFlags;
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

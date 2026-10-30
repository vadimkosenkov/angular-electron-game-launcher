import { contextBridge, ipcRenderer } from 'electron';

import type {
  LauncherBridge,
  OpenExternalChannel,
  OpenExternalOutcome,
  SessionTokenChannel,
} from '../shared/bridge.model';

/**
 * Written out instead of imported.
 *
 * This script runs sandboxed, where `require` resolves only `electron` and a
 * few built-in modules. Importing anything from the project would make the
 * whole preload fail to load, and the page would then quietly behave as if it
 * were running in a browser. The annotation keeps the literal honest: it stops
 * compiling the moment the shared channel name changes.
 */
const sessionTokenChannel: SessionTokenChannel = 'launcher:session-token';
const openExternalChannel: OpenExternalChannel = 'launcher:open-external';

/**
 * The preload script is the only place where Node and the renderer meet.
 *
 * Everything the renderer is allowed to do has to be listed here explicitly,
 * which is exactly why `contextIsolation` must stay on -- without it the page
 * could reach into this scope directly.
 *
 * Note what is not exposed: `ipcRenderer` itself. The page gets one function
 * that asks for one value, not a channel it can send anything down.
 */
const bridge: LauncherBridge = {
  isElectron: true,
  versions: {
    electron: process.versions.electron ?? 'unknown',
    chromium: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
  },
  security: {
    contextIsolation: process.contextIsolated,
    sandbox: process.sandboxed,
  },
  getSessionToken: () => ipcRenderer.invoke(sessionTokenChannel),
  openExternal: (url: string): Promise<OpenExternalOutcome> =>
    ipcRenderer.invoke(openExternalChannel, url),
};

contextBridge.exposeInMainWorld('launcher', bridge);

import { contextBridge } from 'electron';

import type { LauncherBridge } from '../shared/bridge.model';

/**
 * The preload script is the only place where Node and the renderer meet.
 *
 * It runs in an isolated world: it can use a small part of Electron, but the
 * page itself never sees that world. Everything the renderer is allowed to do
 * has to be listed here explicitly, which is exactly why `contextIsolation`
 * must stay on -- without it the page could reach into this scope directly.
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
};

contextBridge.exposeInMainWorld('launcher', bridge);

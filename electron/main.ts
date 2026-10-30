import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';

import { SESSION_TOKEN_CHANNEL } from '../shared/bridge.model';
import { ANGULAR_DEV_SERVER_URL } from '../shared/dev-config';
import { createAppWindow } from './app-window';
import { startLauncherApi, type LauncherApi } from './server-lifecycle';

const isDev = process.argv.includes('--dev');

/**
 * Electron takes the application name from the packaged bundle. Running it as
 * `electron main.js` there is no bundle, so the name falls back to "Electron"
 * and user data lands in a directory shared with every other unpackaged
 * Electron app on this machine -- single-instance lock included. Naming the
 * app explicitly keeps development and production on the same code path and
 * gives the launcher a directory of its own.
 */
const appName = isDev ? 'Game Launcher (dev)' : 'Game Launcher';
app.setName(appName);
app.setPath('userData', join(app.getPath('appData'), appName));

let api: LauncherApi | undefined;
let rendererUrl: string | undefined;
let isShuttingDown = false;

// A launcher that writes to a single user-data directory must not run twice.
if (!app.requestSingleInstanceLock()) {
  console.warn(
    `[main] another instance already owns ${app.getPath('userData')}, exiting.`,
  );
  app.quit();
} else {
  registerAppEvents();
}

function registerAppEvents(): void {
  app.on('second-instance', focusExistingWindow);

  app.whenReady().then(startLauncher).catch(reportStartupFailure);

  // macOS convention: closing the last window does not quit the application.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // macOS convention: clicking the dock icon brings a window back.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });

  app.on('before-quit', closeApiBeforeQuitting);
}

/**
 * The window is created only after the API is genuinely accepting connections.
 * Because the start is awaited rather than timed, the renderer cannot issue a
 * request before the server exists: the race is removed by construction rather
 * than made unlikely.
 */
async function startLauncher(): Promise<void> {
  api = await startLauncherApi({ isDev });

  // In development the page comes from ng serve, which proxies /api to the
  // server started above. In production this server serves the page as well,
  // so the renderer and the API share one origin.
  rendererUrl = isDev ? ANGULAR_DEV_SERVER_URL : api.baseUrl;

  ipcMain.handle(SESSION_TOKEN_CHANNEL, () => api?.sessionToken ?? '');

  if (isDev) {
    console.log(`[main] user data: ${app.getPath('userData')}`);
    console.log(`[main] api:       ${api.baseUrl}`);
  }

  openMainWindow();
}

function openMainWindow(): void {
  if (rendererUrl === undefined) {
    return;
  }
  createAppWindow({ targetUrl: rendererUrl });
}

function focusExistingWindow(): void {
  const [existingWindow] = BrowserWindow.getAllWindows();
  if (!existingWindow) {
    return;
  }
  if (existingWindow.isMinimized()) {
    existingWindow.restore();
  }
  existingWindow.focus();
}

/**
 * Quitting is held back until the server has let go of its socket. Keep-alive
 * connections would otherwise outlive the window and leave the port bound.
 */
function closeApiBeforeQuitting(event: Electron.Event): void {
  if (api === undefined || isShuttingDown) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;

  api
    .close()
    .catch((error: unknown) => {
      console.error('[main] the API did not shut down cleanly:', error);
    })
    .finally(() => {
      app.quit();
    });
}

function reportStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox('Game Launcher failed to start', message);
  app.quit();
}

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';

import {
  OPEN_EXTERNAL_CHANNEL,
  SESSION_TOKEN_CHANNEL,
  type OpenExternalOutcome,
} from '../shared/bridge.model';
import { ANGULAR_DEV_SERVER_URL } from '../shared/dev-config';
import { isHttpsUrl } from '../shared/url';
import { createAppWindow } from './app-window';
import { installFileLogging, type FileLog } from './logger';
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

// Installed before anything else can report a problem, and after the user
// data directory has been chosen, since that is where the log goes.
const log: FileLog = installFileLogging(join(app.getPath('userData'), 'logs'));

registerProcessHandlers();

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

/**
 * The last line of defence in the main process.
 *
 * An uncaught exception here is not a renderer misbehaving: it is the process
 * that owns the window, the API and the user's data left in a state nobody
 * reasoned about. Carrying on would mean a launcher that half works, so this
 * says what happened, writes it down and stops.
 *
 * A rejected promise is not treated the same way. Most of them are a single
 * failed operation rather than a broken process, and quitting over one would
 * be a worse bug than the one being reported.
 */
function registerProcessHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('[main] uncaught exception:', error);
    reportFatal('Game Launcher stopped unexpectedly', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[main] unhandled promise rejection:', reason);
  });
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
  // `app.getPath('userData')` is the per-user, per-application directory the
  // platform set aside for exactly this. It was already pointed at a directory
  // of our own above, which is also what keeps a development run from writing
  // into the favourites of an installed copy.
  api = await startLauncherApi({ isDev, userDataDir: app.getPath('userData') });

  // In development the page comes from ng serve, which proxies /api to the
  // server started above. In production this server serves the page as well,
  // so the renderer and the API share one origin.
  rendererUrl = isDev ? ANGULAR_DEV_SERVER_URL : api.baseUrl;

  ipcMain.handle(SESSION_TOKEN_CHANNEL, () => api?.sessionToken ?? '');
  ipcMain.handle(OPEN_EXTERNAL_CHANNEL, (_event, url: unknown) => openGameInBrowser(url));

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

/**
 * Hands a game's address to the operating system, if it really is a game's
 * address.
 *
 * Everything arriving over IPC is renderer input and is treated as such: the
 * argument is typed `unknown` because a compromised renderer can invoke this
 * channel with anything at all. The decision is made here rather than in the
 * renderer for the same reason -- a check the attacker controls is not a check.
 *
 * Membership of the catalog is the real gate. The https test in front of it is
 * redundant today, since the catalog schema already rejects anything else, and
 * it stays because it is the invariant that must hold even if that schema is
 * ever loosened: this process must never hand the operating system a
 * `file:` or `javascript:` URL.
 */
async function openGameInBrowser(url: unknown): Promise<OpenExternalOutcome> {
  if (api === undefined || typeof url !== 'string' || !isHttpsUrl(url) || !api.isPlayableUrl(url)) {
    console.warn('[main] refused to open a URL that is not in the catalog:', url);
    return 'rejected';
  }

  try {
    await shell.openExternal(url);
    return 'opened';
  } catch (error) {
    console.error('[main] the system browser could not open the URL:', error);
    return 'failed';
  }
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
  console.error('[main] startup failed:', error);
  reportFatal('Game Launcher failed to start', error);
}

/**
 * Says what went wrong and where the rest of the story is.
 *
 * The log path is in the message because this is the only moment the person
 * is looking: a packaged application has no terminal, and "an error occurred"
 * without somewhere to look next is indistinguishable from no message at all.
 */
function reportFatal(title: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  try {
    dialog.showErrorBox(title, `${message}\n\nDetails were written to:\n${log.filePath}`);
  } catch (dialogError) {
    // Before the app is ready a dialog may not be possible; the log already
    // has the real error, and failing to describe it must not hide it.
    console.error('[main] could not show the failure dialog:', dialogError);
  }

  app.exit(1);
}

import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'node:path';

export interface AppWindowOptions {
  /**
   * Where the renderer comes from: the Angular dev server in development, the
   * local Express server in production. Either way it is a single origin the
   * window is then pinned to.
   */
  readonly targetUrl: string;
}

export function createAppWindow(options: AppWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    // Avoids a white flash: the window stays hidden until Angular has painted.
    show: false,
    backgroundColor: '#0f1115',
    // macOS: native traffic lights float above our own header.
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      // These three are already the Electron defaults. They are spelled out
      // because they are the security contract of the whole application.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // A preload script that fails to load does so quietly: the page keeps
  // working, just without the bridge, and looks exactly like a browser. This
  // turns that into something impossible to miss.
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[main] preload script failed to load: ${preloadPath}\n`, error);
  });

  applyNavigationGuards(window, options.targetUrl);
  applyRecovery(window);
  void window.loadURL(options.targetUrl);

  return window;
}

/**
 * What happens when the page itself stops working.
 *
 * Neither of these is theoretical, and neither looks like an error from the
 * outside: a renderer that is gone leaves a blank window, and one that is
 * wedged leaves the last frame it painted. Both are indistinguishable from an
 * application that has simply frozen, so both are named and both offer the one
 * action that actually helps.
 *
 * These dialogs are in English while the rest of the interface is translated.
 * They come from the main process, which has no access to the dictionaries and
 * may have to speak before the renderer -- the thing that knows the chosen
 * language -- exists at all.
 */
function applyRecovery(window: BrowserWindow): void {
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      `[main] the renderer stopped: ${details.reason} (exit code ${details.exitCode ?? 'none'})`,
    );

    const choice = dialog.showMessageBoxSync(window, {
      type: 'error',
      title: 'Game Launcher',
      message: 'The window stopped running.',
      detail: `Reason reported by the system: ${details.reason}.`,
      buttons: ['Reload', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });

    if (choice === 0) {
      window.reload();
      return;
    }
    app.quit();
  });

  // Fired while the page is still alive but not answering. Reloading loses
  // nothing here: favourites and settings are on disk, not in the page.
  window.on('unresponsive', () => {
    console.warn('[main] the window is not responding');

    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Game Launcher',
      message: 'The window is not responding.',
      detail: 'Waiting may be enough. Reloading starts the page again and keeps your data.',
      buttons: ['Keep waiting', 'Reload'],
      defaultId: 0,
      cancelId: 0,
    });

    if (choice === 1) {
      window.reload();
    }
  });

  window.on('responsive', () => {
    console.log('[main] the window is responding again');
  });
}

/**
 * A renderer that can navigate anywhere is a renderer that can be taken
 * somewhere hostile. The window is pinned to a single origin, and the only way
 * out of it is the validated `shell.openExternal` channel in the main process.
 */
function applyNavigationGuards(window: BrowserWindow, allowedUrl: string): void {
  const allowedOrigin = new URL(allowedUrl).origin;

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('will-navigate', (event, url) => {
    if (!isSameOrigin(url, allowedOrigin)) {
      event.preventDefault();
    }
  });

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

function isSameOrigin(url: string, allowedOrigin: string): boolean {
  try {
    return new URL(url).origin === allowedOrigin;
  } catch {
    return false;
  }
}

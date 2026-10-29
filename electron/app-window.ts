import { BrowserWindow } from 'electron';
import { join } from 'node:path';

import { ANGULAR_DEV_SERVER_URL } from '../shared/dev-config';

export interface AppWindowOptions {
  /** Passed explicitly through `--dev`, never guessed from NODE_ENV. */
  readonly isDev: boolean;
}

export function createAppWindow(options: AppWindowOptions): BrowserWindow {
  if (!options.isDev) {
    // In production the window is served by the local Express server, which is
    // added in stage 4. Failing loudly beats opening a window onto nothing.
    throw new Error(
      'Production window is not wired yet (stage 4). Use "npm run start:electron".',
    );
  }

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

  applyNavigationGuards(window, ANGULAR_DEV_SERVER_URL);
  void window.loadURL(ANGULAR_DEV_SERVER_URL);

  return window;
}

/**
 * A renderer that can navigate anywhere is a renderer that can be taken
 * somewhere hostile. The window is pinned to a single origin; links to the
 * outside world will get their own validated channel in stage 5.
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

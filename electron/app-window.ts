import { BrowserWindow } from 'electron';
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
  void window.loadURL(options.targetUrl);

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

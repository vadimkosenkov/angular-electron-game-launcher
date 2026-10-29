import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'node:path';

import { createAppWindow } from './app-window';

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

  app.whenReady().then(openMainWindow).catch(reportStartupFailure);

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
}

function openMainWindow(): void {
  if (isDev) {
    console.log(`[main] user data: ${app.getPath('userData')}`);
  }
  createAppWindow({ isDev });
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

function reportStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox('Game Launcher failed to start', message);
  app.quit();
}

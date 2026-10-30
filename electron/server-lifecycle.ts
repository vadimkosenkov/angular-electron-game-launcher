import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { startApiServer } from '../server/create-server';
import { ANGULAR_DEV_SERVER_URL, DEV_API_PORT } from '../shared/dev-config';

export interface LauncherApi {
  /** Origin the API is reachable at. In production the window loads it too. */
  readonly baseUrl: string;
  readonly sessionToken: string;
  /**
   * True only for a URL that is the play address of a game in the shipped
   * catalog. This is the allow-list behind `shell.openExternal`: the renderer
   * can ask for an address, but only one already on this list is ever opened.
   */
  isPlayableUrl(url: string): boolean;
  close(): Promise<void>;
}

export interface StartLauncherApiOptions {
  readonly isDev: boolean;
  /**
   * Where favourites and settings are written. Passed in rather than read from
   * `app.getPath` here, which is what keeps this file free of any Electron
   * import -- the API it starts has to be runnable under plain node.
   */
  readonly userDataDir: string;
}

export async function startLauncherApi(options: StartLauncherApiOptions): Promise<LauncherApi> {
  // Fresh for every run, kept in memory, never written to disk and never put
  // on a command line where `ps` would show it to other processes.
  const sessionToken = randomBytes(32).toString('hex');

  const server = await startApiServer({
    catalogPath: join(__dirname, '../server/data/games.json'),
    userDataDir: options.userDataDir,
    sessionToken,

    // Development pins the port because the Angular dev server proxies /api to
    // a fixed target. A packaged launcher takes whatever the operating system
    // hands out, so nothing can rely on finding it at a known address.
    port: options.isDev ? DEV_API_PORT : 0,

    // In development the page is served by ng serve and arrives through its
    // proxy; in production this server serves the page itself, so the renderer
    // is same-origin and no origin needs allowing at all.
    allowedOrigins: options.isDev ? [ANGULAR_DEV_SERVER_URL] : [],

    ...(options.isDev
      ? {}
      : { staticRoot: join(__dirname, '../../dist/game-launcher/browser') }),
  });

  // Built once from the validated catalog. An exact-match set rather than a
  // pattern: a prefix or hostname rule would let a crafted path through, and
  // there is no reason to accept anything but the addresses we ship.
  const playableUrls = new Set(server.catalog.games.map((game) => game.playUrl));

  return {
    baseUrl: server.url,
    sessionToken,
    isPlayableUrl: (url) => playableUrls.has(url),
    close: server.close,
  };
}

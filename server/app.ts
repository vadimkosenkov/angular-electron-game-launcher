import express, { type Express, type RequestHandler } from 'express';

import { securityHeaders } from './middleware/content-security-policy';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requireLocalAccess } from './middleware/local-access';
import { requireSessionToken } from './middleware/session-token';
import { createGamesRouter } from './routes/games.routes';
import { createHealthRouter } from './routes/health.routes';
import { createUserDataRouter } from './routes/user-data.routes';
import { createIndexHandler } from './renderer-index';
import type { Catalog } from './storage/catalog.store';
import type { UserDataStore } from './storage/user-data.store';

export interface ApiAppOptions {
  readonly catalog: Catalog;
  /** The user's own data: favourites and settings, already read from disk. */
  readonly userData: UserDataStore;
  readonly sessionToken: string;
  /** Browser origins allowed to call the API. Empty in a packaged launcher. */
  readonly allowedOrigins: readonly string[];
  /**
   * Directory holding the built Angular bundle. When set, this server also
   * serves the renderer, which puts the page and the API on one origin.
   * Left unset in development, where `ng serve` owns the page.
   */
  readonly staticRoot?: string;
}

export function createApiApp(options: ApiAppOptions): Express {
  const app = express();

  // Nothing about the server should be advertised to whoever is probing it.
  app.disable('x-powered-by');
  app.use(securityHeaders());

  // No CORS headers are ever sent: the renderer is same-origin in production
  // and explicitly allow-listed in development.
  app.use(express.json({ limit: '32kb' }));
  app.use(requireLocalAccess(options.allowedOrigins));

  // Mounted before the token guard, which is what makes it token-free.
  app.use('/api/health', createHealthRouter());

  app.use('/api', requireSessionToken(options.sessionToken));
  app.use('/api/games', createGamesRouter(options.catalog));
  app.use('/api/user-data', createUserDataRouter(options.userData, options.catalog));

  if (options.staticRoot !== undefined) {
    // Only the branch that actually serves the renderer needs this; in
    // development the page comes from the Angular dev server instead.
    const serveIndex = createIndexHandler(options.staticRoot);

    // `index: false` keeps index.html away from the static handler, which
    // would serve the file untouched and leave the nonce placeholder in it.
    app.use(express.static(options.staticRoot, { index: false }));
    app.use(createRouterFallback(serveIndex));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Deep links belong to the Angular router, so any GET that reached this far
 * gets the entry document and is resolved in the browser. Requests under /api
 * are left alone: an unknown endpoint must stay a JSON 404, not an HTML page.
 */
function createRouterFallback(serveIndex: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    serveIndex(req, res, next);
  };
}

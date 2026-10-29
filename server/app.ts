import express, { type Express } from 'express';

import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requireLocalAccess } from './middleware/local-access';
import { requireSessionToken } from './middleware/session-token';
import { createGamesRouter } from './routes/games.routes';
import { createHealthRouter } from './routes/health.routes';
import type { Catalog } from './storage/catalog.store';

export interface ApiAppOptions {
  readonly catalog: Catalog;
  readonly sessionToken: string;
  /** Browser origins allowed to call the API. Empty in a packaged launcher. */
  readonly allowedOrigins: readonly string[];
}

export function createApiApp(options: ApiAppOptions): Express {
  const app = express();

  // Nothing about the server should be advertised to whoever is probing it.
  app.disable('x-powered-by');

  // No CORS headers are ever sent: the renderer is same-origin in production
  // and explicitly allow-listed in development.
  app.use(express.json({ limit: '32kb' }));
  app.use(requireLocalAccess(options.allowedOrigins));

  // Mounted before the token guard, which is what makes it token-free.
  app.use('/api/health', createHealthRouter());

  app.use('/api', requireSessionToken(options.sessionToken));
  app.use('/api/games', createGamesRouter(options.catalog));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import { resolve } from 'node:path';

import {
  ANGULAR_DEV_SERVER_URL,
  DEV_API_PORT,
  DEV_SESSION_TOKEN,
} from '../shared/dev-config';
import { startApiServer } from './create-server';

/**
 * Standalone entry point for `npm run dev:api`.
 *
 * The API is the same one Electron will host in stage 4; only the surrounding
 * configuration differs. A fixed port and a fixed token make the browser-only
 * dev mode possible, where there is no preload bridge to hand them over.
 */
async function main(): Promise<void> {
  // npm scripts run from the repository root, so the catalog is resolved from
  // there rather than from the compiled file's location in dist-node.
  const catalogPath = resolve(process.cwd(), 'server/data/games.json');

  const server = await startApiServer({
    catalogPath,
    sessionToken: DEV_SESSION_TOKEN,
    port: DEV_API_PORT,
    allowedOrigins: [ANGULAR_DEV_SERVER_URL],
  });

  console.log(`[api] listening on ${server.url}`);
  console.log(`[api] catalog   ${catalogPath}`);
  console.log(`[api] dev token ${DEV_SESSION_TOKEN}`);

  const shutDown = (signal: string): void => {
    console.log(`[api] ${signal} received, closing`);
    void server.close().then(() => process.exit(0));
  };

  process.on('SIGINT', () => shutDown('SIGINT'));
  process.on('SIGTERM', () => shutDown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { once } from 'node:events';
import { createServer, type Server } from 'node:http';

import { createApiApp } from './app';
import { loadCatalog } from './storage/catalog.store';

export interface ApiServerOptions {
  readonly catalogPath: string;
  readonly sessionToken: string;
  /** Omitted or 0 asks the operating system for a free port. */
  readonly port?: number;
  /** Loopback only. Binding 0.0.0.0 would publish the API to the network. */
  readonly host?: string;
  readonly allowedOrigins?: readonly string[];
  /** Built Angular bundle to serve alongside the API. See ApiAppOptions. */
  readonly staticRoot?: string;
}

export interface ApiServer {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

/**
 * Starts the API and resolves once it is genuinely accepting connections.
 *
 * `events.once` turns the server's own 'listening' event into a promise, and
 * rejects if 'error' arrives first -- so a port already in use fails the start
 * instead of producing a server nobody can reach. Nothing here waits on a
 * timer, and nothing imports Electron: this file runs under plain node, which
 * is what makes the API testable on its own.
 */
export async function startApiServer(options: ApiServerOptions): Promise<ApiServer> {
  const catalog = await loadCatalog(options.catalogPath);
  const host = options.host ?? '127.0.0.1';

  const app = createApiApp({
    catalog,
    sessionToken: options.sessionToken,
    allowedOrigins: options.allowedOrigins ?? [],
    ...(options.staticRoot === undefined ? {} : { staticRoot: options.staticRoot }),
  });

  const server = createServer(app);
  server.listen(options.port ?? 0, host);
  await once(server, 'listening');

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected the API server to be listening on a TCP port.');
  }

  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    close: () => closeServer(server),
  };
}

/**
 * Keep-alive connections would hold the process open long past quit, so they
 * are dropped before the listener is closed.
 */
function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

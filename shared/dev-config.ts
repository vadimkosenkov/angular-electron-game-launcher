/**
 * Ports used while developing. They are kept out of the default Angular range
 * so the launcher can run next to other local projects.
 *
 * `angular.json` carries the same dev-server port: the CLI reads its own
 * configuration before any TypeScript is loaded, so that one cannot be
 * imported from here.
 */
export const ANGULAR_DEV_SERVER_PORT = 4300;

export const ANGULAR_DEV_SERVER_URL = `http://localhost:${ANGULAR_DEV_SERVER_PORT}`;

/**
 * Standalone API used by the browser-only dev mode (`npm run dev:api`).
 *
 * The browser never calls this port directly. `proxy.conf.json` makes the
 * Angular dev server forward `/api` here, so from the page's point of view the
 * API is same-origin -- exactly as it is in a packaged launcher, where Express
 * serves the bundle itself. That keeps the request simple: no preflight, and
 * no CORS headers anywhere in the server.
 */
export const DEV_API_PORT = 4301;

/**
 * A development placeholder, not a secret. It only ever reaches the standalone
 * dev server, and the renderer falls back to it exclusively under `isDevMode()`,
 * so it is dropped from the production bundle. A packaged launcher generates a
 * random token per run instead.
 */
export const DEV_SESSION_TOKEN = 'dev-session-token';

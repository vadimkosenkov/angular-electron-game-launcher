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

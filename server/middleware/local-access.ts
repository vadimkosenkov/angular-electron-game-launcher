import type { RequestHandler } from 'express';

import { ApiError } from '../api-error';

/** Loopback names as they appear in a Host header. */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * A server bound to 127.0.0.1 is reachable by anything running as this user,
 * and by any web page the user has open: a browser will happily send requests
 * to loopback. Two header checks close the cheapest attacks.
 *
 * The Host check defeats DNS rebinding, where a hostile domain resolves to
 * 127.0.0.1 so that the page's own origin follows the request in.
 *
 * The Origin check rejects pages that were not served by us. A request with no
 * Origin at all (the Electron window, curl, another local process) is allowed
 * through here and stopped by the session token instead.
 */
export function requireLocalAccess(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const hostname = parseHostname(req.header('host'));
    if (hostname === undefined || !LOOPBACK_HOSTNAMES.has(hostname)) {
      next(new ApiError('UNAUTHORIZED', 'Request host is not a loopback address.'));
      return;
    }

    const origin = req.header('origin');
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      next(new ApiError('UNAUTHORIZED', 'Request origin is not allowed.'));
      return;
    }

    next();
  };
}

function parseHostname(host: string | undefined): string | undefined {
  if (host === undefined) {
    return undefined;
  }
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

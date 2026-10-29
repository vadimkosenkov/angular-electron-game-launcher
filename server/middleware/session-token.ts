import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { ApiError } from '../api-error';

export const SESSION_TOKEN_HEADER = 'x-launcher-token';

/**
 * Every API route except health requires a token generated when the launcher
 * starts and handed to the renderer through the preload bridge.
 *
 * A custom header is the point: a browser cannot send one cross-origin without
 * a preflight request first, and the preflight is rejected because the server
 * returns no CORS headers at all. That turns a page on some unrelated site
 * from a possible attacker into one that cannot even phrase the request.
 */
export function requireSessionToken(expectedToken: string): RequestHandler {
  return (req, _res, next) => {
    const provided = req.header(SESSION_TOKEN_HEADER);
    if (provided === undefined || !matches(provided, expectedToken)) {
      next(new ApiError('UNAUTHORIZED', 'Missing or invalid session token.'));
      return;
    }
    next();
  };
}

/** Compared in constant time so the token cannot be guessed byte by byte. */
function matches(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { ApiFailure } from '../../shared/api.model';
import { ApiError } from '../api-error';

/** Reached when no route matched, so the response stays JSON rather than HTML. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError('NOT_FOUND', 'Unknown endpoint.'));
};

/**
 * The single place that turns anything thrown in a route into a response.
 * Express 5 forwards rejected promises here on its own, so routes do not need
 * try/catch around their async work.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    const body: ApiFailure = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  // Anything else is a bug. It is logged in full and reported as a blank 500:
  // stack traces and file paths are not the client's business.
  console.error('[api] unhandled error:', error);
  const body: ApiFailure = {
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' },
  };
  res.status(500).json(body);
};

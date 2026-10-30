import { HttpErrorResponse } from '@angular/common/http';

import type { ApiFailure } from '@shared/api.model';

/**
 * Turns whatever HttpClient produced into one line worth showing.
 *
 * The server answers errors in a known shape, so its own message is preferred;
 * status 0 is the case that matters most here, since it means the request
 * never reached a server at all.
 */
export function describeApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error.message : String(error);
  }

  if (error.status === 0) {
    return 'The API is unreachable.';
  }

  const body: unknown = error.error;
  const failure = (body as ApiFailure | null)?.error;
  if (failure !== undefined) {
    return `${failure.code}: ${failure.message}`;
  }

  return `HTTP ${error.status} ${error.statusText}`;
}

/**
 * Whether the server said the thing does not exist.
 *
 * Worth telling apart from every other failure: a missing game is a page the
 * user can understand and act on, while a broken API is not.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

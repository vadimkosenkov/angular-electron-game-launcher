import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

import { SESSION_TOKEN_HEADER } from '@shared/api.model';

import { SessionTokenService } from './session-token.service';

/**
 * Attaches the session token to API calls.
 *
 * Requests use relative paths, because the renderer is always same-origin with
 * the API: a packaged launcher is served by that very server, and in
 * development the Angular dev server proxies `/api` to it. That keeps these
 * requests simple ones, with no CORS preflight to answer.
 */
export const sessionTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const token = inject(SessionTokenService).value;
  if (token === '') {
    return next(request);
  }

  return next(request.clone({ setHeaders: { [SESSION_TOKEN_HEADER]: token } }));
};

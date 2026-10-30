import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { SessionTokenService } from './core/api/session-token.service';
import { sessionTokenInterceptor } from './core/api/session-token.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([sessionTokenInterceptor])),

    // Bootstrap waits for this promise, so the first component renders with a
    // token already in hand and no request can leave without one.
    provideAppInitializer(() => inject(SessionTokenService).load()),
  ],
};

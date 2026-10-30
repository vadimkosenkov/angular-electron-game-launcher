import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { provideTransloco } from '@jsverse/transloco';

import { LANGUAGES } from '@shared/game.model';

import { sessionTokenInterceptor } from './core/api/session-token.interceptor';
import { SessionTokenService } from './core/api/session-token.service';
import { DEFAULT_LANGUAGE } from './core/i18n/language.service';
import { StaticTranslationLoader } from './core/i18n/translation.loader';
import { UserDataStore } from './core/user-data/user-data.store';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // Leaving a game page and coming back should land at the top of the list,
    // not wherever the previous page happened to be scrolled to.
    provideRouter(
      routes,
      // Route parameters arrive as component inputs, so a page reads `:id`
      // the same way it reads any other input and nothing has to subscribe.
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withInterceptors([sessionTokenInterceptor])),

    provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
        // The dictionaries are in the bundle, so a switch is synchronous and
        // the views can simply re-render.
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: StaticTranslationLoader,
    }),

    // Bootstrap waits for these, so the first component renders with a token
    // already in hand -- no request can leave without one -- and with the
    // user's own settings rather than the defaults standing in for them.
    //
    // They run in order rather than together: the second one is an API call,
    // and the first one is what makes an API call possible. Reading the
    // settings before anything renders is also what keeps a write from
    // sending a default back in a field the user did not touch.
    provideAppInitializer(async () => {
      const sessionToken = inject(SessionTokenService);
      const userData = inject(UserDataStore);

      await sessionToken.load();
      await userData.load();
    }),
  ],
};

import { Injectable } from '@angular/core';
import { of, type Observable } from 'rxjs';

import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import type { Language } from '@shared/game.model';

import { en, type Translations } from './en';
import { ru } from './ru';

const DICTIONARIES: Record<Language, Translations> = { en, ru };

/**
 * Serves the dictionaries from the bundle instead of fetching them.
 *
 * Transloco's default loader asks for `/assets/i18n/<lang>.json` over HTTP.
 * In a desktop launcher that is a request that can fail, a file that can go
 * missing from the package, and an entry in `connect-src` that need not exist.
 * Importing the dictionaries makes the language switch synchronous and keeps
 * the interface working even if nothing else does.
 */
@Injectable({ providedIn: 'root' })
export class StaticTranslationLoader implements TranslocoLoader {
  getTranslation(language: string): Observable<Translation> {
    return of(DICTIONARIES[language as Language] ?? en);
  }
}

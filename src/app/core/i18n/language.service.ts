import { Injectable, computed, effect, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';
import type { Language, LocalizedText } from '@shared/game.model';
import { DEFAULT_USER_DATA } from '@shared/user-data.model';

import { UserDataStore } from '../user-data/user-data.store';

/** Used before the stored settings arrive, and by transloco's own config. */
export const DEFAULT_LANGUAGE: Language = DEFAULT_USER_DATA.settings.language;

/**
 * The one place that knows which language the interface is in.
 *
 * Transloco covers interface labels, but the catalog carries its own prose in
 * both languages at once -- a game's summary is data, not a translation of the
 * interface. Both need the same answer to "which language is active", so the
 * answer lives here and transloco is told about it rather than owning it.
 *
 * As of stage 6 the answer is not stored here either: it is derived from the
 * saved settings, so a switch is a write to disk that this service happens to
 * observe. The alternative -- a signal here plus a copy on the server -- gives
 * two places to be wrong about the same fact.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly userData = inject(UserDataStore);

  readonly current = computed(() => this.userData.settings().language);

  constructor() {
    // Transloco keeps its own notion of the active language, so it is pushed
    // rather than asked. Until the saved settings arrive the interface is in
    // the default language, which is a single frame in practice and the only
    // honest answer before the file has been read.
    effect(() => {
      this.transloco.setActiveLang(this.current());
    });
  }

  use(language: Language): void {
    this.userData.setLanguage(language);
  }

  /**
   * Picks the active side of a bilingual catalog field. Reading the signal
   * here is what makes every template that calls this re-render on a switch.
   */
  text(value: LocalizedText): string {
    return value[this.current()];
  }
}

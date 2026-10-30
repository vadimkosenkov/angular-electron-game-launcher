import { Injectable, inject, signal } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';
import type { Language, LocalizedText } from '@shared/game.model';

/** Changed from the settings page in stage 6, where it also becomes persistent. */
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * The one place that knows which language the interface is in.
 *
 * Transloco covers interface labels, but the catalog carries its own prose in
 * both languages at once -- a game's summary is data, not a translation of the
 * interface. Both need the same answer to "which language is active", so the
 * answer lives here and transloco is told about it rather than owning it.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly active = signal<Language>(DEFAULT_LANGUAGE);

  readonly current = this.active.asReadonly();

  use(language: Language): void {
    this.active.set(language);
    this.transloco.setActiveLang(language);
  }

  /**
   * Picks the active side of a bilingual catalog field. Reading the signal
   * here is what makes every template that calls this re-render on a switch.
   */
  text(value: LocalizedText): string {
    return value[this.active()];
  }
}

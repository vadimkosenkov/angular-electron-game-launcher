import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslocoDirective } from '@jsverse/transloco';
import { LANGUAGES, type Language } from '@shared/game.model';
import type { ThemePreference } from '@shared/user-data.model';

import { LanguageService } from '../../core/i18n/language.service';
import { THEME_OPTIONS, ThemeService } from '../../core/theme/theme.service';
import { UserDataStore } from '../../core/user-data/user-data.store';

/**
 * Language and theme, both of which are written to disk as they are chosen.
 *
 * There is no Save button and nothing to confirm: each control is a single
 * value, the write is local and immediate, and the store puts the previous
 * value back if it fails. A form to submit would add a step that can only
 * ever be accepted.
 */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  styleUrl: './settings.scss',
  templateUrl: './settings.html',
})
export class Settings {
  private readonly userData = inject(UserDataStore);
  private readonly language = inject(LanguageService);

  protected readonly theme = inject(ThemeService);

  protected readonly languages = LANGUAGES;
  protected readonly themeOptions = THEME_OPTIONS;

  protected readonly currentLanguage = this.language.current;
  protected readonly isLoaded = this.userData.isLoaded;
  protected readonly failure = this.userData.failure;

  /**
   * Language names are never translated: someone looking for their own
   * language looks for the word they would write, not for its English name.
   * So these are plain strings rather than dictionary keys.
   */
  protected readonly languageNames: Record<Language, string> = {
    en: 'English',
    ru: 'Русский',
  };

  /** Keyed by preference, so a new theme cannot be added without a label. */
  protected readonly themeLabels: Record<ThemePreference, string> = {
    system: 'settings.themeSystem',
    light: 'settings.themeLight',
    dark: 'settings.themeDark',
  };

  protected useLanguage(language: Language): void {
    this.language.use(language);
  }

  protected useTheme(preference: ThemePreference): void {
    this.theme.select(preference);
  }

  protected reload(): void {
    this.userData.load();
  }
}

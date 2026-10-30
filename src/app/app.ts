import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslocoDirective } from '@jsverse/transloco';
import { LANGUAGES, type Language } from '@shared/game.model';

import { LauncherBridgeService } from './core/bridge/launcher-bridge';
import { LanguageService } from './core/i18n/language.service';

/**
 * The window frame: title bar, navigation, and whatever the router puts in the
 * middle. It holds no catalog state of its own -- that belongs to the pages.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslocoDirective],
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly launcher = inject(LauncherBridgeService);
  private readonly language = inject(LanguageService);

  protected readonly isElectron = this.launcher.isElectron;
  protected readonly languages = LANGUAGES;
  protected readonly currentLanguage = this.language.current;

  protected useLanguage(language: Language): void {
    this.language.use(language);
  }
}

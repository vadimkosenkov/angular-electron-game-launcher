import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslocoDirective } from '@jsverse/transloco';

import { LauncherBridgeService } from './core/bridge/launcher-bridge';
import { ThemeService } from './core/theme/theme.service';
import { UserDataStore } from './core/user-data/user-data.store';

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
  private readonly userData = inject(UserDataStore);

  protected readonly isElectron = this.launcher.isElectron;

  /** Shown next to the navigation entry, so the count is visible from anywhere. */
  protected readonly favouriteCount = computed(() => this.userData.favouriteIds().length);

  protected readonly saveFailure = this.userData.failure;

  constructor() {
    // Asked for purely to bring it into existence. A root-provided service is
    // created on first injection, and nothing else injects this one: the theme
    // is applied by an effect inside it, not read by any component.
    inject(ThemeService);
  }
}

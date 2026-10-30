import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import { THEME_PREFERENCES, type ColorScheme, type ThemePreference } from '@shared/user-data.model';

import { UserDataStore } from '../user-data/user-data.store';

/** The three options, in the order the settings page offers them. */
export const THEME_OPTIONS: readonly ThemePreference[] = THEME_PREFERENCES;

/**
 * Turns the stored theme preference into the colour scheme actually in force,
 * and puts it on the document.
 *
 * The two are not the same thing: `system` is an instruction to follow the
 * operating system, so it resolves to light or dark and has to change when the
 * system does. macOS switches appearance at sunset if asked to, and a launcher
 * left open across that moment should follow -- which is why this listens to
 * the media query rather than reading it once at startup.
 *
 * Reading `window` and `document` directly is safe here: this renderer only
 * ever runs in an Electron window, and there is no server-side rendering for
 * the globals to be missing from.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly userData = inject(UserDataStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly systemPrefersDark = signal(false);

  /** What the user chose, which may be "follow the system". */
  readonly preference = computed(() => this.userData.settings().theme);

  /** What that currently means. */
  readonly scheme = computed<ColorScheme>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPrefersDark.set(query.matches);

    const onSystemChange = (event: MediaQueryListEvent): void => {
      this.systemPrefersDark.set(event.matches);
    };
    query.addEventListener('change', onSystemChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onSystemChange));

    // One attribute on <html> is all the stylesheet needs: the tokens are
    // redefined under [data-theme='light'] and everything that reads them
    // follows without a single component knowing a theme exists.
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.scheme());
    });
  }

  select(preference: ThemePreference): void {
    this.userData.setTheme(preference);
  }
}

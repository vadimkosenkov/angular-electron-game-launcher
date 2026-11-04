import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import { LanguageService } from './language.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Largest unit first. The first one that fits is the one used, which is how
 * "3 days ago" wins over "72 hours ago" without any special cases.
 *
 * Months and years are the usual approximations. Nothing here is an
 * arithmetic claim about a calendar -- it is a label for how long ago
 * something happened, where "2 months ago" is the answer whether the months
 * in question had 28 days or 31.
 */
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];

/**
 * Turns a stored timestamp into "yesterday" or "3 days ago", in the active
 * language.
 *
 * Two things make this a service rather than a pipe. It reads the language
 * signal, so any `computed` that calls it re-runs when the language changes --
 * a pure pipe would keep showing the old wording until its input happened to
 * change. And it reads a clock signal that advances on its own, so a label
 * left on screen ages instead of insisting it is still "now" an hour later.
 */
@Injectable({ providedIn: 'root' })
export class RelativeTimeService {
  private readonly language = inject(LanguageService);

  /**
   * Advanced once a minute, which is the coarsest unit this can display. A
   * faster tick would redraw nothing; a slower one would let "now" linger
   * after it stopped being true.
   */
  private readonly now = signal(Date.now());

  private readonly relative = computed(
    () => new Intl.RelativeTimeFormat(this.language.current(), { numeric: 'auto' }),
  );

  private readonly absolute = computed(
    () =>
      new Intl.DateTimeFormat(this.language.current(), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
  );

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), MINUTE);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * `numeric: 'auto'` is what produces "yesterday" rather than "1 day ago",
   * and the equivalent in Russian. Anything under a minute formats as zero
   * seconds, which the same option renders as "now".
   *
   * The magnitude is floored rather than rounded: something that happened
   * 47 hours ago is better described as a day ago than as two days ago, and
   * the label should never claim more time has passed than has.
   *
   * A timestamp in the future -- a clock that moved, or a file edited by
   * hand -- comes out as "in 3 days" rather than being hidden. It is wrong
   * data, and saying so is more useful than pretending it is not there.
   */
  format(iso: string): string {
    // Parseable by construction: the server validates every stored timestamp
    // as ISO-8601 before it reaches the renderer.
    const elapsed = this.now() - Date.parse(iso);

    for (const [unit, size] of UNITS) {
      if (Math.abs(elapsed) >= size) {
        return this.relative().format(-Math.trunc(elapsed / size), unit);
      }
    }

    return this.relative().format(0, 'second');
  }

  /** The exact moment, for a tooltip beside the approximate one. */
  exact(iso: string): string {
    return this.absolute().format(new Date(iso));
  }
}

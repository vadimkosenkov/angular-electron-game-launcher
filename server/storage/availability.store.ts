import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import {
  EMPTY_AVAILABILITY,
  LINK_STATUSES,
  type AvailabilityReport,
  type LinkCheck,
} from '../../shared/availability.model';
import { GAME_ID_MAX_LENGTH, GAME_ID_PATTERN, type Game } from '../../shared/game.model';
import { checkCatalogLinks } from '../link-check';
import { isMissingFile, writeJsonAtomically } from './json-file';

/**
 * The results live beside the user's data, not in the application bundle.
 *
 * The bundle is read-only once installed and, on macOS, signed: writing into
 * it would fail on a normal install and break the signature where it did not.
 * The user data directory is the one place a packaged launcher may write.
 *
 * A separate file from `user-data.json` all the same, because it is a
 * different kind of thing. Favourites are the person's; this is a machine
 * measurement of sixteen third-party web servers. Keeping them apart means a
 * damaged report can be thrown away -- see below -- without that decision
 * having to be made about a file holding favourites too.
 */
const AVAILABILITY_FILE = 'availability.json';

const linkCheckSchema = z.object({
  gameId: z.string().max(GAME_ID_MAX_LENGTH).regex(GAME_ID_PATTERN),
  status: z.enum(LINK_STATUSES),
  checkedAt: z.iso.datetime({ offset: true }),
  httpStatus: z.number().int().min(100).max(599).optional(),
  detail: z.string().max(200).optional(),
});

export interface AvailabilityStore {
  /** What is currently known. Empty until a check has run at least once. */
  snapshot(): AvailabilityReport;
  /**
   * Checks every address in the catalog and returns the whole new report.
   *
   * A second call while one is running joins it instead of starting another:
   * two presses of the button are a person being impatient, not a reason to
   * ask sixteen strangers' servers twice.
   */
  check(): Promise<AvailabilityReport>;
}

export interface LoadAvailabilityOptions {
  /** Directory the report lives in, chosen by whoever started the server. */
  readonly directory: string;
  /** The catalog. Its addresses are the only ones ever requested. */
  readonly games: readonly Game[];
}

export async function loadAvailability(
  options: LoadAvailabilityOptions,
): Promise<AvailabilityStore> {
  const filePath = join(options.directory, AVAILABILITY_FILE);
  const known = new Set(options.games.map((game) => game.id));

  await mkdir(options.directory, { recursive: true, mode: 0o700 });

  let state = await readReport(filePath, known);
  let inFlight: Promise<AvailabilityReport> | null = null;

  const run = async (): Promise<AvailabilityReport> => {
    const checks = await checkCatalogLinks(options.games);
    const report: AvailabilityReport = { checks };

    // Installed before the write, and kept even if the write fails.
    //
    // The opposite of the rule for user data, deliberately. There, a change
    // the renderer was told about but the disk never received is a lie about
    // the person's favourites. Here the measurement genuinely happened, and
    // hiding it because it could not be filed would throw away the answer to
    // the question that was just asked. All a lost report costs is one press
    // of the button after the next start.
    state = report;

    try {
      await writeJsonAtomically(filePath, report);
    } catch (error) {
      console.error('[api] link check results could not be stored:', error);
    }

    return report;
  };

  return {
    snapshot: () => state,

    check: () => {
      inFlight ??= run().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

/**
 * Reads the stored report, and is allowed to give up on it.
 *
 * Unlike user data, this file is reproducible: anything unreadable is
 * discarded rather than quarantined, because the recovery is to press the
 * button again. Quarantining would leave the person a file to inspect that
 * tells them nothing they could not measure in four seconds.
 *
 * Entries are still salvaged one at a time rather than all or nothing. A
 * report written by a version with one more game in its catalog should lose
 * that one row, not the other fifteen.
 */
async function readReport(filePath: string, known: Set<string>): Promise<AvailabilityReport> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return EMPTY_AVAILABILITY;
    }
    // Not rethrown, where user data would stop the start. A report we cannot
    // read is a report nobody has run yet, and that is a state the interface
    // already has to display.
    console.warn('[api] link check results could not be read:', error);
    return EMPTY_AVAILABILITY;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn(`[api] link check results were not valid JSON, discarded: ${filePath}`);
    return EMPTY_AVAILABILITY;
  }

  const parsed = z
    .object({ checks: z.array(z.unknown()).catch([]) })
    .catch({ checks: [] })
    .parse(json);

  const seen = new Set<string>();
  const checks: LinkCheck[] = [];

  for (const entry of parsed.checks) {
    const result = linkCheckSchema.safeParse(entry);
    if (!result.success || !known.has(result.data.gameId) || seen.has(result.data.gameId)) {
      continue;
    }
    seen.add(result.data.gameId);
    checks.push(result.data);
  }

  const dropped = parsed.checks.length - checks.length;
  if (dropped > 0) {
    console.warn(`[api] dropped ${dropped} unusable link check result(s)`);
  }

  return { checks };
}

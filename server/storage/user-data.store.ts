import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { GAME_ID_MAX_LENGTH, GAME_ID_PATTERN, LANGUAGES } from '../../shared/game.model';
import {
  DEFAULT_USER_DATA,
  THEME_PREFERENCES,
  type UserData,
  type UserSettings,
} from '../../shared/user-data.model';

/**
 * The file name is a constant, and the directory is handed to `loadUserData`
 * by whoever started the server.
 *
 * That is the whole answer to "can a request escape the permitted directory":
 * no part of the path comes from a request, so there is no `..` to filter and
 * no normalisation to get subtly wrong. A route that accepted a file name and
 * sanitised it would be strictly worse, because it would have to be right
 * every time instead of being impossible to get wrong once.
 */
const USER_DATA_FILE = 'user-data.json';

const gameIdSchema = z.string().max(GAME_ID_MAX_LENGTH).regex(GAME_ID_PATTERN);

/**
 * Note `.catch` on every field, where the catalog uses plain validation.
 *
 * The catalog refuses to start on a bad file, because serving half a catalog
 * is worse than not starting. User data is the opposite: the person's
 * favourites are not recoverable from anywhere else, so every field that can
 * be salvaged is salvaged and only the unreadable parts fall back to a
 * default. `.catch` covers a missing field and an invalid one alike.
 *
 * `favourites` is read as unknown entries on purpose. Validating it as
 * `z.array(gameIdSchema)` would throw away the entire list over one bad
 * entry, which is exactly the loss this schema exists to avoid; the entries
 * are filtered individually below instead.
 */
const userDataSchema = z
  .object({
    settings: z
      .object({
        language: z.enum(LANGUAGES).catch(DEFAULT_USER_DATA.settings.language),
        theme: z.enum(THEME_PREFERENCES).catch(DEFAULT_USER_DATA.settings.theme),
      })
      .catch(DEFAULT_USER_DATA.settings),
    favourites: z.array(z.unknown()).catch([]),
  })
  .catch({ settings: DEFAULT_USER_DATA.settings, favourites: [] });

export interface UserDataStore {
  /** The current state, held in memory. Never a stale read of the file. */
  snapshot(): UserData;
  /**
   * Both mutations resolve only once the new state is on disk, and leave the
   * in-memory state untouched if the write failed -- so what the renderer is
   * told matches what a restart will find.
   */
  updateSettings(settings: UserSettings): Promise<UserData>;
  setFavourite(gameId: string, favourite: boolean): Promise<UserData>;
}

export interface LoadUserDataOptions {
  /** Directory the file lives in. Supplied by Electron or the dev server. */
  readonly directory: string;
  /**
   * Whether a game id still exists in the catalog. Favourites for games that
   * a later version dropped are discarded on load rather than kept forever:
   * the catalog decides what a game is, and this list only points at it.
   */
  isKnownGame(gameId: string): boolean;
}

/**
 * Reads the user's data once, at startup, and returns the only object allowed
 * to change it.
 *
 * A missing file is a first run, not an error. A file that is not JSON at all
 * is moved aside rather than overwritten: it is the person's data, it may be
 * recoverable by hand, and silently replacing it would be the one failure mode
 * they could never undo.
 *
 * Any other read failure -- permissions, a failing disk -- is rethrown and
 * stops startup, which is the one case where that is the right answer. A file
 * we cannot read is not a file we know to be damaged, and starting without it
 * would leave the next write free to replace data that was probably intact.
 */
export async function loadUserData(options: LoadUserDataOptions): Promise<UserDataStore> {
  const filePath = join(options.directory, USER_DATA_FILE);

  // Created now so the first write cannot fail for a missing directory, and
  // restricted to its owner: favourites are nobody else's business, and on a
  // shared machine the default 0o777 minus umask is more than this needs.
  await mkdir(options.directory, { recursive: true, mode: 0o700 });

  let state = await readUserData(filePath, options.isKnownGame);

  /**
   * Writes are serialised through this chain. `rename` is atomic, but two
   * overlapping read-modify-write pairs are not: both would start from the
   * same state and the second would land without the first's change. The
   * chain also means each task sees the state the previous one committed.
   *
   * A rejected task is swallowed here so one failed write does not block
   * every later one; the rejection still reaches the caller through `run`.
   */
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const commit = async (next: UserData): Promise<UserData> => {
    await writeAtomically(filePath, next);
    state = next;
    return next;
  };

  return {
    snapshot: () => state,

    updateSettings: (settings) => enqueue(() => commit({ ...state, settings })),

    setFavourite: (gameId, favourite) =>
      enqueue(() => {
        const without = state.favourites.filter((id) => id !== gameId);
        const isPresent = without.length !== state.favourites.length;

        // Both verbs are idempotent: asking for the state it is already in
        // costs no write at all.
        if (favourite === isPresent) {
          return Promise.resolve(state);
        }

        // Newest first, so the favourites page reads as a history.
        const favourites = favourite ? [gameId, ...state.favourites] : without;
        return commit({ ...state, favourites });
      }),
  };
}

async function readUserData(
  filePath: string,
  isKnownGame: (gameId: string) => boolean,
): Promise<UserData> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return DEFAULT_USER_DATA;
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    await quarantine(filePath);
    return DEFAULT_USER_DATA;
  }

  const parsed = userDataSchema.parse(json);

  const favourites = parsed.favourites.filter((id): id is string => {
    const result = gameIdSchema.safeParse(id);
    return result.success && isKnownGame(result.data);
  });

  const dropped = parsed.favourites.length - favourites.length;
  if (dropped > 0) {
    console.warn(`[api] dropped ${dropped} favourite(s) that are not in the catalog`);
  }

  // A repaired setting is reported rather than silently corrected: a language
  // that quietly reverts to English looks like the setting was ignored. Only a
  // value that was actually there is worth a warning -- a key missing from a
  // file written by an older version is not a problem.
  for (const key of ['language', 'theme'] as const) {
    const stored = readSettingsField(json, key);
    if (stored !== undefined && stored !== parsed.settings[key]) {
      console.warn(`[api] user data held an unreadable ${key}, using "${parsed.settings[key]}"`);
    }
  }

  return { settings: parsed.settings, favourites };
}

/**
 * Reads one settings field out of the raw JSON without pretending to know its
 * shape -- used only to tell "the file said something we could not use" apart
 * from "the file did not say".
 */
function readSettingsField(json: unknown, key: keyof UserSettings): unknown {
  if (typeof json !== 'object' || json === null) {
    return undefined;
  }
  const settings = (json as Record<string, unknown>)['settings'];
  if (typeof settings !== 'object' || settings === null) {
    return undefined;
  }
  return (settings as Record<string, unknown>)[key];
}

/**
 * Writes through a temporary file in the same directory, then renames it over
 * the target.
 *
 * `writeFile` straight onto the real path is not atomic: a crash or a full
 * disk partway through leaves a truncated file, which is exactly the file this
 * loader would then have to quarantine. `rename` within one filesystem
 * replaces the target in a single step, so a reader sees either the old
 * contents or the new ones and never a half of each. The temporary name
 * carries random bytes so two writes can never pick the same one.
 *
 * What this does not do is `fsync` the directory, so a power cut in the
 * seconds after a rename can still lose the change on some filesystems.
 * Favourites are not worth an fsync per click; a file that is never corrupt
 * is, which is the part this buys.
 */
async function writeAtomically(filePath: string, data: UserData): Promise<void> {
  const tmpPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`;

  try {
    // Formatted and newline-terminated because a human may well open it.
    // 0o600 because favourites are nobody else's business on a shared machine.
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(tmpPath, filePath);
  } catch (error) {
    // Only the rename can fail with the temporary file already written, but
    // that is enough: without this, every such failure would leave another
    // one behind. `force` ignores the case where it was never created.
    await rm(tmpPath, { force: true });
    throw error;
  }
}

/** Keeps an unreadable file for inspection instead of destroying it. */
async function quarantine(filePath: string): Promise<void> {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const quarantinePath = `${filePath}.corrupt-${stamp}`;

  try {
    await rename(filePath, quarantinePath);
    console.warn(`[api] user data was not valid JSON, moved to ${quarantinePath}`);
  } catch (error) {
    // Nothing else to do: starting with defaults still beats refusing to run.
    console.error('[api] could not set aside the damaged user data file:', error);
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

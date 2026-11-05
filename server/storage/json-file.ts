import { randomBytes } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

/**
 * The two pieces of file handling that every store here needs.
 *
 * Extracted when the availability report became the second thing written to
 * the user data directory. Two copies of an atomic write is one copy too
 * many: the version that gets a fix later is the one whose bug was noticed,
 * and the other keeps it.
 */

/**
 * Writes through a temporary file in the same directory, then renames it over
 * the target.
 *
 * `writeFile` straight onto the real path is not atomic: a crash or a full
 * disk partway through leaves a truncated file, which is exactly the file a
 * loader would then have to quarantine. `rename` within one filesystem
 * replaces the target in a single step, so a reader sees either the old
 * contents or the new ones and never a half of each. The temporary name
 * carries random bytes so two writes can never pick the same one.
 *
 * What this does not do is `fsync` the directory, so a power cut in the
 * seconds after a rename can still lose the change on some filesystems.
 * Favourites are not worth an fsync per click; a file that is never corrupt
 * is, which is the part this buys.
 *
 * Formatted and newline-terminated because a human may well open it, and
 * `0o600` because none of it is anyone else's business on a shared machine.
 */
export async function writeJsonAtomically(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`;

  try {
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

/** A first run rather than a failure, and the only read error worth telling apart. */
export function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

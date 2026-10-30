import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';

/** Rotated at this size, keeping exactly one previous file. */
const MAX_BYTES = 512 * 1024;

export interface FileLog {
  /** Named in the failure dialog, because a log nobody can find is no log. */
  readonly filePath: string;
}

/**
 * Sends everything written to the console to a file as well.
 *
 * Run from a terminal, `console.error` is the whole diagnostic story. Run from
 * the Dock, it goes nowhere at all: there is no terminal attached, and the one
 * person who could report the problem has no way to see it. Everything this
 * application knows about its own failures would be lost in exactly the build
 * where it matters.
 *
 * The console is wrapped rather than replaced by a logger threaded through
 * every module, and that is deliberate. The Express server deliberately does
 * not import Electron -- that independence is what lets it run under plain
 * node -- so it cannot be handed a logger that knows where Electron keeps user
 * data. Wrapping the console captures its output, and node's own, without any
 * module knowing it is being captured.
 */
export function installFileLogging(directory: string): FileLog {
  mkdirSync(directory, { recursive: true });

  const filePath = join(directory, 'main.log');
  rotateIfLarge(filePath);

  for (const level of ['debug', 'log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]): void => {
      original(...args);
      append(filePath, level, format(...args));
    };
  }

  console.log(`[main] logging to ${filePath}`);

  return { filePath };
}

/**
 * Written synchronously on purpose.
 *
 * The lines worth having are the last ones before a crash, and those are
 * precisely the ones a buffered writer loses. At this volume -- a handful of
 * lines per run -- the cost of a synchronous append is not worth measuring.
 */
function append(filePath: string, level: string, message: string): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}\n`;

  try {
    appendFileSync(filePath, line, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // A log that cannot be written must not become the thing that breaks the
    // application. The console still has the message.
  }
}

function rotateIfLarge(filePath: string): void {
  try {
    if (statSync(filePath).size < MAX_BYTES) {
      return;
    }
    renameSync(filePath, `${filePath.replace(/\.log$/, '')}.previous.log`);
  } catch {
    // Missing file on a first run, or a directory we cannot write to. Neither
    // is a reason to refuse to start.
  }
}

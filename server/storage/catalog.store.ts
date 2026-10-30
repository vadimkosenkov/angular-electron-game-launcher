import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import {
  GAME_ID_MAX_LENGTH,
  GAME_ID_PATTERN,
  GAME_TAGS,
  GENRES,
  type Game,
} from '../../shared/game.model';
import { isHttpsUrl } from '../../shared/url';

const localizedTextSchema = z.object({
  en: z.string().min(1),
  ru: z.string().min(1),
});

const gameSchema = z.object({
  id: z.string().max(GAME_ID_MAX_LENGTH).regex(GAME_ID_PATTERN),
  title: z.string().min(1),
  genres: z.array(z.enum(GENRES)).min(1),
  tags: z.array(z.enum(GAME_TAGS)),
  summary: localizedTextSchema,
  description: localizedTextSchema,
  playUrl: z.string().refine(isHttpsUrl, 'must be an absolute https:// URL'),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/),
  coverUrl: z.string().min(1).optional(),
  developer: z.string().min(1).optional(),
  releaseYear: z.number().int().min(1970).max(2100).optional(),
});

const catalogSchema = z.array(gameSchema).min(1);

export interface Catalog {
  readonly games: readonly Game[];
  findById(id: string): Game | undefined;
}

/**
 * Reads and validates the catalog once, at startup.
 *
 * The catalog ships with the application and is never written to, so it is
 * kept in memory: sixteen entries are cheaper to hold than to re-read. A file
 * that is missing, malformed or off-schema aborts startup instead of serving
 * half a catalog -- user data gets the opposite treatment in stage 6, where
 * losing favourites is worse than starting with defaults.
 */
export async function loadCatalog(filePath: string): Promise<Catalog> {
  const raw = await readFile(filePath, 'utf8');

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Catalog file is not valid JSON: ${filePath}`, { cause });
  }

  const result = catalogSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Catalog file does not match the expected shape: ${filePath}\n${formatIssues(result.error)}`,
    );
  }

  // Assigning the parsed value to the shared model is the compile-time bridge
  // between the zod schema and the type Angular sees. If they ever drift, this
  // line stops compiling.
  const games: readonly Game[] = result.data;

  const byId = new Map(games.map((game) => [game.id, game]));
  if (byId.size !== games.length) {
    throw new Error(`Catalog file contains duplicate game ids: ${filePath}`);
  }

  return {
    games,
    findById: (id) => byId.get(id),
  };
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

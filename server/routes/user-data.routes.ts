import { Router } from 'express';

import { z } from 'zod';

import type { ApiSuccess } from '../../shared/api.model';
import { GAME_ID_MAX_LENGTH, GAME_ID_PATTERN, LANGUAGES } from '../../shared/game.model';
import { THEME_PREFERENCES, type UserData } from '../../shared/user-data.model';
import { ApiError } from '../api-error';
import type { Catalog } from '../storage/catalog.store';
import type { UserDataStore } from '../storage/user-data.store';

/**
 * `strictObject` rather than `object`: an unknown key is rejected instead of
 * ignored. Both ends of this API ship together, so a field the server does not
 * know about means the renderer and the server disagree -- better to fail
 * loudly in development than to silently drop a setting in production.
 */
const settingsSchema = z.strictObject({
  language: z.enum(LANGUAGES),
  theme: z.enum(THEME_PREFERENCES),
});

/**
 * Everything the renderer may change about its own data.
 *
 * Each handler answers with the whole of the user's data rather than just the
 * part it touched. It is a few dozen bytes, and it means the renderer never
 * merges a response into state it already holds -- the server's answer simply
 * replaces it, so the two cannot drift.
 */
export function createUserDataRouter(store: UserDataStore, catalog: Catalog): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(respond(store.snapshot()));
  });

  router.put('/settings', async (req, res) => {
    const result = settingsSchema.safeParse(req.body);
    if (!result.success) {
      throw new ApiError(
        'VALIDATION_FAILED',
        'Settings must name a known language and theme.',
        result.error.issues.map((issue) => issue.path.join('.') || '(root)'),
      );
    }

    res.json(respond(await store.updateSettings(result.data)));
  });

  // PUT and DELETE rather than a POST carrying a boolean: adding a favourite
  // twice, or removing one that was never there, is the same request sent
  // twice and the store treats it as such.
  router.put('/favourites/:gameId', async (req, res) => {
    res.json(respond(await store.setFavourite(requireGameId(req.params.gameId, catalog), true)));
  });

  router.delete('/favourites/:gameId', async (req, res) => {
    res.json(respond(await store.setFavourite(requireGameId(req.params.gameId, catalog), false)));
  });

  return router;
}

/**
 * The id is checked for shape and then for existence.
 *
 * The existence check is the one that matters: without it the renderer could
 * fill the file with ids for games that do not exist, and every one of them
 * would be read back, validated and discarded on the next start. Favourites
 * point at the catalog, so only the catalog decides what may go in them.
 */
function requireGameId(gameId: string, catalog: Catalog): string {
  if (gameId.length > GAME_ID_MAX_LENGTH || !GAME_ID_PATTERN.test(gameId)) {
    throw new ApiError('VALIDATION_FAILED', 'Game id must be a lowercase slug.', ['gameId']);
  }

  if (catalog.findById(gameId) === undefined) {
    throw new ApiError('NOT_FOUND', `No game with id "${gameId}".`);
  }

  return gameId;
}

function respond(data: UserData): ApiSuccess<UserData> {
  return { data };
}

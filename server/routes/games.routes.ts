import { Router } from 'express';

import type { ApiSuccess } from '../../shared/api.model';
import { GAME_ID_MAX_LENGTH, GAME_ID_PATTERN, type Game } from '../../shared/game.model';
import { ApiError } from '../api-error';
import type { Catalog } from '../storage/catalog.store';

/**
 * The whole catalog is returned in one response and filtered in the renderer.
 *
 * With sixteen entries that is about eight kilobytes: a round trip per
 * keystroke would cost more than it saves, and search stays instant offline.
 * A catalog large enough to page is a reason to revisit this, not a reason to
 * build paging now.
 */
export function createGamesRouter(catalog: Catalog): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: ApiSuccess<readonly Game[]> = { data: catalog.games };
    res.json(body);
  });

  router.get('/:id', (req, res) => {
    const id = req.params.id;

    // Validated before it is used as a lookup key, so nothing shaped like a
    // path or a prototype property ever reaches the catalog.
    if (id.length > GAME_ID_MAX_LENGTH || !GAME_ID_PATTERN.test(id)) {
      throw new ApiError('VALIDATION_FAILED', 'Game id must be a lowercase slug.', ['id']);
    }

    const game = catalog.findById(id);
    if (game === undefined) {
      throw new ApiError('NOT_FOUND', `No game with id "${id}".`);
    }

    const body: ApiSuccess<Game> = { data: game };
    res.json(body);
  });

  return router;
}

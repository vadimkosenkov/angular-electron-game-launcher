import { Router } from 'express';

import type { ApiSuccess, HealthStatus } from '../../shared/api.model';

/**
 * Health is the one route that needs no session token, so the API can be
 * checked with a plain curl. It therefore reports nothing worth knowing:
 * no version, no paths, no configuration.
 */
export function createHealthRouter(): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get('/', (_req, res) => {
    const body: ApiSuccess<HealthStatus> = {
      data: {
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
    };
    res.json(body);
  });

  return router;
}

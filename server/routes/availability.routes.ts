import { Router } from 'express';

import type { ApiSuccess } from '../../shared/api.model';
import type { AvailabilityReport } from '../../shared/availability.model';
import type { AvailabilityStore } from '../storage/availability.store';

/**
 * Two endpoints, and neither takes a parameter of any kind.
 *
 * That is the security design, not an accident of a small feature. An
 * endpoint that accepted a URL to check -- or even a game id to look up --
 * would be a request handler that makes the server fetch an address chosen by
 * its caller, which is the shape of every server-side request forgery there
 * has ever been. On a loopback API the caller is the renderer, and the
 * renderer is a browser displaying content from the web.
 *
 * So the renderer cannot name a target. It can say "check the catalog", and
 * the catalog is the file the server validated at startup. There is no input
 * to sanitise because there is no input.
 *
 * `POST` for the check, although it fetches rather than stores: it has
 * effects outside this machine -- sixteen requests to other people's servers
 * -- and those must not be something a cache, a prefetch or a repeated GET
 * can set off.
 */
export function createAvailabilityRouter(store: AvailabilityStore): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: ApiSuccess<AvailabilityReport> = { data: store.snapshot() };
    res.json(body);
  });

  router.post('/check', async (_req, res) => {
    // Answered with the whole report, like every write in this API, so the
    // renderer replaces its state instead of merging rows into it.
    const body: ApiSuccess<AvailabilityReport> = { data: await store.check() };
    res.json(body);
  });

  return router;
}

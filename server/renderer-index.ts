import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RequestHandler } from 'express';

import { buildContentSecurityPolicy } from './middleware/content-security-policy';

/** Replaced on every response, so no two page loads share a nonce. */
const NONCE_PLACEHOLDER = '__CSP_NONCE__';

/**
 * Serves the Angular entry document.
 *
 * It cannot be handed to `express.static`, because each response needs its own
 * nonce: a nonce that is reused is a nonce an injected <style> can simply
 * quote. The file is read once at startup -- it is shipped inside the
 * application and cannot change while it runs -- and only the substitution
 * happens per request.
 */
export function createIndexHandler(staticRoot: string): RequestHandler {
  const template = readFileSync(join(staticRoot, 'index.html'), 'utf8');

  if (!template.includes(NONCE_PLACEHOLDER)) {
    throw new Error(
      `index.html has no ${NONCE_PLACEHOLDER} placeholder, so component styles would be blocked.`,
    );
  }

  return (_req, res) => {
    const nonce = randomBytes(16).toString('base64');

    res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(nonce));
    // The nonce makes every response unique; caching one would hand a later
    // page load a nonce the policy no longer allows.
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(template.replaceAll(NONCE_PLACEHOLDER, nonce));
  };
}

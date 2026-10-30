import type { RequestHandler } from 'express';

/**
 * The policy the renderer runs under.
 *
 * Everything the page may load has to come from this server, which in a
 * packaged launcher means the files shipped inside the app. There is no
 * 'unsafe-inline' and no 'unsafe-eval': the Angular build is configured
 * without inlined critical CSS, and an AOT build never evaluates strings at
 * runtime.
 *
 * Styles need the nonce. Angular injects component styles as <style> elements
 * while the application runs, and a policy strict enough to be worth having
 * rejects those -- the alternative, 'unsafe-inline', would allow every inline
 * style on the page including any an attacker managed to inject. The nonce
 * says "these specific elements, which we put there", and Angular stamps it on
 * for us when the root element carries `ngCspNonce`.
 *
 * `img-src` allows data: because covers are generated as inline SVG rather
 * than fetched. `frame-src 'none'` matters more than it looks: games open in
 * the system browser, so nothing is ever framed inside the window.
 */
export function buildContentSecurityPolicy(styleNonce: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' 'nonce-${styleNonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Headers that are worth setting on every response, not just the document.
 *
 * `nosniff` stops a browser from deciding for itself that something we served
 * as JSON is really a script.
 */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  };
}

# Game Launcher

A desktop catalog of browser games: browse, search, filter, keep favourites,
open a game page and launch the game in the system browser. Built as a learning
project around
**Angular 22 + Electron 45 + Express 5 + JSON storage**.

> The launcher does not install or run games. It is a catalog that hands a
> validated `https://` link to the operating system.

## Architecture

Three processes, each with one job:

| Part | Responsibility |
| --- | --- |
| **Electron main** (`electron/`) | Application lifecycle, window, local Express server, OS integration |
| **Preload** (`electron/preload.ts`) | The only bridge between Node and the page, exposed through `contextBridge` |
| **Renderer** (`src/`) | Angular UI. No Node access, talks to the API over HTTP |
| **Express API** (`server/`, from stage 3) | REST API over JSON storage |

The renderer runs with `contextIsolation: true`, `nodeIntegration: false` and
`sandbox: true`. Everything it is allowed to do is listed explicitly in the
preload script.

## Requirements

- Node.js `^22.22.3 || ^24.15.0 || >=26` (developed on 24.21)
- npm 11+
- macOS (Apple Silicon); other platforms are untested

## Setup

```bash
npm install
```

### npm 11 blocks install scripts

npm 11 does not run package install scripts by default, and Electron downloads
its binary from one. If `node_modules/electron/path.txt` is missing after the
install, fetch the binary explicitly:

```bash
node node_modules/electron/install.js
```

## Running

```bash
npm run start:electron   # Angular dev server + TypeScript watch + Electron window
npm run start:browser    # Angular dev server only, opens in the default browser
```

`start:electron` runs three processes under `concurrently`: `ng serve` on port
**4500**, `tsc --watch` for the Node side, and `wait-on` holding Electron back
until both the dev server and `dist-node/electron/main.js` exist. No `setTimeout`
is involved in the wait.

The dev server sits on 4500, and the API beside it on 4501, rather than on the
Angular default 4200, so the launcher can run alongside other local projects.
The ports live in `angular.json`, `proxy.conf.json` and `shared/dev-config.ts`
-- in configuration rather than behind a command-line flag, so they survive the
next start.

They were moved off 4300/4301 after a collision with another project on this
machine that uses 4200, 4201, 4202, 3333 and 4300. Keeping both of ours in one
contiguous block well clear of that range is what makes the next collision
unlikely; leaving the port out of `angular.json` would fall back to 4200 and
collide immediately.

It is pinned to the address `127.0.0.1`, not the name `localhost`, in both
places. On macOS `localhost` resolves to `::1` first, so a second dev server
bound to the IPv6 wildcard can take that address while ours holds the IPv4 one:
both appear to be on the same port, neither fails to start, and the window
quietly loads the wrong application. With the address named, a real collision
fails loudly with *Port 4500 is already in use*, which is what a collision
should do.

The two commands are alternatives, not a pair. Both dev modes need an API on
the fixed port **4501** -- `start:electron` starts one inside the main process,
`start:browser` expects `npm run dev:api` beside it -- and the two use different
tokens, so running both at once shows `UNAUTHORIZED: Missing or invalid session
token.` in the browser. Stop one before starting the other.

### User data directory

Electron derives the application name from the packaged bundle. Running
`electron main.js` there is no bundle, so the name falls back to `Electron` and
user data -- including the single-instance lock that lives next to it -- would
be shared with every other unpackaged Electron app on the machine. The main
process therefore names itself explicitly:

| Mode | Directory |
| --- | --- |
| development | `~/Library/Application Support/Game Launcher (dev)` |
| packaged | `~/Library/Application Support/Game Launcher` |

Development data is deliberately separate, so experiments and corrupted-file
tests never touch real favourites.

Browser-only development has no Electron to ask, so `npm run dev:api` writes to
`.dev-user-data/` in the repository instead. That directory is gitignored.

Favourites and settings live in `user-data.json` in whichever of those
directories applies. See [User data on disk](#user-data-on-disk).

## Building

```bash
npm run build       # Angular bundle into dist/, Node bundle into dist-node/
```

Packaging into a `.dmg` is added in stage 7.

## API

A local Express server on loopback. Every response is either `{ "data": ... }`
or `{ "error": { "code", "message", "details?" } }`, so the renderer never has
to guess what came back.

| Method | Path | Auth | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | none | `200` `{ status, uptimeSeconds }` | — |
| `GET` | `/api/games` | token | `200` the whole catalog | `401` |
| `GET` | `/api/games/:id` | token | `200` one game | `400` bad slug, `404` unknown id, `401` |
| `GET` | `/api/user-data` | token | `200` `{ settings, favourites }` | `401` |
| `PUT` | `/api/user-data/settings` | token | `200` the whole user data | `400` unknown language, theme or extra key, `401` |
| `PUT` | `/api/user-data/favourites/:gameId` | token | `200` the whole user data | `400` bad slug, `404` unknown id, `401` |
| `DELETE` | `/api/user-data/favourites/:gameId` | token | `200` the whole user data | `400` bad slug, `404` unknown id, `401` |

Anything else under `/api` answers `404` with a JSON body rather than Express's
default HTML page.

Every write answers with the whole of the user's data rather than the part it
touched. It is a few dozen bytes, and it means the renderer replaces its state
with the server's answer instead of merging into it.

`PUT` and `DELETE` on a favourite are idempotent: adding one twice, or removing
one that was never there, succeeds and writes nothing.

### Why a local HTTP server is not automatically safe

A server bound to `127.0.0.1` is reachable by every process running as this
user, and by every page open in the user's browser: a web page can send
requests to loopback addresses. The launcher therefore does not treat
"it is local" as "it is private".

- **Loopback only.** `127.0.0.1`, never `0.0.0.0`, which would publish the API
  to the local network.
- **Random port** in production, assigned by the operating system via
  `listen(0)`. Weak on its own, but it raises the cost of finding the server.
- **Session token.** A random token per run, generated by the main process and
  handed to the renderer through the preload bridge, required on every route
  but health. It travels in a custom header, which a browser cannot send
  cross-origin without a preflight request.
- **No CORS headers, in any mode.** The preflight above is therefore never
  answered, so a page on an unrelated site cannot even phrase a request to the
  API. The renderer is same-origin instead: a packaged launcher is served by
  this very server, and in development the Angular dev server proxies `/api`
  (see below).
- **Host header check** against loopback names, which defeats DNS rebinding.
- **Origin allow-list.** Requests with no `Origin` (the window itself, curl)
  pass this check and are stopped by the token instead.
- **Same-origin requests are allowed explicitly.** Same-origin is not the same
  as origin-less: a `<script type="module">` is always fetched in CORS mode,
  even by the page that references it, so in a packaged launcher the renderer's
  own bundle arrives carrying an `Origin` header. Without that branch the
  application serves its own `index.html` and then refuses to serve its own
  JavaScript. The origin is compared against the `Host` header, already checked
  to be loopback, because the port is only known at startup.
- **32 kB JSON body limit** and `x-powered-by` disabled.

### Content Security Policy

The packaged renderer is served with a policy that allows no inline script and
no inline style, and `connect-src 'self'` keeps a compromised page from talking
to any other host.

Two things had to change to make a policy that strict possible, and both are
worth knowing:

- Angular's production build inlines critical CSS together with a small inline
  `onload` handler, which would force `'unsafe-inline'` in `script-src` -- the
  exact hole the policy exists to close. `inlineCritical` is therefore off in
  `angular.json`.
- Angular injects component styles as `<style>` elements while the application
  runs, which a strict `style-src` rejects. Rather than allowing every inline
  style with `'unsafe-inline'`, the server generates a fresh nonce per response
  and substitutes it into `index.html`; Angular reads the `ngCspNonce`
  attribute on `<app-root>` and stamps that nonce onto the elements it injects.
  This is why `index.html` cannot be served by `express.static` and why the
  document is sent with `Cache-Control: no-store`.

In development the page comes from the Angular dev server, which sends no
policy, so the `__CSP_NONCE__` placeholder reaches the browser literally and is
inert. The policy is exercised in a production run and when packaged.

### Opening a game in the system browser

The only thing the launcher does outside its own window, and the only place a
compromised renderer could do real damage, so the decision is not made there.

The renderer asks; the **main process decides and acts**. It checks the address
against the catalog it validated at startup -- an exact-match set of the
`playUrl` values -- and opens nothing else:

| Asked for | Result |
| --- | --- |
| `https://play2048.co/` (in the catalog) | opened |
| `https://evil.example/` | rejected |
| `javascript:alert(1)` | rejected |
| `file:///etc/passwd` | rejected |
| `https://play2048.co/?x=1` (one character off) | rejected |
| `42` (not a string) | rejected |

An exact-match set rather than a host or prefix rule: a prefix would let a
crafted path through, and there is no reason to accept anything but the
addresses that ship with the application. Every refusal is logged by the main
process.

The IPC argument is typed `unknown` on arrival, because a compromised renderer
can invoke the channel with anything at all. The game's address is shown on its
page as plain text rather than as a link, so the button is the only way out.

### Interface language

Interface labels go through [transloco](https://jsverse.github.io/transloco/);
the dictionaries are `src/app/core/i18n/en.ts` and `ru.ts`.

Two decisions worth knowing:

- **TypeScript, not JSON.** `ru.ts` declares itself as `Translations`, the type
  derived from `en.ts`, so a key added to one and forgotten in the other fails
  to compile instead of surfacing as a raw key in the interface.
- **No HTTP loader.** Transloco fetches `/assets/i18n/<lang>.json` by default.
  The dictionaries are imported instead, which makes the switch synchronous,
  removes a request that could fail in a packaged application, and keeps
  `connect-src` free of an entry it does not need.

The catalog's own prose is separate: `summary` and `description` carry both
languages in the data, because they are content rather than translations of the
interface. `LanguageService` answers "which language is active" for both.

The switch is on the settings page, and the choice is saved: `LanguageService`
derives the active language from the stored settings rather than holding a
signal of its own, so there is one fact in one place instead of a copy on each
side.

### User data on disk

Favourites and the two settings live in one small JSON file, written by the
server and never by the renderer:

```json
{
  "settings": { "language": "ru", "theme": "system" },
  "favourites": ["hexgl", "2048"]
}
```

**Why not `localStorage`.** It is scoped to an origin, and in production the
launcher's origin includes a port the operating system hands out fresh on every
start. Favourites kept there would appear to vanish at each launch. A file in
the user-data directory does not care what port the server got.

**Favourites are ids, not copies.** The catalog decides what a game is; this
list only points at it. A title corrected in a later version shows corrected
here, with no migration, and an id for a game that was dropped from the catalog
is discarded when the file is read.

**A damaged file is repaired, not refused.** The catalog aborts startup if its
file is wrong, because serving half a catalog is worse than not starting. User
data gets the opposite treatment: the person's favourites exist nowhere else,
so every field that can be salvaged is, and only the unreadable parts fall back
to a default. A file that is not JSON at all is moved to
`user-data.json.corrupt-<timestamp>` rather than overwritten -- it may still be
recoverable by hand, and silently replacing it is the one failure nobody could
undo.

| What the file holds | What happens |
| --- | --- |
| nothing (first run) | defaults; no file is written until something changes |
| not JSON at all | moved aside, defaults loaded, warning logged |
| an unknown language or theme | that field falls back, the rest is kept, warning logged |
| a favourite that is not a game | that entry is dropped, the rest is kept |

**Writes are atomic.** `writeFile` straight onto the real path is not: a crash
partway through leaves a truncated file. Each write goes to
`user-data.json.<random>.tmp` and is then `rename`d over the target, which
within one filesystem replaces it in a single step -- a reader sees the old
contents or the new ones, never half of each. The temporary file is removed if
the rename fails. What this does not do is `fsync` the directory, so a power
cut in the seconds after a write can still lose that change; a file that is
never corrupt is the part worth paying for, an fsync per click is not.

**Nothing from a request reaches the path.** The directory is handed to the
server at startup and the file name is a constant. There is no `..` to filter,
because there is nothing to concatenate -- which is a stronger guarantee than
sanitising a name correctly every time.

**The renderer guesses, the server decides.** Pressing a heart fills it at
once and sends the request afterwards. If the write fails, the store puts the
previous state back and the shell shows a banner explaining it; on success the
server's own answer replaces the guess, which is also how the renderer learns
the resulting order. Waiting for a round trip to a server on this machine would
make every heart feel slow to protect against a case that ends in an error
message either way.

### Theme

Three choices -- system, light, dark -- stored as one of those three words, not
as a resolved colour.

`system` means "ask the operating system and keep asking": `ThemeService`
reads `prefers-color-scheme` and listens for changes, so a launcher left open
across the moment macOS switches appearance follows it. The resolved answer is
written to `<html data-theme>`, and `src/styles.scss` defines the colour tokens
twice, once under each value. No component has a light-mode branch; they all
read the same custom properties.

The bare `:root` block is the first frame, before the stored setting has been
read, and it is the dark palette -- a light-mode user sees one dark frame
rather than a flash of white.

### Cover art

The covers are generated, not downloaded. Real cover art belongs to the people
who made the games, so none of it is shipped here.

Each cover is drawn as inline SVG from the game's own data: the seed is its id,
so a cover never changes between renders or sessions, the palette comes from
`accentColor`, and the shape of the pattern comes from the first genre -- which
is what keeps sixteen generated covers from reading as one repeated texture.

A game may instead carry `coverUrl`, a path relative to the Angular assets
folder, and that image wins over anything generated. Drop a file in
`src/assets/` and point the catalog entry at it.

### Checking the API without Electron

```bash
npm run dev:api
```

Serves the same API on a fixed port 4501 with a fixed development token, so it
can be exercised directly:

```bash
curl http://127.0.0.1:4501/api/health
curl -H "x-launcher-token: dev-session-token" http://127.0.0.1:4501/api/games
curl -H "x-launcher-token: dev-session-token" http://127.0.0.1:4501/api/user-data
curl -X PUT -H "x-launcher-token: dev-session-token" \
  http://127.0.0.1:4501/api/user-data/favourites/hexgl
```

Those writes land in `.dev-user-data/user-data.json`, so the file can be
inspected, damaged on purpose and watched being repaired.

The browser-only development mode does not call that port. `proxy.conf.json`
makes the Angular dev server forward `/api` to it, so the page sees the API at
its own origin:

```bash
curl -H "x-launcher-token: dev-session-token" http://127.0.0.1:4500/api/games
```

Without the proxy the page would be making a cross-origin request carrying a
custom header, the browser would send a preflight, and the preflight would be
refused -- which is exactly the behaviour the production setup depends on.
Proxying keeps development same-origin, like production, instead of weakening
the server to accommodate it.

The server module never imports Electron. It receives its port, token, catalog
path and user-data directory as arguments, which is what makes this possible
and what the browser-only development mode relies on.

## Project layout

```
electron/   Electron main process and preload script
shared/     Types shared between the Node side and Angular
server/     Express API, routes, middleware, the catalog and the user's data
src/app/
  core/     Services with no interface of their own: API client, bridge,
            catalog store, user data, i18n, theme
  features/ One folder per page: discover, favourites, game, settings,
            diagnostics
  shared/   Components used by more than one page
```

`shared/` is imported as `@shared/*` from Angular and through relative paths
from the Node side: `tsc` does not rewrite path aliases when it emits CommonJS,
while the Angular bundler does.

# Game Launcher

A desktop catalog of browser games: browse, search, filter, open a game page and
launch the game in the system browser. Built as a learning project around
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
**4300**, `tsc --watch` for the Node side, and `wait-on` holding Electron back
until both the dev server and `dist-node/electron/main.js` exist. No `setTimeout`
is involved in the wait.

The dev server sits on 4300 rather than the Angular default 4200 so the launcher
can run alongside other local projects. The port lives in `angular.json` and in
`shared/dev-config.ts`.

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

## Building

```bash
npm run build       # Angular bundle into dist/, Node bundle into dist-node/
```

Packaging into a `.dmg` is added in stage 7.

## Project layout

```
electron/   Electron main process and preload script
shared/     Types shared between the Node side and Angular
server/     Express API (stage 3)
src/        Angular application
```

`shared/` is imported as `@shared/*` from Angular and through relative paths
from the Node side: `tsc` does not rewrite path aliases when it emits CommonJS,
while the Angular bundler does.

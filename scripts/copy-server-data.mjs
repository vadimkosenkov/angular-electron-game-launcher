/**
 * tsc only emits JavaScript, so the catalog has to be copied into the build
 * output by hand. Keeping it next to the compiled server means the Electron
 * main process resolves one path in development and in a packaged app.
 */
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('server/data');
const target = resolve('dist-node/server/data');

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log(`[copy-server-data] ${source} -> ${target}`);

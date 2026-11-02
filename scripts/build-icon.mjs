/**
 * Draws the application icon and assembles `build/icon.icns`.
 *
 * The icon is generated rather than drawn in an editor, for the same reason
 * the game covers are: it keeps a binary blob nobody can diff out of the
 * repository, and it stays reproducible -- `npm run icon` always produces the
 * same bytes.
 *
 * Nothing here is installed. macOS ships `iconutil`, and a PNG is a handful of
 * length-prefixed chunks around zlib-compressed scanlines, which `node:zlib`
 * already provides. A rasteriser dependency would be a larger thing to trust
 * than the forty lines it replaces.
 *
 * Usage: npm run icon
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(projectRoot, 'build');
const iconsetDir = join(buildDir, 'icon.iconset');

/**
 * Apple's proportions: the artwork does not fill the canvas. A 1024 icon
 * draws an 824-wide rounded square with a 185.4 corner radius, and the margin
 * is what lets macOS line it up against every other icon in the Dock.
 */
const CONTENT_RATIO = 824 / 1024;
const RADIUS_RATIO = 185.4 / 1024;

/** The two accent blues the interface already uses, top to bottom. */
const GRADIENT_TOP = [0x4f, 0x8c, 0xff];
const GRADIENT_BOTTOM = [0x24, 0x58, 0xd8];

/** Samples per axis. Edges are drawn by coverage rather than by a hard test. */
const SUPERSAMPLE = 4;

/** What `iconutil` expects to find, and under which names. */
const ICONSET = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_16x16@2x.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 64, name: 'icon_32x32@2x.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_128x128@2x.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_256x256@2x.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' },
];

function main() {
  rmSync(iconsetDir, { recursive: true, force: true });
  mkdirSync(iconsetDir, { recursive: true });

  for (const { size, name } of ICONSET) {
    writeFileSync(join(iconsetDir, name), encodePng(size, size, drawIcon(size)));
  }

  // Kept alongside the .icns: electron-builder uses the .icns for the bundle,
  // and a plain PNG is what everything else -- a README, a store listing --
  // actually wants.
  writeFileSync(join(buildDir, 'icon.png'), encodePng(1024, 1024, drawIcon(1024)));

  execFileSync('iconutil', [
    '--convert',
    'icns',
    iconsetDir,
    '--output',
    join(buildDir, 'icon.icns'),
  ]);
  rmSync(iconsetDir, { recursive: true, force: true });

  console.log(`[icon] wrote ${join(buildDir, 'icon.icns')} and icon.png`);
}

/**
 * Draws one size from scratch rather than resampling a large one.
 *
 * At 16 pixels a downscaled 1024 icon turns into a blue smudge: the triangle
 * is thinner than the blur. Drawing each size at its own scale keeps the same
 * proportions sharp all the way down.
 */
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const margin = (size * (1 - CONTENT_RATIO)) / 2;
  const content = size * CONTENT_RATIO;
  const radius = size * RADIUS_RATIO;

  // A right-pointing triangle: this application's one job is to start
  // something somewhere else. Nudged right of centre because a triangle's
  // visual centre sits behind its geometric one.
  const triangleHeight = content * 0.46;
  const triangleWidth = triangleHeight * 0.88;
  const triangleLeft = margin + (content - triangleWidth) / 2 + content * 0.03;
  const triangleTop = margin + (content - triangleHeight) / 2;

  const step = 1 / SUPERSAMPLE;
  const offset = step / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tileCoverage = 0;
      let glyphCoverage = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const px = x + offset + sx * step;
          const py = y + offset + sy * step;

          if (insideRoundedRect(px, py, margin, margin, content, content, radius)) {
            tileCoverage += 1;
          }
          if (insideTriangle(px, py, triangleLeft, triangleTop, triangleWidth, triangleHeight)) {
            glyphCoverage += 1;
          }
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const tile = tileCoverage / samples;
      // The glyph cannot spill outside the tile, whatever the arithmetic says.
      const glyph = Math.min(glyphCoverage / samples, tile);

      const index = (y * size + x) * 4;
      pixels[index + 3] = Math.round(tile * 255);

      // Outside the tile the pixel is fully transparent, and its colour is
      // then meaningless -- left at zero rather than given a value that only
      // shows up if something ignores the alpha channel.
      if (tile === 0) {
        continue;
      }

      // Of the part of this pixel that is painted at all, this much is glyph
      // and the rest is gradient.
      const glyphShare = glyph / tile;
      const shade = y / Math.max(size - 1, 1);

      for (let channel = 0; channel < 3; channel += 1) {
        const background = mix(GRADIENT_TOP[channel], GRADIENT_BOTTOM[channel], shade);
        pixels[index + channel] = Math.round(background * (1 - glyphShare) + 255 * glyphShare);
      }
    }
  }

  return pixels;
}

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

function insideRoundedRect(px, py, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;

  if (px < left || px > right || py < top || py > bottom) {
    return false;
  }

  // Only the four corner squares need a distance test; everything else is in.
  const cx = px < left + radius ? left + radius : px > right - radius ? right - radius : px;
  const cy = py < top + radius ? top + radius : py > bottom - radius ? bottom - radius : py;

  if (cx === px && cy === py) {
    return true;
  }

  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}

/** Isosceles, pointing right: apex on the right, flat edge on the left. */
function insideTriangle(px, py, left, top, width, height) {
  if (px < left || px > left + width || py < top || py > top + height) {
    return false;
  }

  // How far along the triangle this column is, and therefore how much of it
  // is still filled at that column.
  const progress = (px - left) / width;
  const halfSpan = (height / 2) * (1 - progress);
  const middle = top + height / 2;

  return Math.abs(py - middle) <= halfSpan;
}

/**
 * The smallest PNG that is still a real PNG: signature, header, one compressed
 * image chunk and a terminator. Each chunk carries its own CRC, which is the
 * only part that needs a table.
 */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));

  for (let y = 0; y < height; y += 1) {
    // Filter type 0 (none) in front of every scanline. Better filters exist;
    // an application icon is not where compression ratio matters.
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // colour type 6: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // not interlaced

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

main();

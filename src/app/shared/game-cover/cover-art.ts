import type { Game, Genre } from '@shared/game.model';

export interface CoverShape {
  readonly kind: 'circle' | 'rect' | 'polygon';
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly rotation: number;
  readonly opacity: number;
}

export interface CoverArt {
  readonly shapes: readonly CoverShape[];
  readonly monogram: string;
  readonly accent: string;
}

export const COVER_WIDTH = 320;
export const COVER_HEIGHT = 180;

/**
 * Which primitive a genre is drawn with. Giving each family its own shape is
 * what stops sixteen generated covers from reading as one repeated texture.
 */
const MOTIFS: Record<Genre, CoverShape['kind']> = {
  action: 'polygon',
  shooter: 'polygon',
  racing: 'rect',
  puzzle: 'rect',
  board: 'rect',
  adventure: 'circle',
  sandbox: 'rect',
  idle: 'circle',
  strategy: 'circle',
  party: 'circle',
};

/**
 * Builds a game's cover from its own data.
 *
 * Deterministic on purpose: the seed is the game's id, so a cover never
 * changes between renders, between sessions or between the card and the game
 * page. Random-per-render art would make the catalog feel unstable and would
 * flicker on every filter change.
 *
 * Real cover art is not used because the games belong to other people: the
 * images are theirs, not ours to ship. `coverUrl` exists for images you do
 * have the right to use, and takes precedence over anything generated here.
 */
export function buildCoverArt(game: Game): CoverArt {
  const random = seededRandom(hash(game.id));
  const kind = MOTIFS[game.genres[0] ?? 'puzzle'];
  const count = 5 + Math.floor(random() * 4);

  const shapes: CoverShape[] = [];
  for (let index = 0; index < count; index += 1) {
    shapes.push({
      kind,
      x: Math.round(random() * COVER_WIDTH),
      y: Math.round(random() * COVER_HEIGHT),
      size: Math.round(26 + random() * 74),
      rotation: Math.round(random() * 360),
      // Kept low: the shapes are a texture behind the title, not the subject.
      opacity: Number((0.07 + random() * 0.16).toFixed(3)),
    });
  }

  return { shapes, monogram: monogramOf(game.title), accent: game.accentColor };
}

/** Up to two characters, so a long title does not turn into a word. */
function monogramOf(title: string): string {
  const words = title.split(/[\s.\-_]+/u).filter((word) => word.length > 0);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }
  return `${words[0]![0]!}${words[1]![0]!}`.toUpperCase();
}

/** FNV-1a. Small, dependency-free, and good enough to spread ids apart. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

/** mulberry32: a tiny deterministic generator, so covers are reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

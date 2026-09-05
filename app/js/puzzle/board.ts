// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/board — the rules, as pure functions over an array of numbers.
//
// ========================= THE DIRECTION IS THE TILE'S, NOT THE BLANK'S =========================
// A sliding puzzle can be described two ways and they are mirror images: "the tile moves right" and
// "the blank moves left" are the same event. The choice matters because it reaches the child.
//
// What she sees is a TILE moving. What the screen reader must say is "seven, to the left", because
// that is the thing that changed position and the thing she pressed. A description phrased around
// the blank would be correct, unreadable, and would make every announcement an inversion the
// listener has to perform in her head while the board is already moving again.
//
// So `Move.direction` is the tile's, everywhere, and the blank is never given a direction at all.
//
// ========================= AND THERE IS NO WRONG MOVE =========================
// Worth stating here because three other modules lean on it. Every legal move is reversible in one
// keypress: the inverse is always itself legal, immediately, and nothing is lost by taking it.
// That is why the hint is never locked, never counted and never penalised — there is no mistake to
// protect the child from, and gating help would mean inventing one to justify the gate.
// `apply` is reversed by the move that leads back` in the tests is that property, pinned.

import type { Board, Direction, Move } from './types.ts';

/** The finished board: 1..n^2-1 in order, blank in the last cell. */
export function solved(size: number): Board {
  const n = size * size;
  const b = new Array<number>(n);
  for (let i = 0; i < n - 1; i++) b[i] = i + 1;
  b[n - 1] = 0;
  return b;
}

/**
 * The side, read back from the length.
 *
 * ⚠️ Throws rather than rounding. A length that is not a perfect square is not a board with a bug
 * in it — it is not a board, and letting it through would produce a grid whose rows do not align
 * with its cells, three modules downstream, with no error anywhere.
 */
export function sizeOf(b: Board): number {
  const n = Math.round(Math.sqrt(b.length));
  if (n < 2 || n * n !== b.length) throw new RangeError(`not a square board: length ${b.length}`);
  return n;
}

export function isSolved(b: Board): boolean {
  const last = b.length - 1;
  for (let i = 0; i < last; i++) if (b[i] !== i + 1) return false;
  return b[last] === 0;
}

export function blankAt(b: Board): number {
  const i = b.indexOf(0);
  if (i < 0) throw new RangeError('board has no blank');
  return i;
}

/** Tile n belongs at index n-1. The blank has no home, which is why `need` is n^2-1. */
export function homeOf(tile: number): number { return tile - 1; }

/**
 * The direction a tile at `from` travels to reach `to`, given they are orthogonal neighbours.
 * Returns null when they are not — which is what makes `moveOf` a single expression.
 */
function directionOf(from: number, to: number, size: number): Direction | null {
  const dx = (to % size) - (from % size);
  const dy = Math.floor(to / size) - Math.floor(from / size);
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dy === 0 && dx === -1) return 'left';
  if (dy === 0 && dx === 1) return 'right';
  return null;
}

/**
 * The move the tile at `index` would make, or null if it cannot move (it is the blank, or it is not
 * orthogonally adjacent to the blank).
 *
 * This is the single door every input walks through: a pointer tap, Enter and Space all resolve to
 * a cell index and arrive here. Keyboard and pointer cannot drift apart if there is nowhere for
 * them to drift to.
 */
export function moveOf(b: Board, index: number): Move | null {
  const tile = b[index];
  if (tile === undefined || tile === 0) return null;
  const size = sizeOf(b);
  const to = blankAt(b);
  const direction = directionOf(index, to, size);
  return direction === null ? null : { tile, from: index, to, direction };
}

/** The two to four moves available right now. `to` is the blank for every one of them. */
export function legalMoves(b: Board): readonly Move[] {
  const size = sizeOf(b);
  const blank = blankAt(b);
  const x = blank % size;
  const y = Math.floor(blank / size);
  const out: Move[] = [];
  // Order is FIXED and declared: up, down, left, right — read as the direction the tile travels,
  // so the neighbour above the blank comes first. The solver's tie-breaking inherits this order,
  // and a deterministic hint (ADR-0049) needs it to be a decision rather than an accident of
  // whatever `Set` iteration happened to do.
  if (y + 1 < size) out.push(mustMove(b, blank + size));  // tile below the blank travels up
  if (y > 0) out.push(mustMove(b, blank - size));         // tile above travels down
  if (x + 1 < size) out.push(mustMove(b, blank + 1));     // tile right of the blank travels left
  if (x > 0) out.push(mustMove(b, blank - 1));            // tile left travels right
  return out;
}

function mustMove(b: Board, index: number): Move {
  const m = moveOf(b, index);
  if (m === null) throw new Error(`unreachable: index ${index} is adjacent to the blank`);
  return m;
}

/** A NEW board with the move made. Never mutates its input; the run keeps history-free state. */
export function apply(b: Board, m: Move): Board {
  const next = b.slice();
  next[m.to] = m.tile;
  next[m.from] = 0;
  return next;
}

/** How many tiles stand on their own home square. The blank is never counted. */
export function tilesHome(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.length; i++) if (b[i] !== 0 && homeOf(b[i]) === i) n++;
  return n;
}

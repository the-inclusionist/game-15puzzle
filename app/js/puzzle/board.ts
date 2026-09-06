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

/* ===================== THE PUSH =====================
 *
 * Clicking a tile that is not beside the blank, but IS in the blank's row or column, slides every
 * tile between them one step. It is what almost every modern sliding puzzle does and what the
 * upstream this game remakes does NOT — that one only ever shifts the single adjacent tile.
 *
 * ⚠️ THE RULES CHANGE IS SMALL AND WHAT IT REACHES IS NOT. `roleAt` and `targetsOf` are written
 * against "can this tile move right now", so widening that widens the DECLARATION: a 5x5 goes from
 * four movable tiles to eight, the sonar starts pointing at all of them, and the cane starts saying
 * "can slide" where it used to say "barred". The rule a sighted player reads off the board and the
 * sentence a blind player hears are the same field, and this is the field.
 *
 * A push is returned as the ORDERED LIST of single-tile moves it is made of, nearest the blank
 * first. Everything downstream — the animation, the announcement, the solver — keeps thinking in
 * single tiles; only the player's ACTION got bigger.
 */

/**
 * The moves a click on `index` would make: empty when the click does nothing, one move when the
 * tile is beside the blank, up to `size - 1` moves when it is at the far end of the row or column.
 */
export function pushOf(b: Board, index: number): readonly Move[] {
  const tile = b[index];
  if (tile === undefined || tile === 0) return [];
  const size = sizeOf(b);
  const blank = blankAt(b);
  const sameRow = Math.floor(index / size) === Math.floor(blank / size);
  const sameCol = index % size === blank % size;
  if (!sameRow && !sameCol) return [];

  // One step along the line, pointing from the blank TOWARD the clicked tile. The tiles travel the
  // other way — see the note on direction in `moveOf`.
  const stride = sameRow ? 1 : size;
  const step = index > blank ? stride : -stride;
  const count = Math.abs(index - blank) / stride;

  const out: Move[] = [];
  for (let k = 1; k <= count; k++) {
    const from = blank + k * step;
    const to = from - step;
    out.push({ tile: b[from], from, to, direction: directionOf(from, to, size)! });
  }
  return out;
}

/** Apply a whole push, in order. A fold over `apply`; the board is never mutated. */
export function applyPush(b: Board, push: readonly Move[]): Board {
  let next = b;
  for (const move of push) next = apply(next, move);
  return next;
}

/**
 * Every cell a click could move — the blank's whole row and column, minus the blank itself.
 *
 * This is what `targetsOf` hands the sonar. It replaces `legalMoves` there and not everywhere:
 * `legalMoves` is still what the SOLVER reasons in, because a solver that had to choose among
 * pushes would be choosing among the same states by a longer route.
 */
export function pushableFrom(b: Board): readonly number[] {
  const size = sizeOf(b);
  const blank = blankAt(b);
  const row = Math.floor(blank / size);
  const col = blank % size;
  const out: number[] = [];
  for (let x = 0; x < size; x++) if (x !== col) out.push(row * size + x);
  for (let y = 0; y < size; y++) if (y !== row) out.push(y * size + col);
  return out;
}

/**
 * Group a solver's single-tile moves into the PUSHES a player would actually press.
 *
 * The solver reasons one tile at a time and should keep doing so — a search over pushes would reach
 * the same states by a longer route. But the hint has to speak the language of the INPUT: if the
 * board takes pushes and the help talks about tiles, the two are describing the same screen in
 * different units, and the player has to translate.
 *
 * ⚠️ THE TEST FOR "SAME PUSH" IS EXACT, NOT A HEURISTIC. In one push each move's destination is the
 * previous move's origin — the blank walks a straight line, and every tile behind it steps up one.
 * So two consecutive moves belong together precisely when `b.to === a.from` and they travel the same
 * way. Nothing about distance or geometry needs checking; those two facts imply the rest.
 */
export function compressPushes(moves: readonly Move[]): readonly (readonly Move[])[] {
  const out: Move[][] = [];
  for (const move of moves) {
    const current = out[out.length - 1];
    const previous = current?.[current.length - 1];
    if (previous && move.to === previous.from && move.direction === previous.direction) current.push(move);
    else out.push([move]);
  }
  return out;
}

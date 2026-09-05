// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/types — the vocabulary of a sliding puzzle, and nothing else.
//
// ========================= THIS FOLDER IMPORTS NOTHING =========================
// Not the DOM, not PixiJS, and not the engine — not even its types. That is not purity for its own
// sake. It buys three things this game specifically needs:
//
//  · An EXHAUSTIVE 3x3 sweep. There are 181,440 solvable arrangements of a 3x3, and the solver's
//    gate walks all of them. That is affordable in a node process and unaffordable anywhere a
//    browser has to boot.
//  · A board that cannot drift from what is drawn, because there is nothing here that draws.
//  · The `Spot` type below is deliberately STRUCTURAL — it is shaped like the engine's `Spot` in
//    core/contract.ts, and the declaration hands ours straight across. Redeclaring it rather than
//    importing it keeps this folder importless; the declaration module is where the two meet, and
//    a node test there pins that they still line up.

/** index -> tile id. `0` is the blank. Frozen in practice: every operation returns a new array. */
export type Board = readonly number[];

/** The direction the TILE travels. Never the blank's direction — see the note in board.ts. */
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Move {
  /** The tile that slides. Never 0. */
  readonly tile: number;
  /** Where it starts. */
  readonly from: number;
  /** Where it lands, which is always where the blank was. */
  readonly to: number;
  readonly direction: Direction;
}

/** x is the column, y is the row. Same shape as the engine's `Spot`; see the header. */
export interface Spot { readonly x: number; readonly y: number }

export const spotOf = (index: number, size: number): Spot =>
  ({ x: index % size, y: Math.floor(index / size) });

export const indexOf = (at: Spot, size: number): number => at.y * size + at.x;

/**
 * ⚠️ The integer checks are load-bearing, not defensive noise. `roleAt` and `nameAt` are called by
 * the engine's sonar and cane with whatever `Spot` they are sweeping, and a half-step would index
 * the array at a fractional position — which in JavaScript is `undefined`, not an error, and would
 * silently answer "free" for a square that is not there.
 */
export const inBounds = (at: Spot, size: number): boolean =>
  Number.isInteger(at.x) && Number.isInteger(at.y)
  && at.x >= 0 && at.y >= 0 && at.x < size && at.y < size;

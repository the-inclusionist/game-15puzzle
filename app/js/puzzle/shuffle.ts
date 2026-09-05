// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/shuffle — scrambling, by playing the game backwards.
//
// ========================= A RANDOM PERMUTATION WOULD BE WRONG HALF THE TIME =========================
// Exactly half of the arrangements of a 15-puzzle cannot be reached from the solved board. Shuffle
// by permuting the array and one child in two is handed a puzzle that has no solution, discovers
// it only after a long time trying, and has no way to tell that from being bad at it.
//
// So we do what the upstream does, for the reason the upstream never writes down: N random LEGAL
// moves from the solved board. Every state so produced is reachable BY CONSTRUCTION, because the
// path back is the path we just walked. There is no parity check in this file and there never
// needs to be one — and the test proves it the other way round, by computing the parity invariant
// INDEPENDENTLY and asserting it holds for six hundred shuffles.
//
// ========================= TWO THINGS THE NAIVE VERSION GETS WRONG =========================
//  · WITHOUT A NO-REVERSAL RULE THE WALK UNDOES ITSELF. A random walk that may step back the way
//    it came spends much of its budget returning, and the effective depth falls far below N. On a
//    5x5 that can hand out a board that is nearly solved. Dropping the reverse of the previous
//    move is one line and it is the difference between a scramble and a stroll.
//    ⚠️ It never leaves nothing to choose: the blank has at least two neighbours everywhere on the
//    board, so removing one still leaves one.
//  · IT CAN LAND ON THE SOLVED BOARD. Rare, and the game opening already won is not a small bug —
//    it is the child being told there is nothing to do. Keep stepping if it happens.

import { apply, isSolved, legalMoves, solved } from './board.ts';
import type { Board, Move } from './types.ts';
import type { Rng } from './rng.ts';

export interface ShuffleResult {
  readonly board: Board;
  /**
   * The walk that produced it, in order.
   *
   * Returned rather than discarded so "never reverses itself" is DIRECTLY assertable instead of
   * inferred from the board it happened to produce. A property you can only infer is a property
   * whose gate goes green for the wrong reason.
   */
  readonly moves: readonly Move[];
}

/** How many extra steps to take when the walk lands on the solved board. Bounded; see below. */
const ESCAPE_BUDGET = 50;

export function shuffle(size: number, rng: Rng, count = 100): ShuffleResult {
  let board = solved(size);
  const moves: Move[] = [];
  let previous: Move | null = null;

  const step = (): void => {
    const options = legalMoves(board).filter((m) => m.from !== previous?.to);
    const chosen = options[rng.int(0, options.length - 1)];
    board = apply(board, chosen);
    moves.push(chosen);
    previous = chosen;
  };

  for (let i = 0; i < count; i++) step();

  // The walk is a random walk on a connected graph, so the solved state is one vertex among many
  // thousands and escaping it takes one step in practice. The budget is here so that a future bug
  // that made the walk stand still would FAIL rather than hang — a hung tab is the hardest kind of
  // defect to see, and the hardest of all for a child who cannot see the screen.
  for (let i = 0; isSolved(board) && i < ESCAPE_BUDGET; i++) step();
  if (isSolved(board)) throw new Error(`shuffle could not leave the solved board in ${ESCAPE_BUDGET} steps`);

  return { board, moves };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/run — one round, and everything in it dies with the round.
//
// ========================= WHY THIS IS A FACTORY =========================
// ADR-0038 cuts state by LIFETIME — page, game, run — and everything here is RUN: the board, the
// blank, the move count, the seed, the cursor. Nothing in this file is persisted and nothing is
// module-scope, so a second board size is a second `createRun` and the old one is simply dropped.
// The composition root owns the instance; that is the whole ownership story.
//
// ========================= ONE DOOR IN =========================
// `activate(index)` is where a pointer tap, an Enter and a Space all arrive. Keyboard and pointer
// cannot drift apart if there is nowhere for them to drift to — and the three outcomes it can
// report are the three things a screen reader has to be able to say.
//
// ========================= AND THE HINT IS NOT GATED =========================
// It was going to open only after the first move, on the reading of requerimento 49.e that the
// answer arrives after the attempt. That reading was wrong here, and the reason is a fact about
// this particular game rather than a policy: THERE IS NO WRONG MOVE IN A SLIDING PUZZLE. Every
// move is reversible in one keypress, nothing is lost, no state is spent, and the player simply
// moves again. A lock would have to invent a penalty in order to have something to protect, and
// inventing a penalty to justify a lock on an accessibility affordance is the pattern ADR-0049 is
// written against — with the child who most needs help on move one being exactly the child the
// game exists for.
//
// So it is free, unlimited, uncounted and unpenalised. What 49.e actually forbids is delivering the
// answer INSTEAD of the reasoning, and that line is kept elsewhere: the hint REVEALS the next few
// moves and never plays them.

import { apply, isSolved, moveOf, solved, tilesHome } from './board.ts';
import type { Board, Move } from './types.ts';
import type { Solver } from './solver.ts';

/** What activating a cell did. Every branch is something the reader has to be able to announce. */
export type Activation =
  | { readonly kind: 'moved'; readonly move: Move }
  /** A tile that exists but is not beside the blank. Not an error — the commonest tap on a board. */
  | { readonly kind: 'blocked'; readonly index: number }
  /** The empty square itself. Saying "nothing slides from here" beats saying nothing. */
  | { readonly kind: 'blank'; readonly index: number };

export interface Run {
  readonly size: number;
  /** Recorded, not hidden: determinism (ADR-0049) is only useful if the seed can be named. */
  readonly seed: number;
  board(): Board;
  moves(): number;
  cursor(): number;
  setCursor(index: number): void;
  /** The one door in. */
  activate(index: number): Activation;
  solved(): boolean;
  /** Tiles standing on their own home square — the objective's `have`. */
  tilesHome(): number;
  /** The next few moves on a solving path. Shown, never played. Empty when solved. */
  hint(count?: number): readonly Move[];
}

export interface RunOptions {
  readonly size: number;
  readonly seed: number;
  readonly solver: Solver;
  /** The scrambled board. Comes in rather than being made here: shuffling is its own module. */
  readonly board: Board;
}

export function createRun(o: RunOptions): Run {
  let board = o.board;
  let moves = 0;
  // The cursor starts on the first cell rather than on the blank. It is where a reader begins
  // reading and where a sighted keyboard player expects focus — the top-left of a grid.
  let cursor = 0;

  return {
    size: o.size,
    seed: o.seed,
    board: () => board,
    moves: () => moves,
    cursor: () => cursor,

    setCursor(index) {
      if (Number.isInteger(index) && index >= 0 && index < board.length) cursor = index;
    },

    activate(index) {
      if (!Number.isInteger(index) || index < 0 || index >= board.length) {
        return { kind: 'blocked', index };
      }
      if (board[index] === 0) return { kind: 'blank', index };
      const move = moveOf(board, index);
      if (move === null) return { kind: 'blocked', index };
      board = apply(board, move);
      moves++;
      // The cursor follows the tile. She just acted on it; her next Enter should still reach it,
      // and a cursor that stayed behind would sit on the square she has just emptied.
      cursor = move.to;
      return { kind: 'moved', move };
    },

    solved: () => isSolved(board),
    tilesHome: () => tilesHome(board),
    hint: (count = 3) => o.solver.hint(board, count),
  };
}

/**
 * A run that is already finished. Not a fixture for tests — it is what the title screen shows and
 * what a size change starts from before the scramble lands, and having one place that builds it
 * keeps "solved board, zero moves" from being spelled three different ways.
 */
export function createSolvedRun(o: Omit<RunOptions, 'board'>): Run {
  return createRun({ ...o, board: solved(o.size) });
}

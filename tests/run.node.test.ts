// SPDX-License-Identifier: AGPL-3.0-or-later
// The run is one door — `activate` — and three answers. Each answer is something the screen reader
// has to be able to say, so "returns blocked" is not an implementation detail here: it is the
// difference between a child hearing why nothing happened and a child hearing silence.

import { describe, expect, it } from 'vitest';
import { createRun, createSolvedRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { createRng } from '../app/js/puzzle/rng.ts';
import { shuffle } from '../app/js/puzzle/shuffle.ts';
import { apply, solved } from '../app/js/puzzle/board.ts';

const solver = createSolver();
const run4 = (board = shuffle(4, createRng(7)).board) =>
  createRun({ size: 4, seed: 7, solver, board });

describe('activate — the three answers', () => {
  it('moves a tile that is beside the blank, and counts it', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const before = r.board();
    const result = r.activate(14);                 // tile 15, left of the blank
    expect(result.kind).toBe('moved');
    expect(r.moves()).toBe(1);
    expect(r.board()).not.toEqual(before);
  });

  it('reports a tile that cannot move, and does NOT count it', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = r.activate(0);                  // tile 1, far from the blank
    expect(result).toEqual({ kind: 'blocked', index: 0 });
    expect(r.moves()).toBe(0);
    expect(r.board()).toEqual(solved(4));
  });

  it('reports the blank as the blank, not as blocked', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(r.activate(15)).toEqual({ kind: 'blank', index: 15 });
    expect(r.moves()).toBe(0);
  });

  it('treats an index off the board as blocked rather than throwing', () => {
    const r = run4();
    expect(r.activate(-1).kind).toBe('blocked');
    expect(r.activate(16).kind).toBe('blocked');
    expect(r.activate(1.5).kind).toBe('blocked');
    expect(r.moves()).toBe(0);
  });

  it('agrees with applying the move by hand', () => {
    const r = run4();
    const before = r.board();
    const result = r.activate(r.board().indexOf(0) - 1);   // the tile left of the blank
    expect(result.kind).toBe('moved');
    if (result.kind === 'moved') expect(r.board()).toEqual(apply(before, result.move));
  });
});

describe('the cursor', () => {
  it('starts at the top-left, where a reader starts reading', () => {
    expect(run4().cursor()).toBe(0);
  });

  it('follows the tile to where it landed', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    r.setCursor(14);
    const result = r.activate(14);
    expect(result.kind).toBe('moved');
    // The tile went to 15; the cursor is on the tile, not on the square it left behind.
    expect(r.cursor()).toBe(15);
  });

  it('does not move when the activation was refused', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    r.setCursor(0);
    r.activate(0);
    expect(r.cursor()).toBe(0);
  });

  it('ignores a cursor set off the board', () => {
    const r = run4();
    r.setCursor(5);
    r.setCursor(-1); expect(r.cursor()).toBe(5);
    r.setCursor(16); expect(r.cursor()).toBe(5);
    r.setCursor(2.5); expect(r.cursor()).toBe(5);
  });
});

describe('the objective', () => {
  it('counts tiles at home, and the blank never counts', () => {
    expect(createSolvedRun({ size: 4, seed: 1, solver }).tilesHome()).toBe(15);
    expect(createSolvedRun({ size: 3, seed: 1, solver }).tilesHome()).toBe(8);
    expect(createSolvedRun({ size: 5, seed: 1, solver }).tilesHome()).toBe(24);
  });

  it('knows when it is finished', () => {
    expect(createSolvedRun({ size: 4, seed: 1, solver }).solved()).toBe(true);
    expect(run4().solved()).toBe(false);
  });

  it('reaches solved by playing the hints it gives', () => {
    const r = run4();
    for (let guard = 0; guard < 500 && !r.solved(); guard++) {
      const [next] = r.hint(1);
      expect(next, 'a hint on an unsolved board').toBeDefined();
      expect(r.activate(next.from).kind).toBe('moved');
    }
    expect(r.solved()).toBe(true);
  });
});

describe('the hint is not gated', () => {
  // The decision this pins: there is no wrong move in a sliding puzzle, so there is no penalty for
  // a lock to protect, and a lock on an accessibility affordance would have to invent one.
  it('is available before the first move', () => {
    expect(run4().hint()).toHaveLength(3);
  });

  it('is still available after twenty moves, and after being used', () => {
    const r = run4();
    for (let i = 0; i < 20; i++) {
      const [next] = r.hint(1);
      r.activate(next.from);
    }
    expect(r.hint().length).toBeGreaterThan(0);
  });

  it('never costs a move by itself', () => {
    const r = run4();
    r.hint(); r.hint(); r.hint();
    expect(r.moves()).toBe(0);
    expect(r.board()).toEqual(shuffle(4, createRng(7)).board);
  });

  it('shows three by default and honours a different count', () => {
    const r = run4();
    expect(r.hint()).toHaveLength(3);
    expect(r.hint(1)).toHaveLength(1);
    expect(r.hint(5)).toHaveLength(5);
  });

  it('is empty on a solved board', () => {
    expect(createSolvedRun({ size: 4, seed: 1, solver }).hint()).toEqual([]);
  });
});

describe('a new run', () => {
  it('carries its seed so the board can be reproduced', () => {
    const seed = 20260905;
    const r = createRun({ size: 5, seed, solver, board: shuffle(5, createRng(seed)).board });
    expect(r.seed).toBe(seed);
    expect(r.board()).toEqual(shuffle(5, createRng(seed)).board);
  });

  it('starts at zero moves whatever the board', () => {
    expect(run4().moves()).toBe(0);
    expect(createSolvedRun({ size: 3, seed: 1, solver }).moves()).toBe(0);
  });

  it('does not share state with another run', () => {
    const a = run4(); const b = run4();
    a.activate(a.board().indexOf(0) - 1);
    expect(b.moves()).toBe(0);
    expect(b.board()).toEqual(shuffle(4, createRng(7)).board);
  });
});

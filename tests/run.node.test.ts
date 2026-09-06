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
    if (result.kind === 'moved') expect(r.board()).toEqual(apply(before, result.push[0]));
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
      const [press] = r.hint(1);
      expect(press, 'a hint on an unsolved board').toBeDefined();
      // Press the far end of the push, which is the click the hint is describing.
      expect(r.activate(press[press.length - 1].from).kind).toBe('moved');
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
      const [press] = r.hint(1);
      r.activate(press[press.length - 1].from);
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

describe('a press is the unit of record', () => {
  // ⚠️ THE DECISION, IN ONE PAIR OF TESTS. The counter is a record of what the PLAYER DID (ADR-0049),
  // and she did one thing — so a press that slides three tiles counts one. The same displacement made
  // one press at a time counts three, because that is three things she did. Counting tiles instead
  // would make the counter rise fastest for the most efficient move on the board, which is the
  // opposite of a work log.
  it('counts ONE for a press that slides three tiles', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = r.activate(12);                 // the far end of the blank's row
    expect(result.kind).toBe('moved');
    if (result.kind === 'moved') expect(result.push).toHaveLength(3);
    expect(r.moves()).toBe(1);
  });

  it('counts THREE when she makes the same displacement one press at a time', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    r.activate(14); r.activate(13); r.activate(12);
    expect(r.moves()).toBe(3);
    // And it is the same board either way — the record differs, the position does not.
    const oneGo = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    oneGo.activate(12);
    expect(r.board()).toEqual(oneGo.board());
  });

  it('reports the whole push, so the announcement can be one sentence', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = r.activate(3);                  // three tiles down the blank's column
    if (result.kind !== 'moved') throw new Error('expected a move');
    expect(result.push).toHaveLength(3);
    for (const move of result.push) expect(move.direction).toBe('down');
  });

  it('refuses a tile in neither the row nor the column, and says so', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(r.activate(0)).toEqual({ kind: 'blocked', index: 0 });
    expect(r.moves()).toBe(0);
  });

  it('leaves the cursor on the tile she pressed, which moved one cell', () => {
    const r = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    r.activate(12);
    // Every tile in a push moves ONE cell, so the tile from 12 is now at 13 — and the blank is at 12.
    expect(r.cursor()).toBe(13);
    expect(r.board()[12]).toBe(0);
  });
});

describe('the hint speaks in presses', () => {
  it('returns pushes, not single tiles', () => {
    const r = run4();
    for (const press of r.hint(3)) {
      expect(press.length).toBeGreaterThanOrEqual(1);
      // Every tile in one press travels the same way — that is what makes it one press.
      for (const move of press) expect(move.direction).toBe(press[0].direction);
    }
  });

  it('gives a press the player can actually make in one click', () => {
    const r = run4();
    const [press] = r.hint(1);
    const clicked = press[press.length - 1].from;
    const result = r.activate(clicked);
    expect(result.kind).toBe('moved');
    if (result.kind === 'moved') expect(result.push).toHaveLength(press.length);
  });

  it('compresses a straight run the solver reported as separate moves', () => {
    // A board one straight push away from solved: the solver sees three moves, the player sees one
    // click, and the hint has to agree with the player.
    const r = createRun({ size: 4, seed: 1, solver, board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15] });
    const presses = r.hint(3);
    expect(presses).toHaveLength(1);
    expect(presses[0]).toHaveLength(3);
  });
});

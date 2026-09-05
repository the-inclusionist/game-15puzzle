// SPDX-License-Identifier: AGPL-3.0-or-later
// The board is the whole game, and it is a pure function of an array of numbers. Everything here
// runs without a DOM, without PixiJS and without the engine — which is the pressure that keeps the
// puzzle's rules out of the renderer, and it is the ONE property that makes an exhaustive 3x3
// sweep affordable later in solver.node.test.ts.

import { describe, expect, it } from 'vitest';
import {
  apply, blankAt, homeOf, isSolved, legalMoves, moveOf, sizeOf, solved, tilesHome,
} from '../app/js/puzzle/board.ts';
import { indexOf, inBounds, spotOf } from '../app/js/puzzle/types.ts';

describe('solved', () => {
  it('lays the tiles in order with the blank last', () => {
    expect(solved(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(solved(4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    expect(solved(5)).toHaveLength(25);
    expect(solved(5)[24]).toBe(0);
  });

  it('is solved, and says so', () => {
    for (const n of [3, 4, 5]) expect(isSolved(solved(n))).toBe(true);
  });
});

describe('sizeOf', () => {
  it('reads the side from the length', () => {
    expect(sizeOf(solved(3))).toBe(3);
    expect(sizeOf(solved(5))).toBe(5);
  });

  // A board that is not a perfect square is not a board with a bug in it — it is not a board.
  // Throwing here is what stops a wrong length becoming a wrong grid three modules downstream.
  it('throws on a length that is not a perfect square', () => {
    expect(() => sizeOf([1, 2, 3, 0])).not.toThrow();   // 4 IS 2x2
    expect(() => sizeOf([1, 2, 0])).toThrow();
    expect(() => sizeOf([])).toThrow();
  });
});

describe('homeOf', () => {
  it('sends tile n to index n-1', () => {
    expect(homeOf(1)).toBe(0);
    expect(homeOf(15)).toBe(14);
  });
});

describe('blankAt', () => {
  it('finds the one zero', () => {
    expect(blankAt(solved(4))).toBe(15);
    expect(blankAt([0, 1, 2, 3])).toBe(0);
  });
});

describe('legalMoves', () => {
  // ZOMBIES: the boundaries are the interesting cases, and on a grid every boundary is a corner
  // or an edge. A blank in the middle has four neighbours; nothing else does.
  it('offers two moves from a corner, three from an edge, four from the middle', () => {
    expect(legalMoves(solved(3))).toHaveLength(2);              // blank at index 8, bottom-right
    expect(legalMoves([1, 2, 3, 4, 5, 6, 7, 0, 8])).toHaveLength(3);  // index 7, bottom edge
    expect(legalMoves([1, 2, 3, 4, 0, 6, 7, 5, 8])).toHaveLength(4);  // index 4, centre
  });

  it('never offers a diagonal', () => {
    const board = [1, 2, 3, 4, 0, 6, 7, 5, 8];
    const blank = 4;
    for (const m of legalMoves(board)) {
      const a = spotOf(m.from, 3);
      const b = spotOf(blank, 3);
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it('names the direction the TILE travels, not the blank', () => {
    // Blank at the centre of a 3x3. The tile ABOVE it travels DOWN to reach it.
    const board = [1, 2, 3, 4, 0, 6, 7, 5, 8];
    const byFrom = new Map(legalMoves(board).map((m) => [m.from, m.direction]));
    expect(byFrom.get(1)).toBe('down');    // from above
    expect(byFrom.get(7)).toBe('up');      // from below
    expect(byFrom.get(3)).toBe('right');   // from the left
    expect(byFrom.get(5)).toBe('left');    // from the right
  });

  it('always lands on the blank', () => {
    const board = [1, 2, 3, 4, 0, 6, 7, 5, 8];
    for (const m of legalMoves(board)) expect(m.to).toBe(blankAt(board));
  });
});

describe('moveOf', () => {
  it('is null for the blank itself', () => {
    expect(moveOf(solved(4), 15)).toBeNull();
  });

  it('is null for a tile that is not adjacent to the blank', () => {
    expect(moveOf(solved(4), 0)).toBeNull();
  });

  it('agrees with legalMoves for every cell', () => {
    const board = [5, 1, 3, 4, 2, 0, 7, 8, 6];
    const legal = new Set(legalMoves(board).map((m) => m.from));
    for (let i = 0; i < 9; i++) expect(moveOf(board, i) !== null).toBe(legal.has(i));
  });
});

describe('apply', () => {
  it('swaps the tile with the blank', () => {
    const before = solved(3);                       // [1..8, 0]
    const move = moveOf(before, 7)!;                // tile 8 slides down
    const after = apply(before, move);
    expect(after[8]).toBe(8);
    expect(after[7]).toBe(0);
  });

  // Right-BICEP, the inverse relationship: this is what makes "no wrong move" true, and the whole
  // reason the hint is never locked. Every move is one keypress from being undone.
  it('is reversed by the move that leads back', () => {
    const before = [5, 1, 3, 4, 2, 0, 7, 8, 6];
    const forth = moveOf(before, 4)!;
    const mid = apply(before, forth);
    const back = moveOf(mid, forth.to)!;
    expect(apply(mid, back)).toEqual(before);
  });

  it('never mutates its input', () => {
    const before = solved(3);
    const copy = before.slice();
    apply(before, moveOf(before, 7)!);
    expect(before).toEqual(copy);
  });
});

describe('tilesHome', () => {
  it('counts every tile but the blank when solved', () => {
    expect(tilesHome(solved(3))).toBe(8);
    expect(tilesHome(solved(4))).toBe(15);
    expect(tilesHome(solved(5))).toBe(24);
  });

  // The blank is not a tile in the objective's sense: `need` is n^2 - 1 precisely because the
  // empty square has no home to be in.
  it('does not credit the blank for sitting in the last cell', () => {
    const nearlyDone = solved(3).slice();
    [nearlyDone[6], nearlyDone[7]] = [nearlyDone[7], nearlyDone[6]];
    expect(tilesHome(nearlyDone)).toBe(6);
  });
});

describe('types', () => {
  it('round-trips index and spot for every cell of every size', () => {
    for (const n of [3, 4, 5]) {
      for (let i = 0; i < n * n; i++) expect(indexOf(spotOf(i, n), n)).toBe(i);
    }
  });

  it('rejects a spot outside the grid, including a fractional one', () => {
    expect(inBounds({ x: 0, y: 0 }, 4)).toBe(true);
    expect(inBounds({ x: 3, y: 3 }, 4)).toBe(true);
    expect(inBounds({ x: -1, y: 0 }, 4)).toBe(false);
    expect(inBounds({ x: 4, y: 0 }, 4)).toBe(false);
    expect(inBounds({ x: 0.5, y: 0 }, 4)).toBe(false);
  });
});

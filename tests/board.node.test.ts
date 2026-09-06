// SPDX-License-Identifier: AGPL-3.0-or-later
// The board is the whole game, and it is a pure function of an array of numbers. Everything here
// runs without a DOM, without PixiJS and without the engine — which is the pressure that keeps the
// puzzle's rules out of the renderer, and it is the ONE property that makes an exhaustive 3x3
// sweep affordable later in solver.node.test.ts.

import { describe, expect, it } from 'vitest';
import {
  apply, applyPush, blankAt, compressPushes, homeOf, isSolved, legalMoves, moveOf, pushOf,
  pushableFrom, sizeOf, solved, tilesHome,
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

describe('pushOf — one press, several tiles', () => {
  // A solved 4x4 has the blank at index 15, which is row 3, column 3.
  const board = solved(4);

  it('slides one tile when the click is next to the blank', () => {
    const push = pushOf(board, 14);
    expect(push).toHaveLength(1);
    expect(push[0]).toEqual({ tile: 15, from: 14, to: 15, direction: 'right' });
  });

  it('slides two, three and four, along a row', () => {
    expect(pushOf(board, 13)).toHaveLength(2);
    expect(pushOf(board, 12)).toHaveLength(3);
    expect(pushOf(solved(5), 20)).toHaveLength(4);      // 5x5: blank at 24, click the far end
  });

  it('slides along a column just the same', () => {
    const push = pushOf(board, 3);                      // same column as the blank, three rows up
    expect(push).toHaveLength(3);
    for (const move of push) expect(move.direction).toBe('down');
  });

  // ⚠️ THE CASE THAT SEPARATES A PUSH FROM A FREE-FOR-ALL. The opposite corner shares neither the
  // row nor the column, so no single finger movement could produce it — and nothing should pretend
  // otherwise by moving tiles round a bend.
  it('does nothing for a tile in neither the row nor the column', () => {
    expect(pushOf(board, 0)).toEqual([]);
    expect(pushOf(board, 5)).toEqual([]);
    expect(pushOf(solved(5), 0)).toEqual([]);
  });

  it('does nothing for the blank itself, or for a cell off the board', () => {
    expect(pushOf(board, 15)).toEqual([]);
    expect(pushOf(board, 99)).toEqual([]);
  });

  it('orders the moves from the blank outwards, each landing where the last one started', () => {
    const push = pushOf(board, 12);
    expect(push[0].to).toBe(15);                        // the first one fills the blank
    for (let i = 1; i < push.length; i++) expect(push[i].to).toBe(push[i - 1].from);
  });

  it('leaves the blank exactly where the click was', () => {
    for (const index of [14, 13, 12, 3, 7, 11]) {
      const after = applyPush(board, pushOf(board, index));
      expect(after.indexOf(0), `click ${index}`).toBe(index);
    }
  });

  it('moves every tile exactly ONE cell, however long the push', () => {
    const push = pushOf(board, 12);
    const after = applyPush(board, push);
    for (const move of push) {
      expect(Math.abs(move.to - move.from)).toBe(1);
      expect(after[move.to]).toBe(move.tile);
    }
  });

  it('is the same thing as playing its moves one at a time', () => {
    let byHand = board;
    for (const move of pushOf(board, 12)) byHand = apply(byHand, move);
    expect(applyPush(board, pushOf(board, 12))).toEqual(byHand);
  });

  it('is undone by pushing back from the other end', () => {
    const after = applyPush(board, pushOf(board, 12));
    expect(applyPush(after, pushOf(after, 15))).toEqual(board);
  });
});

describe('pushableFrom — what a click could reach', () => {
  it('is the row and the column, minus the blank', () => {
    for (const n of [3, 4, 5]) {
      const cells = pushableFrom(solved(n));
      expect(cells, `size ${n}`).toHaveLength(2 * (n - 1));
      expect(new Set(cells).size, `size ${n}`).toBe(cells.length);   // the blank is not counted twice
    }
  });

  it('agrees with pushOf on every cell of the board', () => {
    const b = solved(4);
    const reachable = new Set(pushableFrom(b));
    for (let i = 0; i < 16; i++) expect(pushOf(b, i).length > 0, `cell ${i}`).toBe(reachable.has(i));
  });
});

describe('compressPushes — the solver speaks tiles, the player presses lines', () => {
  it('leaves a lone move as a press of one', () => {
    const moves = pushOf(solved(4), 14);
    expect(compressPushes(moves)).toEqual([moves]);
  });

  it('gathers a straight run into a single press', () => {
    const moves = pushOf(solved(4), 12);
    const pressed = compressPushes(moves);
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveLength(3);
  });

  it('breaks when the blank turns a corner', () => {
    const b = solved(4);
    const along = pushOf(b, 13);                        // two tiles rightwards
    const after = applyPush(b, along);
    const down = pushOf(after, 5);                      // then a different line
    expect(compressPushes([...along, ...down])).toHaveLength(2);
  });

  it('breaks when the direction reverses, even along the same line', () => {
    const b = solved(4);
    const out = pushOf(b, 14);
    const after = applyPush(b, out);
    const back = pushOf(after, 15);
    expect(compressPushes([...out, ...back])).toHaveLength(2);
  });

  it('loses no move and keeps the order', () => {
    const moves = [...pushOf(solved(4), 12)];
    expect(compressPushes(moves).flat()).toEqual(moves);
    expect(compressPushes([])).toEqual([]);
  });
});

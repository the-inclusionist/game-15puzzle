// SPDX-License-Identifier: AGPL-3.0-or-later
// The scramble's one job is to hand out a board that CAN be solved. This file proves it the hard
// way: by computing the solvability invariant from first principles, with no help from the module
// under test, and asserting it over six hundred boards.

import { describe, expect, it } from 'vitest';
import { createRng } from '../app/js/puzzle/rng.ts';
import { shuffle } from '../app/js/puzzle/shuffle.ts';
import { apply, isSolved, legalMoves, solved, tilesHome } from '../app/js/puzzle/board.ts';
import type { Board } from '../app/js/puzzle/types.ts';

/**
 * The parity invariant, computed INDEPENDENTLY of how the board was made.
 *
 *  · odd width  — solvable iff the number of inversions is even.
 *  · even width — solvable iff (inversions + the blank's row counted from the BOTTOM, 1-based)
 *                 is odd.
 *
 * This is deliberately a different argument from the module's ("reachable because we walked here"),
 * so the two can disagree. A test that reused the module's own reasoning would agree with it even
 * when both were wrong.
 */
function isSolvable(b: Board, size: number): boolean {
  const tiles = b.filter((t) => t !== 0);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  }
  if (size % 2 === 1) return inversions % 2 === 0;
  const rowFromBottom = size - Math.floor(b.indexOf(0) / size);
  return (inversions + rowFromBottom) % 2 === 1;
}

describe('isSolvable (the test\'s own yardstick)', () => {
  // A yardstick nobody checks is a yardstick that can be wrong in the same direction as the code.
  it('accepts the solved board at every size', () => {
    for (const n of [3, 4, 5]) expect(isSolvable(solved(n), n)).toBe(true);
  });

  it('rejects the classic unsolvable board — 14 and 15 swapped', () => {
    const b = solved(4).slice();
    [b[12], b[13]] = [b[13], b[12]];
    expect(isSolvable(b, 4)).toBe(false);
  });

  it('agrees with itself after any legal move', () => {
    let b = solved(4);
    for (let i = 0; i < 50; i++) {
      b = apply(b, legalMoves(b)[i % legalMoves(b).length]);
      expect(isSolvable(b, 4)).toBe(true);
    }
  });
});

describe('shuffle', () => {
  it('produces a solvable board for 200 seeds at every size', () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 200; seed++) {
        const { board } = shuffle(n, createRng(seed));
        expect(isSolvable(board, n), `size ${n}, seed ${seed}`).toBe(true);
      }
    }
  });

  it('is reproducible: the same seed gives the same board AND the same walk', () => {
    for (const n of [3, 4, 5]) {
      const a = shuffle(n, createRng(4242));
      const b = shuffle(n, createRng(4242));
      expect(a.board).toEqual(b.board);
      expect(a.moves).toEqual(b.moves);
    }
  });

  it('is not the same for different seeds', () => {
    const a = shuffle(4, createRng(1));
    const b = shuffle(4, createRng(2));
    expect(a.board).not.toEqual(b.board);
  });

  // The rule that separates a scramble from a stroll. Asserted on the WALK, which is why the walk
  // is returned: inferring it from the resulting board would pass for the wrong reason.
  it('never immediately reverses the move it just made', () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 50; seed++) {
        const { moves } = shuffle(n, createRng(seed));
        for (let i = 1; i < moves.length; i++) {
          expect(moves[i].tile, `size ${n}, seed ${seed}, step ${i}`).not.toBe(moves[i - 1].tile);
        }
      }
    }
  });

  it('never hands back the solved board', () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 200; seed++) expect(isSolved(shuffle(n, createRng(seed)).board)).toBe(false);
    }
  });

  // Not a strict floor — a random walk can genuinely wander back near home — but a scramble that
  // routinely arrived with most tiles seated would mean the no-reversal rule had stopped working.
  it('leaves most tiles away from home on average', () => {
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) total += tilesHome(shuffle(4, createRng(seed)).board);
    expect(total / 100).toBeLessThan(4);   // out of 15
  });

  it('takes exactly the number of steps it was asked for, when it need not escape', () => {
    expect(shuffle(4, createRng(7), 30).moves).toHaveLength(30);
  });
});

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(99); const b = createRng(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('does not share state between instances', () => {
    const a = createRng(5); const b = createRng(5);
    a.next(); a.next(); a.next();
    expect(b.next()).toBe(createRng(5).next());
  });

  it('stays inside [0, 1)', () => {
    const r = createRng(1234);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() covers both ends of its range and never leaves it', () => {
    const r = createRng(777);
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const v = r.int(3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });
});

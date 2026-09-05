// SPDX-License-Identifier: AGPL-3.0-or-later
// The solver's failure mode is not a wrong answer — it is a HANG, and a hung tab is invisible to a
// child who cannot see the screen. So this file is built around the three legs of the termination
// argument in solver.ts, and every one of the four named impasses gets a HAND-BUILT fixture. A
// random corpus reaches the already-swapped case far too rarely to be a gate; it would go green for
// years and then fail on a child's board.

import { describe, expect, it } from 'vitest';
import {
  buildEndgame, createSolver, rank, readSub, subNeighbours, unrank,
} from '../app/js/puzzle/solver.ts';
import { apply, isSolved, legalMoves, moveOf, solved } from '../app/js/puzzle/board.ts';
import { shuffle } from '../app/js/puzzle/shuffle.ts';
import { createRng } from '../app/js/puzzle/rng.ts';
import { isSolvable } from './solvability.ts';
import type { Board, Move } from '../app/js/puzzle/types.ts';

const solver = createSolver();

/** Walk a path, checking every step is legal on the board it is played on. */
function play(start: Board, moves: readonly Move[]): Board {
  let b = start;
  for (const m of moves) {
    const legal = legalMoves(b);
    expect(legal.some((l) => l.from === m.from && l.to === m.to && l.tile === m.tile)).toBe(true);
    b = apply(b, m);
  }
  return b;
}

describe('the permutation code', () => {
  it('round-trips every one of the 362,880 arrangements', () => {
    for (let i = 0; i < 362880; i++) expect(rank(unrank(i))).toBe(i);
  });

  it('ranks the identity at zero', () => {
    expect(rank([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(0);
  });
});

describe('the 3x3 endgame table', () => {
  const table = buildEndgame();

  it('reaches exactly half of the arrangements', () => {
    let reachable = 0;
    for (let i = 0; i < table.length; i++) if (table[i] !== 255) reachable++;
    expect(reachable).toBe(181440);
  });

  // ⚠️ THE INDEPENDENT CHECK. `d(solved) = 0` and `d(s) = 1 + min d(neighbour)` determine the
  // distance function uniquely — so a table satisfying both IS the distance function, whatever
  // procedure produced it. This is an argument the construction never makes, which is the only
  // kind of check worth writing about a lookup table.
  it('satisfies the Bellman condition at every reachable state', () => {
    for (let i = 0; i < table.length; i++) {
      const d = table[i];
      if (d === 255) continue;
      const perm = unrank(i);
      const p = perm.indexOf(8);
      const neighbours = subNeighbours(p).map((q) => {
        const next = perm.slice();
        [next[p], next[q]] = [next[q], next[p]];
        return table[rank(next)];
      });
      if (d === 0) {
        expect(i).toBe(rank([0, 1, 2, 3, 4, 5, 6, 7, 8]));
        continue;
      }
      // Reachability is symmetric — every move is reversible — so no neighbour of a reachable
      // state is ever unreachable. If one were, this would catch it as a 255 in the minimum.
      expect(Math.min(...neighbours)).toBe(d - 1);
    }
  }, 60_000);

  it('never leaves a reachable state next to an unreachable one', () => {
    for (let i = 0; i < table.length; i++) {
      if (table[i] === 255) continue;
      const perm = unrank(i);
      const p = perm.indexOf(8);
      for (const q of subNeighbours(p)) {
        const next = perm.slice();
        [next[p], next[q]] = [next[q], next[p]];
        expect(table[rank(next)]).not.toBe(255);
      }
    }
  }, 60_000);
});

describe('readSub — the seam between a real board and the table', () => {
  it('reads the identity from a solved board at every size', () => {
    expect(readSub(solved(3), 3, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readSub(solved(4), 4, 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readSub(solved(5), 5, 2)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('labels the blank 8 wherever it sits in the sub-board', () => {
    const b = solved(4).slice();
    [b[15], b[14]] = [b[14], b[15]];         // blank up one cell
    expect(readSub(b, 4, 1).indexOf(8)).toBe(7);
  });

  it('refuses a tile that does not belong in the final 3x3', () => {
    const b = solved(4).slice();
    [b[0], b[5]] = [b[5], b[0]];             // tile 1 dragged into the sub-board
    expect(() => readSub(b, 4, 1)).toThrow();
  });
});

describe('solve — the named impasses, hand-built', () => {
  /**
   * ⚠️ EVERY FIXTURE IS GUARDED. Swapping two tiles on a solved board FLIPS THE PARITY, so the
   * obvious way to write "the last two of the row, exactly swapped" produces the classic UNSOLVABLE
   * board — the solver rightly throws, and the failure reads as a solver bug for as long as it
   * takes to notice. Each fixture below therefore carries a second, compensating transposition far
   * from the cells under test, and this guard is what says so out loud.
   */
  const fixture = (size: number, cells: readonly number[]): Board => {
    expect(cells).toHaveLength(size * size);
    expect(isSolvable(cells, size), 'the fixture itself must be reachable').toBe(true);
    return cells;
  };

  // 1. THE LAST TWO OF A ROW, out of place and in the row. Seating one and then the other deadlocks:
  //    the second necessarily displaces the first.
  it('closes a row whose last two tiles are both away from home', () => {
    const b = fixture(4, [1, 2, 4, 8, 5, 6, 7, 3, 10, 9, 11, 12, 13, 15, 14, 0]);
    expect(isSolved(play(b, solver.solve(b)))).toBe(true);
  });

  // 2. THE ALREADY-SWAPPED CASE, which is the one a random corpus almost never reaches. Cells 0 and
  //    1 of the row are already home, so the solver walks straight into the pair sitting in its own
  //    target squares, the wrong way round. 6 and 5 carry the compensating transposition.
  it('closes a row whose last two tiles sit in their targets, swapped', () => {
    const b = fixture(4, [1, 2, 4, 3, 6, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    expect(b[2]).toBe(4); expect(b[3]).toBe(3);
    expect(isSolved(play(b, solver.solve(b)))).toBe(true);
  });

  // 3. THE MIRROR. Row 0 is closed and tile 5 is home, so the solver reaches column 0's pair — 9 and
  //    13 — sitting in their targets, swapped. 15 and 14 compensate.
  it('closes a column whose last two tiles sit in their targets, swapped', () => {
    const b = fixture(4, [1, 2, 3, 4, 5, 6, 7, 8, 13, 10, 11, 12, 9, 15, 14, 0]);
    expect(b[8]).toBe(13); expect(b[12]).toBe(9);
    expect(isSolved(play(b, solver.solve(b)))).toBe(true);
  });

  // 4. THE FINAL CORNER — the 2x2 endgame, which is a pure three-cycle of the three tiles around a
  //    blank that never leaves home. Three tiles cycling is an EVEN permutation and the blank does
  //    not move, so this one needs no compensating swap — and that is exactly why the cycle is
  //    written over the three TILES and not over the blank as well. A cycle that carried the blank
  //    with it would move it an odd number of steps against an even permutation, which is the
  //    unsolvable half of the board and not a hard case at all.
  //    At most three rotations solve it; anything that loops here loops forever.
  it('closes a three-cycle in the final corner at every size', () => {
    for (const n of [3, 4, 5]) {
      const cells = solved(n).slice();
      const last = n * n - 1;
      const [x, y, z] = [last - n - 1, last - n, last - 1];   // the 2x2, minus the blank's corner
      const tmp = cells[x]; cells[x] = cells[z]; cells[z] = cells[y]; cells[y] = tmp;
      const b = fixture(n, cells);
      expect(isSolved(play(b, solver.solve(b))), `size ${n}`).toBe(true);
    }
  });

  it('returns an empty path for a board that is already solved', () => {
    for (const n of [3, 4, 5]) expect(solver.solve(solved(n))).toHaveLength(0);
  });

  // The 5x5 runs the pair search TWICE, the second time in a shrunken rectangle — which is the same
  // text but not the same situation. 23 and 22 carry the compensating transposition.
  it('survives a 5x5 whose first row has its last two swapped', () => {
    const b = fixture(5, [
      1, 2, 3, 5, 4,
      6, 7, 8, 9, 10,
      11, 12, 13, 14, 15,
      16, 17, 18, 19, 20,
      21, 23, 22, 24, 0,
    ]);
    expect(isSolved(play(b, solver.solve(b)))).toBe(true);
  });
});

describe('solve — the corpus', () => {
  it('solves every scramble at 3x3, 4x4 and 5x5', () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 300; seed++) {
        const { board } = shuffle(n, createRng(seed));
        const path = solver.solve(board);
        expect(isSolved(play(board, path)), `size ${n}, seed ${seed}`).toBe(true);
      }
    }
  }, 120_000);

  it('stays inside a step budget that a hung solver would blow', () => {
    // Not a quality bar — a bound that a loop cannot satisfy. A layered solve is far from optimal
    // and that is fine; what is not fine is a path that grows without end.
    const bounds: Record<number, number> = { 3: 40, 4: 200, 5: 500 };
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 100; seed++) {
        const { board } = shuffle(n, createRng(seed));
        expect(solver.solve(board).length, `size ${n}, seed ${seed}`).toBeLessThanOrEqual(bounds[n]);
      }
    }
  }, 120_000);

  it('reaches the 3x3 optimum, because that part is a table and not a heuristic', () => {
    const table = buildEndgame();
    for (let seed = 1; seed <= 200; seed++) {
      const { board } = shuffle(3, createRng(seed));
      expect(solver.solve(board)).toHaveLength(table[rank(readSub(board, 3, 0))]);
    }
  });
});

describe('nextMove and hint', () => {
  it('gives a legal move that the solver itself would play', () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 50; seed++) {
        const { board } = shuffle(n, createRng(seed));
        const next = solver.nextMove(board)!;
        expect(moveOf(board, next.from)).toEqual(next);
      }
    }
  });

  it('is null and empty on a solved board', () => {
    expect(solver.nextMove(solved(4))).toBeNull();
    expect(solver.hint(solved(4))).toEqual([]);
  });

  // ADR-0049: a hint is a reward, and every reward is deterministic. Two solvers, two runs, one
  // answer — otherwise the fixtures rot and two children on two machines get different help.
  it('is deterministic across solver instances', () => {
    const other = createSolver();
    for (let seed = 1; seed <= 50; seed++) {
      const { board } = shuffle(4, createRng(seed));
      expect(solver.hint(board)).toEqual(other.hint(board));
    }
  });

  it('shows three moves by default, and they are playable in order', () => {
    const { board } = shuffle(4, createRng(11));
    const three = solver.hint(board);
    expect(three).toHaveLength(3);
    expect(isSolved(play(board, three))).toBe(false);   // it reveals a road, it does not drive it
  });

  it('shows fewer than three when fewer than three remain', () => {
    const b = solved(4).slice();
    [b[14], b[15]] = [b[15], b[14]];        // one move from solved
    expect(solver.hint(b)).toHaveLength(1);
  });
});

describe('solve — the failure paths throw rather than loop', () => {
  it('throws on an unsolvable board instead of searching forever', () => {
    const b = solved(4).slice();
    [b[12], b[13]] = [b[13], b[12]];        // 13 and 14 swapped: parity broken, unreachable
    expect(() => solver.solve(b)).toThrow();
  });

  it('throws on an unsolvable 3x3 too', () => {
    const b = solved(3).slice();
    [b[0], b[1]] = [b[1], b[0]];
    expect(() => solver.solve(b)).toThrow();
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/solver — the hint, and it is taught rather than computed.
//
// ========================= WHY LAYERED AND NOT IDA* =========================
// The optimal solution to a 15-puzzle is expensive to find and the optimal solution to a 5x5 is out
// of reach for a browser. But a HINT does not need to be optimal — it needs to be legal and to make
// progress. So this solves the way a person is taught: close the top row, close the left column,
// and the board has shrunk; repeat until a 3x3 is left, and finish that from a table.
//
// That is a better answer than an optimal one for the same reason it is a cheaper one: a child can
// be told WHY the move is the move. "It is putting the first row in place" is a sentence. The
// output of a heuristic search is not.
//
// ========================= THE PLACEMENTS ARE SEARCHED, NOT STEERED =========================
// ⚠️ THIS IS THE PART THAT WAS WRITTEN TWICE, AND THE FIRST VERSION IS WHY. It steered each tile
// toward its target one cell at a time, walking the blank around it — the way the technique is
// taught — with hand-written escapes for the four configurations where that deadlocks. A corpus of
// three hundred scrambles found a fifth on the first run: once the top row's last cell is settled,
// the cell beside it becomes a one-cell pocket whose only exit is the square the second tile has to
// pass through. Whoever is in the pocket cannot leave, and no ordering of the hand-written escapes
// gets out of it. That is not a bug in one of the escapes. It is what steering costs.
//
// So a placement is a BREADTH-FIRST SEARCH over the positions of the tile — or of the PAIR of
// tiles — and the blank, and nothing else. The abstraction is exact, which is the whole reason it
// is allowed: the other unsettled tiles are interchangeable here, since the blank swapping with one
// of them is legal whatever number is painted on it. So the triple (a, b, blank) determines the
// legal moves completely. At most 25 * 24 * 23 = 13,800 states for a 5x5, searched in about a
// millisecond.
//
// What that buys, and it is the whole argument for the rewrite:
//   · COMPLETE. If the pair can be seated at all, the search seats it. There is no configuration
//     left to discover, so there is no fifth escape to write, or sixth.
//   · TERMINATING BY CONSTRUCTION. A finite state space, each state visited at most once.
//   · SHORTER. The four hand-written impasses and their escapes are gone; the tests that name them
//     stayed, and are now fixtures over a general routine rather than coverage of special cases —
//     which is what a test about a deadlock ought to be.
//
// ========================= EVERY FAILURE PATH THROWS =========================
// Not one of them returns null, retries, or falls back. A solver that silently gave up would show
// the child a hint button that quietly does nothing, which is worse than an error nobody sees:
// it teaches her that the help does not work.
//
// ========================= AND THE TIE-BREAKING IS DECLARED =========================
// ADR-0049 wants every reward deterministic, and a hint is a reward. So nothing here iterates a Set
// or an object's keys: `legalMoves` fixes its order in board.ts, the search pushes neighbours in a
// written order, and the endgame picks the first neighbour that is one step closer. The same board
// yields the same hint on every machine and every run, and a test pins it.

import { apply, blankAt, isSolved, moveOf, sizeOf } from './board.ts';
import type { Board, Move } from './types.ts';

export interface Solver {
  /** The whole path to the solved board. Deterministic. Throws if the board cannot be solved. */
  solve(b: Board): readonly Move[];
  /** The next move on that path, or null when there is nothing left to do. */
  nextMove(b: Board): Move | null;
  /**
   * The next few moves, for the hint. Fewer than asked for near the end; empty when solved.
   *
   * The hint SHOWS these; it never plays them. Requerimento 49.e draws the line between delivering
   * the answer instead of the reasoning and revealing it alongside the attempt, and a button that
   * moves the tiles for her is on the wrong side of it.
   */
  hint(b: Board, count?: number): readonly Move[];
}

export function createSolver(): Solver {
  // The 3x3 endgame table, built once per solver instance on first use. INSTANCE state, not module
  // state: ADR-0038 forbids the second, and two games on one page must not share a lazily built
  // 362 KB array whose construction one of them might be halfway through.
  let endgame: Uint8Array | null = null;

  function solve(start: Board): readonly Move[] {
    const size = sizeOf(start);
    const cells = size * size;
    let board = start;
    const out: Move[] = [];
    const frozen = new Uint8Array(cells);

    const at = (r: number, c: number): number => r * size + c;
    /** The tile that belongs at (r, c). The blank has no home, so this is never called for it. */
    const expected = (r: number, c: number): number => at(r, c) + 1;
    const find = (tile: number): number => {
      const i = board.indexOf(tile);
      if (i < 0) throw new Error(`tile ${tile} is not on the board`);
      return i;
    };

    /** Play the tile at `from` into the blank beside it. The one place `board` changes. */
    const play = (from: number): void => {
      const m = moveOf(board, from);
      if (m === null) throw new Error(`illegal: index ${from} is not adjacent to the blank`);
      board = apply(board, m);
      out.push(m);
    };

    /** Unsettled orthogonal neighbours of `i`, in the declared order up, down, left, right. */
    const openNeighbours = (i: number): number[] => {
      const r = Math.floor(i / size); const c = i % size;
      const found: number[] = [];
      if (r > 0) found.push(i - size);
      if (r + 1 < size) found.push(i + size);
      if (c > 0) found.push(i - 1);
      if (c + 1 < size) found.push(i + 1);
      return found.filter((n) => !frozen[n]);
    };

    /**
     * Seat one or two named tiles on their target cells, disturbing nothing already settled, and
     * freeze those cells behind it.
     *
     * With one tracked tile the search space is at most 25 * 24 states; with two, 25 * 24 * 23.
     * Both are searched exhaustively in well under a millisecond, which is why there is no
     * heuristic here and why there does not need to be one.
     */
    const seat = (tiles: readonly number[], targets: readonly number[]): void => {
      const startPos = tiles.map(find);
      const startBlank = blankAt(board);
      const settle = (): void => { for (const t of targets) frozen[t] = 1; };
      if (startPos.every((p, i) => p === targets[i])) { settle(); return; }

      // key = blank + cells * (first tile + cells * second tile). One tracked tile leaves the top
      // factor at zero, so one encoding serves both arities without a second code path.
      const key = (blank: number, pos: readonly number[]): number =>
        blank + cells * ((pos[0] ?? 0) + cells * (pos[1] ?? 0));

      const prev = new Int32Array(cells * cells * cells).fill(-1);
      const startKey = key(startBlank, startPos);
      prev[startKey] = startKey;                    // its own parent: the walk back stops here
      const queue: { blank: number; pos: number[]; key: number }[] = [
        { blank: startBlank, pos: startPos, key: startKey },
      ];
      let goalKey = -1;

      for (let head = 0; head < queue.length && goalKey < 0; head++) {
        const cur = queue[head];
        for (const q of openNeighbours(cur.blank)) {
          // The blank steps onto q; whatever sat on q lands where the blank was. That is a tracked
          // tile exactly when q is one of the tracked positions.
          const pos = cur.pos.map((p) => (p === q ? cur.blank : p));
          const k = key(q, pos);
          if (prev[k] !== -1) continue;
          prev[k] = cur.key;
          if (pos.every((p, i) => p === targets[i])) { goalKey = k; break; }
          queue.push({ blank: q, pos, key: k });
        }
      }

      if (goalKey < 0) {
        throw new Error(
          `cannot seat ${tiles.join(' and ')} on ${targets.join(' and ')} without disturbing settled tiles`,
        );
      }

      // Walk back to the start, then play forwards. The blank's NEW position at each step is the
      // cell whose tile moves, which is exactly what `play` takes.
      const blanks: number[] = [];
      for (let k = goalKey; k !== prev[k]; k = prev[k]) blanks.push(k % cells);
      for (let i = blanks.length - 1; i >= 0; i--) play(blanks[i]);

      settle();
    };

    // ---- the peel ----------------------------------------------------------------------------
    // Each pass closes one row and one column, shrinking the live board by one on each side. It
    // stops at 3x3 because that is small enough to answer exactly rather than approximately.
    //
    // ⚠️ The last two cells of a row are seated TOGETHER, and so are the last two of a column. That
    // is the one thing the peel must know: seating them one after the other is the classic
    // deadlock, because seating the second necessarily displaces the first. A pair search has no
    // such ordering to get wrong.
    for (let k = 0; k + 3 < size; k++) {
      for (let c = k; c + 2 < size; c++) seat([expected(k, c)], [at(k, c)]);
      seat([expected(k, size - 2), expected(k, size - 1)], [at(k, size - 2), at(k, size - 1)]);
      for (let r = k + 1; r + 2 < size; r++) seat([expected(r, k)], [at(r, k)]);
      seat([expected(size - 2, k), expected(size - 1, k)], [at(size - 2, k), at(size - 1, k)]);
    }

    // ---- the 3x3 finish ----------------------------------------------------------------------
    const origin = size - 3;
    const table = (endgame ??= buildEndgame());
    // 31 is the diameter of the 3x3 puzzle: no reachable arrangement is further from solved than
    // that, so a loop that has not finished in 32 steps is not a slow solve — it is a broken one.
    for (let guard = 0; guard <= 32; guard++) {
      if (isSolved(board)) break;
      const perm = readSub(board, size, origin);
      const d = table[rank(perm)];
      // A peeled sub-board of a solvable board is always solvable, so an unreachable arrangement
      // here means something upstream is broken — the peel, or a caller who built a board by
      // permuting rather than by playing. Saying so loudly is the only useful thing to do with it.
      if (d === UNREACHABLE) throw new Error('the final 3x3 is not reachable from the solved board');
      if (d === 0) break;
      const p = perm.indexOf(BLANK);
      const step = subNeighbours(p).find((q) => table[rank(swapped(perm, p, q))] === d - 1);
      if (step === undefined) throw new Error('the endgame table has no move that makes progress');
      play(at(origin + Math.floor(step / 3), origin + (step % 3)));
    }
    if (!isSolved(board)) throw new Error('the endgame did not finish within its bound');

    return out;
  }

  return {
    solve,
    nextMove: (b) => (isSolved(b) ? null : solve(b)[0] ?? null),
    hint: (b, count = 3) => (isSolved(b) ? [] : solve(b).slice(0, count)),
  };
}

/* ===================== the 3x3 endgame table =====================
 *
 * Nine cells is 9! = 362,880 arrangements, of which exactly half are reachable. One breadth-first
 * search from the solved state gives the distance of every one of them; the next move is then any
 * neighbour whose distance is one less. About 150 ms and 362 KB, after which every lookup is O(1)
 * and every answer is EXACT rather than heuristic — which is why the last three tiles are never
 * solved the long way round in front of a child who can count.
 *
 * The permutation is written in HOME SUB-CELL labels: the value at sub-cell s is the sub-cell that
 * whatever sits there belongs in. Solved is therefore the identity and the blank is the label 8 —
 * true whatever the tile numbers are, so one table serves the bottom-right 3x3 of a 4x4 and of a
 * 5x5 with no per-size translation.
 */

const BLANK = 8;
const UNREACHABLE = 255;
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

/**
 * Lehmer code. O(81), called a handful of times per lookup — the board is nine cells.
 *
 * ⚠️ `rank`, `unrank`, `subNeighbours` and `buildEndgame` are EXPORTED for one reason: the table is
 * the only part of this module whose correctness cannot be observed from its output. A wrong table
 * does not crash and does not loop — it returns a legal move that is merely not the best one, which
 * looks exactly like a working hint. So the test checks the table itself against the Bellman
 * condition (`d(solved) = 0`, `d(s) = 1 + min d(neighbour)`), which determines the distance
 * function uniquely and is an argument the construction never makes.
 */
export function rank(perm: readonly number[]): number {
  let r = 0;
  for (let i = 0; i < 9; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 9; j++) if (perm[j] < perm[i]) smaller++;
    r += smaller * FACTORIAL[8 - i];
  }
  return r;
}

export function unrank(index: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const out: number[] = [];
  let rest = index;
  for (let i = 0; i < 9; i++) {
    const f = FACTORIAL[8 - i];
    const pick = Math.floor(rest / f);
    rest -= pick * f;
    out.push(pool.splice(pick, 1)[0]);
  }
  return out;
}

/** The orthogonal neighbours of sub-cell p, in the declared order: up, down, left, right. */
export function subNeighbours(p: number): number[] {
  const r = Math.floor(p / 3); const c = p % 3;
  const found: number[] = [];
  if (r > 0) found.push(p - 3);
  if (r < 2) found.push(p + 3);
  if (c > 0) found.push(p - 1);
  if (c < 2) found.push(p + 1);
  return found;
}

function swapped(perm: readonly number[], a: number, b: number): number[] {
  const next = perm.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function buildEndgame(): Uint8Array {
  const dist = new Uint8Array(FACTORIAL[8] * 9).fill(UNREACHABLE);
  const root = rank([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  dist[root] = 0;
  // Sized for EVERY arrangement, not for the 181,440 that are reachable. A typed array silently
  // discards a write past its end, so an under-sized queue would not overflow — it would drop
  // states and leave holes in the table, and the holes would look exactly like the unreachable
  // half. The count is asserted below instead, where a wrong number can be seen.
  const queue = new Int32Array(FACTORIAL[8] * 9);
  queue[0] = root;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const cur = queue[head];
    const perm = unrank(cur);
    const p = perm.indexOf(BLANK);
    const d = dist[cur];
    for (const q of subNeighbours(p)) {
      const next = rank(swapped(perm, p, q));
      if (dist[next] !== UNREACHABLE) continue;
      dist[next] = d + 1;
      queue[tail++] = next;
    }
  }
  // Half of 9!, exactly. If this ever differs, the neighbour generation or the ranking is wrong,
  // and every hint after it would be quietly plausible instead of correct.
  if (tail !== 181440) throw new Error(`endgame reached ${tail} states, expected 181440`);
  return dist;
}

/**
 * Read the bottom-right 3x3 of `board` as a permutation of home sub-cell labels.
 *
 * Exported for the tests: the mapping from a real board to the table's alphabet is the seam where a
 * 4x4 and a 5x5 could quietly disagree, and a seam nobody can look at is a seam nobody checks.
 */
export function readSub(board: Board, size: number, origin: number): number[] {
  const home = new Map<number, number>();
  for (let s = 0; s < 9; s++) {
    const tile = (origin + Math.floor(s / 3)) * size + (origin + (s % 3)) + 1;
    home.set(tile === size * size ? 0 : tile, s);
  }
  const perm: number[] = [];
  for (let s = 0; s < 9; s++) {
    const tile = board[(origin + Math.floor(s / 3)) * size + (origin + (s % 3))];
    const label = home.get(tile);
    if (label === undefined) throw new Error(`tile ${tile} does not belong in the final 3x3`);
    perm.push(label);
  }
  return perm;
}

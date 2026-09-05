// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/solvability — the yardstick, shared by the shuffle and solver suites.
//
// It is deliberately a DIFFERENT argument from the one the code makes. `shuffle` produces reachable
// boards by construction ("we walked here, so the way back exists") and `solver` proves reachability
// by finding a path. This computes it from the permutation's parity instead, so the two can
// disagree — which is the only reason a check is worth writing.
//
// It earns its second keep in solver.node.test.ts, where it guards the hand-built fixtures. A
// fixture is easy to get wrong in exactly one way that looks right: SWAPPING TWO TILES ON THE
// SOLVED BOARD FLIPS THE PARITY, so "the last two of the row, exactly swapped, everything else
// home" is not a hard case — it is the classic UNSOLVABLE position. A fixture like that makes the
// solver throw, and the throw is correct, and the test that reads it as a bug sends you hunting
// through a module that is fine.

import type { Board } from '../app/js/puzzle/types.ts';

/**
 *  · odd width  — solvable iff the number of inversions is even.
 *  · even width — solvable iff (inversions + the blank's row counted from the BOTTOM, 1-based)
 *                 is odd.
 */
export function isSolvable(b: Board, size: number): boolean {
  const tiles = b.filter((t) => t !== 0);
  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inversions++;
  }
  if (size % 2 === 1) return inversions % 2 === 0;
  const rowFromBottom = size - Math.floor(b.indexOf(0) / size);
  return (inversions + rowFromBottom) % 2 === 1;
}

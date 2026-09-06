// SPDX-License-Identifier: AGPL-3.0-or-later
// This is the milestone the whole a11y layer hangs from: when `conformanceProblems` comes back
// empty, the ENGINE itself says this game is well-formed, and the sonar, the screen reader, Libras,
// the cane and the colour-vision filters become available without another line from us.
//
// So the checks here are not "does my function return something". They are: does the engine accept
// it, is every name sayable, and does each of the four roles mean what the header claims it means.

import { describe, expect, it } from 'vitest';
import { conformanceProblems, distance, speakableProblems } from '@the-inclusionist/engine/core/contract.js';
import { createPuzzleDeclaration, describeCell } from '../app/js/declaration/puzzle-declaration.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createRun, createSolvedRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { createRng } from '../app/js/puzzle/rng.ts';
import { shuffle } from '../app/js/puzzle/shuffle.ts';
import { solved } from '../app/js/puzzle/board.ts';
import { spotOf } from '../app/js/puzzle/types.ts';
import type { Run } from '../app/js/puzzle/run.ts';

const i18n = createI18n(null);
const solver = createSolver();

/** A declaration over a run that the test can swap under it — which is how a size change works. */
function harness(size: number, seed = 3) {
  let run: Run = createRun({ size, seed, solver, board: shuffle(size, createRng(seed)).board });
  const declaration = createPuzzleDeclaration({ run: () => run, i18n });
  return {
    declaration,
    run: () => run,
    resize(next: number) {
      run = createRun({ size: next, seed, solver, board: shuffle(next, createRng(seed)).board });
    },
    solve() {
      run = createSolvedRun({ size: run.size, seed, solver });
    },
  };
}

describe('the engine accepts it', () => {
  it('reports no conformance problem at any size', () => {
    for (const n of [3, 4, 5]) {
      expect(conformanceProblems(harness(n).declaration), `size ${n}`).toEqual([]);
    }
  });

  it('still reports none on a solved board', () => {
    const h = harness(4);
    h.solve();
    expect(conformanceProblems(h.declaration)).toEqual([]);
  });

  // ⚠️ The reason `topology` is a getter. If it were the plain value the contract declares, a size
  // change would leave the sonar measuring against the old grid, silently.
  it('follows a size change with no rebuild of the declaration', () => {
    const h = harness(3);
    expect(h.declaration.topology).toEqual({ kind: 'grid', cols: 3, rows: 3 });
    h.resize(5);
    expect(h.declaration.topology).toEqual({ kind: 'grid', cols: 5, rows: 5 });
    expect(conformanceProblems(h.declaration)).toEqual([]);
  });

  it('declares the tick as the player\'s, which is what makes WCAG 2.2.1 inapplicable', () => {
    expect(harness(4).declaration.tick).toBe('player');
  });
});

describe('roleAt — the four roles, and only four', () => {
  it('calls the blank the goal', () => {
    const h = harness(4);
    const blank = spotOf(h.run().board().indexOf(0), 4);
    expect(h.declaration.roleAt(blank)).toBe('goal');
  });

  it('calls a settled tile structure', () => {
    const h = harness(4);
    h.solve();
    expect(h.declaration.roleAt({ x: 0, y: 0 })).toBe('structure');
  });

  it('separates a tile that can slide from one that cannot', () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const d = createPuzzleDeclaration({ run: () => run, i18n });
    // Displace one tile so something is out of place and beside the blank.
    run.activate(14);
    const board = run.board();
    const roles = board.map((_, i) => d.roleAt(spotOf(i, 4)));
    expect(roles).toContain('key');
    expect(roles.filter((r) => r === 'key').length).toBeLessThanOrEqual(4);
  });

  it('reports gate for an out-of-place tile that is not beside the blank', () => {
    const h = harness(5);
    const board = h.run().board();
    const gates = board.map((_, i) => h.declaration.roleAt(spotOf(i, 5))).filter((r) => r === 'gate');
    expect(gates.length).toBeGreaterThan(0);
  });

  it('never returns free, hazard, climb or water — nothing here is any of those', () => {
    for (const n of [3, 4, 5]) {
      const h = harness(n);
      for (let i = 0; i < n * n; i++) {
        expect(['goal', 'structure', 'key', 'gate'], `size ${n} cell ${i}`)
          .toContain(h.declaration.roleAt(spotOf(i, n)));
      }
    }
  });

  it('answers structure, not free, for a spot off the grid', () => {
    const d = harness(4).declaration;
    for (const at of [{ x: -1, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }, { x: 0.5, y: 0 }]) {
      expect(d.roleAt(at)).toBe('structure');
    }
  });
});

describe('nameAt — every square is sayable', () => {
  it('gives a well-formed Speakable for every cell, blank included', () => {
    for (const n of [3, 4, 5]) {
      const h = harness(n);
      for (let i = 0; i < n * n; i++) {
        const name = h.declaration.nameAt(spotOf(i, n));
        expect(name, `size ${n} cell ${i}`).not.toBeNull();
        expect(speakableProblems(name), `size ${n} cell ${i}`).toEqual([]);
      }
    }
  });

  // The divergence from the chess consumer, pinned so a later "tidy-up" cannot silently restore it.
  it('names the blank rather than returning null — it is the only moving part', () => {
    const h = harness(4);
    const blank = spotOf(h.run().board().indexOf(0), 4);
    expect(h.declaration.nameAt(blank)).toEqual(i18n.describeBlank());
  });

  it('returns null only for a spot that is not on the grid', () => {
    expect(harness(4).declaration.nameAt({ x: 9, y: 9 })).toBeNull();
  });
});

describe('focusOf', () => {
  it('is null for a player who does not exist', () => {
    expect(harness(4).declaration.focusOf(1)).toBeNull();
  });

  it('sits where the cursor sits', () => {
    const h = harness(4);
    h.run().setCursor(6);
    expect(h.declaration.focusOf(0)?.at).toEqual({ x: 2, y: 1 });
  });

  it('points the way the tile under the cursor would travel', () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const d = createPuzzleDeclaration({ run: () => run, i18n });
    run.setCursor(14);                       // tile 15, blank to its right
    expect(d.focusOf(0)?.heading).toBe('e');
    run.setCursor(11);                       // tile 12, blank below it
    expect(d.focusOf(0)?.heading).toBe('s');
    run.setCursor(0);                        // tile 1, nowhere to go
    expect(d.focusOf(0)?.heading).toBe('none');
  });
});

describe('objectiveOf', () => {
  it('needs every tile but the blank', () => {
    for (const n of [3, 4, 5]) {
      expect(harness(n).declaration.objectiveOf(0).need, `size ${n}`).toBe(n * n - 1);
    }
  });

  it('is complete exactly when the board is', () => {
    const h = harness(4);
    h.solve();
    const o = h.declaration.objectiveOf(0);
    expect(o.have).toBe(o.need);
  });

  it('names what is being collected, in a form Libras can sign', () => {
    expect(speakableProblems(harness(4).declaration.objectiveOf(0).name)).toEqual([]);
  });

  it('gives a second player nothing rather than a copy of the first', () => {
    expect(harness(4).declaration.objectiveOf(1).have).toBe(0);
  });
});

describe('targetsOf', () => {
  // ⚠️ THE PUSH WIDENED THIS, and the number is exact rather than a range: a click slides a whole
  // line, so every cell in the blank's row and column can move — `2(size - 1)` of them, always.
  // Six on a 4x4, eight on a 5x5. It was two to four before.
  it('hands the sonar the whole row and column of the blank', () => {
    for (const n of [3, 4, 5]) {
      const h = harness(n);
      const targets = h.declaration.targetsOf(0);
      expect(targets.length, `size ${n}`).toBe(2 * (n - 1));
      for (const t of targets) expect(h.declaration.roleAt(t), `size ${n}`).toMatch(/^(key|structure)$/);
    }
  });

  it('never offers a cell that is neither in the row nor in the column', () => {
    const h = harness(4);
    const blank = h.run().board().indexOf(0);
    const bx = blank % 4; const by = Math.floor(blank / 4);
    for (const t of h.declaration.targetsOf(0)) {
      expect(t.x === bx || t.y === by, `${t.x},${t.y} against blank ${bx},${by}`).toBe(true);
      expect(t.x === bx && t.y === by).toBe(false);
    }
  });

  it('is empty when solved — empty is an answer, not a fault', () => {
    const h = harness(4);
    h.solve();
    expect(h.declaration.targetsOf(0)).toEqual([]);
  });

  it('is empty for a player who does not exist', () => {
    expect(harness(4).declaration.targetsOf(1)).toEqual([]);
  });

  // ⚠️ RECORDED, NOT FIXED. `distance` on a grid is Chebyshev — king's steps — because the contract
  // was written for a board where the diagonal costs one. A tile slides orthogonally, so the sonar
  // will say "two" where the truth is four moves. `Topology.grid` has no way to say "orthogonal
  // only". Accepted for v1; the fix is an engine amendment (`metric?: 'manhattan'`), not a local
  // workaround, and this test exists so the day it lands is a day this line changes.
  it('is measured by the engine in KING steps, which under-reports a sliding puzzle', () => {
    const t = harness(4).declaration.topology;
    expect(distance(t, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(2);   // four slides, in truth
  });
});

describe('describeCell — position, then what, then what it can do', () => {
  it('leads with the row and column, one-based', () => {
    const h = harness(4);
    expect(describeCell({ run: h.run, i18n }, 0)).toMatch(/^linha 1, coluna 1/);
    expect(describeCell({ run: h.run, i18n }, 7)).toMatch(/^linha 2, coluna 4/);
  });

  it('says the blank is the blank', () => {
    const h = harness(4);
    const blank = h.run().board().indexOf(0);
    expect(describeCell({ run: h.run, i18n }, blank)).toContain('espaço vazio');
  });

  it('says whether a tile is home, and how it can move when it can', () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const deps = { run: () => run, i18n };
    expect(describeCell(deps, 0)).toContain('no lugar');
    // Tile 15 is home AND beside the blank, so it is settled and still movable.
    expect(describeCell(deps, 14)).toContain('pode deslizar');
    // 15 slides right into the corner, which is NOT its home — so the cell it landed on now
    // reports "out of place", and the cell it left is the blank.
    run.activate(14);
    expect(describeCell(deps, 15)).toContain('fora do lugar');
    expect(describeCell(deps, 14)).toContain('espaço vazio');
  });

  it('says nothing about movement for a tile that cannot move', () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(describeCell({ run: () => run, i18n }, 0)).not.toContain('pode deslizar');
  });
});

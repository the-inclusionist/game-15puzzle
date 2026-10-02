// SPDX-License-Identifier: AGPL-3.0-or-later
// The grid is the whole accessibility argument of this game made concrete, so this file checks the
// three things a node test cannot: what the accessibility tree actually says, what the keyboard
// actually does, and how big the targets actually are.
//
// ⚠️ IT IMPORTS THE REAL STYLESHEET. The percentage geometry, the 44 px floor and the span that must
// fill its cell are CSS facts. A test that pasted its own copy of those rules would be checking the
// copy — which is exactly how the shearing bug below survived a green node suite.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { createTileGrid } from '../app/js/ui/tile-grid.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { createRng } from '../app/js/puzzle/rng.ts';
import { shuffle } from '../app/js/puzzle/shuffle.ts';
import { solved } from '../app/js/puzzle/board.ts';
import { boardGeometry, SIZES } from '../app/js/render/geometry.ts';
import type { Run } from '../app/js/puzzle/run.ts';
import type { TileGrid } from '../app/js/ui/tile-grid.ts';

const i18n = createI18n(null);
const solver = createSolver();

let mounted: { region: HTMLElement; grid: TileGrid } | null = null;

/**
 * A region sized exactly as the engine's k=2 FLOOR sizes it: 640x360 CSS pixels, which is the
 * smallest viewport anyone ever sees (ADR-0001, `MIN_K = 2`). Every measurement below is therefore
 * the worst case rather than a comfortable one.
 */
function mount(size: number, board = shuffle(size, createRng(9)).board) {
  const region = document.createElement('div');
  region.id = 'game-region';
  region.style.cssText = 'position:relative;width:640px;height:360px';
  document.body.appendChild(region);

  let run: Run = createRun({ size, seed: 9, solver, board });
  const activated: number[] = [];
  const grid = createTileGrid({
    doc: document,
    i18n,
    run: () => run,
    geometry: () => boardGeometry(run.size),
    onActivate: (index) => { activated.push(index); run.activate(index); grid.refresh(); },
  });
  region.appendChild(grid.root);
  mounted = { region, grid };
  return { region, grid, run: () => run, activated, cells: () => [...grid.root.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')] };
}

afterEach(() => { mounted?.grid.destroy(); mounted?.region.remove(); mounted = null; });

describe('the accessibility tree', () => {
  it('is one grid of rows and cells, at every size', () => {
    for (const n of SIZES) {
      const m = mount(n);
      expect(m.grid.root.getAttribute('role')).toBe('grid');
      expect(m.grid.root.getAttribute('aria-rowcount')).toBe(String(n));
      expect(m.grid.root.querySelectorAll('[role="row"]')).toHaveLength(n);
      expect(m.cells()).toHaveLength(n * n);
      m.grid.destroy(); m.region.remove(); mounted = null;
    }
  });

  it('numbers rows and columns one-based, in reading order', () => {
    const m = mount(4);
    const cells = m.cells();
    expect(cells[0].getAttribute('aria-colindex')).toBe('1');
    expect(cells[3].getAttribute('aria-colindex')).toBe('4');
    expect(cells[4].closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe('2');
  });

  it('labels every cell with where it is, what is there and what it can do', () => {
    const m = mount(4, solved(4));
    expect(m.cells()[0].getAttribute('aria-label')).toBe('linha 1, coluna 1, peça 1, no lugar');
    expect(m.cells()[15].getAttribute('aria-label')).toBe('linha 4, coluna 4, espaço vazio');
    expect(m.cells()[14].getAttribute('aria-label')).toContain('pode deslizar');
  });

  it('marks the blank aria-disabled but leaves it focusable', () => {
    const m = mount(4, solved(4));
    const blank = m.cells()[15];
    expect(blank.getAttribute('aria-disabled')).toBe('true');
    // ⚠️ NOT `disabled`. A disabled button is a hole in a roving-tabindex grid and some readers skip
    // it entirely, so the child never learns the empty square is there — which on this board is the
    // one square that matters.
    expect(blank.hasAttribute('disabled')).toBe(false);
    blank.focus();
    expect(document.activeElement).toBe(blank);
  });

  it('keeps exactly one cell in the tab order', () => {
    const m = mount(5);
    expect(m.cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
    m.grid.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
    expect(m.cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
  });

  it('relabels after a move rather than reordering the DOM', () => {
    const m = mount(4, solved(4));
    const before = m.cells();
    m.cells()[14].click();
    const after = m.cells();
    // ⚠️ THE SAME ELEMENTS IN THE SAME ORDER. If the button were the TILE, DOM order would stop
    // matching visual order here and WCAG 1.3.2 would fail on every move.
    expect(after.every((c, i) => c === before[i])).toBe(true);
    expect(after[15].getAttribute('aria-label')).toContain('peça 15');
    expect(after[14].getAttribute('aria-label')).toContain('espaço vazio');
  });
});

// ⚠️ THESE TESTS DROVE A `keydown` LISTENER UNTIL ENGINE 11, and that listener is gone (ADR-0111 §1:
// a cartridge does not read keys). The engine's virtual controller delivers commands through
// `onCommand(VirtualCommand)`, and the cartridge calls `grid.move(dir)` or `grid.activate()` on this
// imperative API. What this describe block tests NOW is that imperative API — the one the cartridge's
// dispatcher calls — not the keyboard, which is the engine's business and lives in the engine's own
// test suite.
describe('the imperative cursor API', () => {
  it('moves the cursor with move(dir)', () => {
    const m = mount(4);
    m.grid.move('right'); expect(m.run().cursor()).toBe(1);
    m.grid.move('down'); expect(m.run().cursor()).toBe(5);
    m.grid.move('left'); expect(m.run().cursor()).toBe(4);
    m.grid.move('up'); expect(m.run().cursor()).toBe(0);
  });

  // Clamped, never wrapped. A cursor that reappeared on the far side would tell a blind player the
  // board is a torus — and the engine's own `core/anel` draws the same line: wrap a linear menu,
  // never a two-dimensional grid.
  it('clamps at the edges instead of wrapping', () => {
    const m = mount(4);
    m.grid.move('up'); m.grid.move('left');
    expect(m.run().cursor()).toBe(0);
    for (let i = 0; i < 6; i++) { m.grid.move('right'); m.grid.move('down'); }
    expect(m.run().cursor()).toBe(15);
  });

  it('moves focus with the cursor, so a sighted keyboard player can see where they are', () => {
    const m = mount(4);
    m.cells()[0].focus();
    m.grid.move('right');
    expect(document.activeElement).toBe(m.cells()[1]);
  });

  // The one funnel. The native button click (pointer, touch, Enter and Space on the focused button)
  // and `grid.activate()` (from `onCommand({action:'action1'})`) both call the same `onActivate`.
  // Nothing else reaches it, which is what stops keyboard and pointer drifting apart.
  it('activates through the same door for a click and for grid.activate()', () => {
    const m = mount(4, solved(4));
    m.cells()[14].click();
    expect(m.activated).toEqual([14]);
    m.grid.activate();
    // activate() uses the current cursor — this test mounts with cursor at 0, so a second entry
    // reaches 0. What is asserted is that the SAME onActivate fires for both routes.
    expect(m.activated.length).toBe(2);
  });

  // ⚠️ ADR-0111 §1 in test form. The grid stopped being a transport in engine 11; a `keydown`
  // listener here would be reading keys the engine was supposed to own. Measured by dispatching a key
  // and asserting the cursor did not move — nothing is listening.
  it('does not read keys any more', () => {
    const m = mount(4);
    const before = m.run().cursor();
    m.grid.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true }));
    expect(m.run().cursor()).toBe(before);
  });
});

describe('target size at the k=2 floor (WCAG 2.5.5)', () => {
  // 640x360 is the smallest viewport that exists (MIN_K = 2), so this is the worst case and not a
  // sample. The floor is met by GEOMETRY — a `min-height` on a cell would break the percentage grid
  // and unstick the numbers from the art — so it has to be measured rather than declared.
  it('gives every cell at least 44 by 44 CSS pixels, at every size', () => {
    for (const n of SIZES) {
      const m = mount(n);
      for (const cell of m.cells()) {
        const r = cell.getBoundingClientRect();
        expect(r.width, `size ${n}`).toBeGreaterThanOrEqual(44);
        expect(r.height, `size ${n}`).toBeGreaterThanOrEqual(44);
      }
      m.grid.destroy(); m.region.remove(); mounted = null;
    }
  });

  it('never lets two cells overlap', () => {
    const m = mount(5);
    const rects = m.cells().map((c) => c.getBoundingClientRect());
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]; const b = rects[j];
        const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
        expect(apart, `cells ${i} and ${j}`).toBe(true);
      }
    }
  });
});

describe('registration — the number stays on the tile', () => {
  it('puts each cell exactly where the canvas draws it', () => {
    for (const n of SIZES) {
      const m = mount(n);
      const g = boardGeometry(n);
      const region = m.region.getBoundingClientRect();
      const k = region.width / 320;
      for (let i = 0; i < n * n; i++) {
        const r = m.cells()[i].getBoundingClientRect();
        expect((r.left - region.left) / k, `size ${n} cell ${i} x`).toBeCloseTo(g.cellRect(i).x, 1);
        expect((r.top - region.top) / k, `size ${n} cell ${i} y`).toBeCloseTo(g.cellRect(i).y, 1);
        expect(r.width / k, `size ${n} cell ${i} w`).toBeCloseTo(g.cell, 1);
      }
      m.grid.destroy(); m.region.remove(); mounted = null;
    }
  });

  /**
   * ⚠️ THE GATE THAT CAUGHT THE REAL BUG, AND IT COULD ONLY BE CAUGHT HERE.
   *
   * `setOffset` writes `translate(<percent>%)`, and a percentage in a CSS transform resolves against
   * THE ELEMENT'S OWN border box — not its parent's. The span started life sized to the digit: about
   * 12 CSS px against a 74 px cell, so the number travelled a sixth of the distance the tile body
   * travelled and sheared off it. Every node test was green; the arithmetic was right; the CSS was
   * wrong. Measured in a browser at k=2: the canvas moved 7 logical pixels and the number moved 2.2.
   *
   * The fix is `.tile-num { width: 100%; height: 100% }`, and this is what holds it there.
   */
  it('moves the number by the SAME logical distance the canvas moves the tile', () => {
    const m = mount(4);
    const g = boardGeometry(4);
    const region = m.region.getBoundingClientRect();
    const k = region.width / 320;
    const cell = m.cells()[5];
    const num = cell.firstElementChild as HTMLElement;
    const centre = (): number => {
      const r = num.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return (r.left + r.width / 2 - (c.left + c.width / 2)) / k;
    };

    expect(centre()).toBeCloseTo(0, 1);
    for (const dx of [-25, -14, -7, -3, -1, 0]) {
      m.grid.setOffset([{ tile: 6, at: 5, dx, dy: 0 }]);
      expect(centre(), `offset ${dx}`).toBeCloseTo(dx, 1);
    }
    m.grid.setOffset([{ tile: 6, at: 5, dx: 0, dy: g.cell + g.gap }]);
    const r = num.getBoundingClientRect(); const c = cell.getBoundingClientRect();
    expect((r.top + r.height / 2 - (c.top + c.height / 2)) / k).toBeCloseTo(g.cell + g.gap, 1);
  });

  it('clears the offset from every other cell, so nothing is left hanging', () => {
    const m = mount(4);
    m.grid.setOffset([{ tile: 6, at: 5, dx: -20, dy: 0 }]);
    m.grid.setOffset([{ tile: 7, at: 6, dx: -20, dy: 0 }]);
    const five = m.cells()[5].firstElementChild as HTMLElement;
    expect(five.style.transform).toBe('');
  });
});

describe('the hint marker and the dialog guard', () => {
  it('marks the tile to press, and clears it', () => {
    const m = mount(4, solved(4));
    m.grid.setHint([14]);
    expect(m.cells()[14].dataset.hint).toBe('1');
    m.grid.setHint([]);
    expect(m.cells()[14].dataset.hint).toBeUndefined();
  });

  // ⚠️ MANDATORY, NOT POLISH. The engine installs no focus trap and its menu key handler does not
  // cover Tab, so a visible board behind an open overlay is directly Tab-reachable — WCAG 2.4.11 and
  // 2.1.2. axe cannot see it, because it is an interaction and not markup.
  it('leaves the tab order entirely while a dialog is open', () => {
    const m = mount(4);
    m.grid.setInert(true);
    expect(m.grid.root.hasAttribute('inert')).toBe(true);
    m.cells()[0].focus();
    expect(document.activeElement).not.toBe(m.cells()[0]);
    m.grid.setInert(false);
    m.cells()[0].focus();
    expect(document.activeElement).toBe(m.cells()[0]);
  });
});

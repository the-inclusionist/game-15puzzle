// SPDX-License-Identifier: AGPL-3.0-or-later
// Geometry, palette, slide and the board view — all four in the NODE project, with no DOM and no
// PixiJS. That is not tidiness: it is what lets the drawing be checked at all. The chess consumer's
// geometry needed a browser, so its equivalent assertions are screenshots.

import { describe, expect, it } from 'vitest';
import {
  BOARD, GAP, LAYOUT, LOGICAL_H, LOGICAL_W, SAFE, SIZES, boardGeometry,
} from '../app/js/render/geometry.ts';
import { HIGH, NORMAL, TITLE_PULSE_FLOOR, composite, contrast } from '../app/js/render/palette.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSlide } from '../app/js/render/slide.ts';
import { createBoardView } from '../app/js/render/board-view.ts';
import { legalMoves, solved } from '../app/js/puzzle/board.ts';
import type { DesenhoComLinha } from '@the-inclusionist/engine/render/port.js';

describe('geometry — the numbers, checked rather than trusted', () => {
  it('keeps the tray inside the safe area at every size', () => {
    for (const n of SIZES) {
      const g = boardGeometry(n);
      expect(g.tray.x, `size ${n}`).toBeGreaterThanOrEqual(SAFE.x);
      expect(g.tray.y, `size ${n}`).toBeGreaterThanOrEqual(SAFE.y);
      expect(g.tray.x + g.tray.w, `size ${n}`).toBeLessThanOrEqual(SAFE.x + SAFE.w);
      expect(g.tray.y + g.tray.h, `size ${n}`).toBeLessThanOrEqual(SAFE.y + SAFE.h);
    }
  });

  it('gives every cell a WHOLE number of logical pixels', () => {
    for (const n of SIZES) {
      const g = boardGeometry(n);
      expect(Number.isInteger(g.cell), `size ${n}`).toBe(true);
      for (let i = 0; i < n * n; i++) {
        const r = g.cellRect(i);
        for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v), `size ${n} cell ${i}`).toBe(true);
      }
    }
  });

  it('reports the cells this design was sized around', () => {
    expect(boardGeometry(3).cell).toBe(50);
    expect(boardGeometry(4).cell).toBe(37);
    expect(boardGeometry(5).cell).toBe(29);
  });

  // ⚠️ THE WCAG 2.5.5 FLOOR, IN LOGICAL UNITS. The engine's `--tap` is 22 logical px, which is 44 CSS
  // px at the k=2 floor. A cell smaller than that fails target size — and the browser test measures
  // the real rectangle, because this one can only prove the arithmetic.
  it('never gives a cell smaller than the 22-logical-pixel target floor', () => {
    for (const n of SIZES) expect(boardGeometry(n).cell, `size ${n}`).toBeGreaterThanOrEqual(22);
  });

  // The recorded fact behind "5x5 is a product decision, not a technical limit".
  it('would still clear the floor at 6x6 and would fail at 7x7', () => {
    expect(boardGeometry(6).cell).toBeGreaterThanOrEqual(22);
    expect(boardGeometry(7).cell).toBeLessThan(22);
  });

  it('never overlaps two cells, and always leaves the gap between them', () => {
    for (const n of SIZES) {
      const g = boardGeometry(n);
      for (let i = 0; i < n * n; i++) {
        const r = g.cellRect(i);
        if (i % n < n - 1) expect(g.cellRect(i + 1).x - (r.x + r.w), `size ${n}`).toBe(GAP);
        if (Math.floor(i / n) < n - 1) expect(g.cellRect(i + n).y - (r.y + r.h), `size ${n}`).toBe(GAP);
      }
    }
  });

  // This is the assertion the whole DOM-over-canvas design rests on: the percentage the DOM is
  // positioned with and the logical rectangle the canvas draws must be the same rectangle.
  it('states each cell as a percentage that inverts back to its logical box', () => {
    for (const n of SIZES) {
      const g = boardGeometry(n);
      for (let i = 0; i < n * n; i++) {
        const r = g.cellRect(i);
        const p = g.cellPercent(i);
        expect((p.left / 100) * g.tray.w + g.tray.x, `size ${n} cell ${i}`).toBeCloseTo(r.x, 9);
        expect((p.top / 100) * g.tray.h + g.tray.y, `size ${n} cell ${i}`).toBeCloseTo(r.y, 9);
        expect((p.width / 100) * g.tray.w, `size ${n} cell ${i}`).toBeCloseTo(r.w, 9);
      }
    }
  });

  it('puts each row strip where its first cell is', () => {
    const g = boardGeometry(4);
    for (let row = 0; row < 4; row++) expect(g.rowPercent(row).top).toBeCloseTo(g.cellPercent(row * 4).top, 9);
  });

  it('sizes the digit from the TILE and not from the engine menu text', () => {
    // --ui-fs is 16 CSS px at the k=2 floor. A 5x5 cell is 58 CSS px, so a multiplier near 2 keeps
    // two digits inside it; a multiplier of 1 would print menu-sized numbers on a small tile.
    expect(boardGeometry(5).numberScale).toBeLessThan(boardGeometry(3).numberScale);
    for (const n of SIZES) expect(boardGeometry(n).numberScale).toBeGreaterThan(1);
  });

  it('agrees with the stylesheet about where the tray and the panel are', () => {
    expect(LAYOUT.tray.left).toBeCloseTo(2.5, 4);
    expect(LAYOUT.tray.width).toBeCloseTo(50, 4);
    expect(LAYOUT.hud.left).toBeCloseTo(55, 4);
    expect(LAYOUT.hud.width).toBeCloseTo(45, 4);
    // The tray's right edge and the panel's left edge, with the gutter between them.
    expect(BOARD.x + BOARD.size).toBeLessThan((LAYOUT.hud.left / 100) * LOGICAL_W);
  });

  it('refuses a board size that is not a whole number of at least two', () => {
    expect(() => boardGeometry(1)).toThrow();
    expect(() => boardGeometry(2.5)).toThrow();
  });

  it('stays at the engine base — 320x180, unforked', () => {
    expect([LOGICAL_W, LOGICAL_H]).toEqual([320, 180]);
  });
});

describe('palette — the ratios are measured', () => {
  for (const p of [NORMAL, HIGH]) {
    describe(p.name, () => {
      it('clears 4.5:1 for the digit on both tile states (WCAG 1.4.3)', () => {
        expect(contrast(p.ink, p.tileAway)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.ink, p.tileHome)).toBeGreaterThanOrEqual(4.5);
      });

      it('clears 3:1 for a tile against its well (WCAG 1.4.11)', () => {
        for (const well of [p.wellA, p.wellB]) {
          expect(contrast(p.tileAway, well)).toBeGreaterThanOrEqual(3);
          expect(contrast(p.tileHome, well)).toBeGreaterThanOrEqual(3);
        }
      });

      it('separates a settled tile from an unsettled one by VALUE, not only by hue', () => {
        expect(contrast(p.tileAway, p.tileHome)).toBeGreaterThanOrEqual(1.5);
      });

      it('clears 3:1 for the accent against the tray it is drawn on', () => {
        expect(contrast(p.accent, p.wellA)).toBeGreaterThanOrEqual(3);
      });
    });
  }

  // ⚠️ THE TITLE PULSE, AT ITS WEAKEST MOMENT. Found by axe, not by looking: a fading word is
  // legible at opacity 1 and can be illegible at the bottom of the breath, and an eye watching an
  // animation only ever registers the bright instant. 4.5:1 rather than the 3:1 large text is
  // allowed, because the size depends on --ui-fs and this should not have to be re-derived when it
  // moves.
  it('keeps the pulsing word above 4.5:1 at the DIMMEST point of the cycle', () => {
    for (const p of [NORMAL, HIGH]) {
      const dim = composite(p.accent, TITLE_PULSE_FLOOR, p.backdrop);
      expect(contrast(dim, p.backdrop), `${p.name} at ${TITLE_PULSE_FLOOR}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('and the stylesheet uses the same floor this was computed from', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'app', 'css', 'style.css'), 'utf8');
    expect(css).toContain(`opacity: ${TITLE_PULSE_FLOOR}`);
  });

  it('composites the way a browser does — in sRGB, not in linear light', () => {
    // Half of white over black is #808080, not the mid-luminance grey linear mixing would give.
    expect(composite('#ffffff', 0.5, '#000000')).toBe('#808080');
    expect(composite('#ffd97d', 1, '#10141c')).toBe('#ffd97d');
    expect(composite('#ffd97d', 0, '#10141c')).toBe('#10141c');
  });

  it('is a real step up in high contrast, not a rename', () => {
    expect(contrast(HIGH.ink, HIGH.tileAway)).toBeGreaterThan(contrast(NORMAL.ink, NORMAL.tileAway));
  });
});

describe('slide — one clock, whole pixels', () => {
  const move = { tile: 5, from: 6, to: 5, direction: 'left' as const };

  it('starts a slide fully offset and ends it at zero', () => {
    const s = createSlide({ frames: 8 });
    s.begin([move], 4, 39);
    expect(s.travelling()).toEqual([{ tile: 5, at: 5, dx: 39, dy: 0 }]);
    while (s.advance(1)) { /* run it out */ }
    expect(s.travelling()).toEqual([]);
  });

  it('offsets by WHOLE logical pixels at every frame — the shared rounding', () => {
    const s = createSlide({ frames: 9 });
    s.begin([move], 4, 39);
    do {
      const [t] = s.travelling();
      expect(t).toBeDefined();
      expect(Number.isInteger(t.dx)).toBe(true);
      expect(Number.isInteger(t.dy)).toBe(true);
    } while (s.advance(1));
  });

  it('closes the distance monotonically', () => {
    const s = createSlide({ frames: 9 });
    s.begin([move], 4, 39);
    let last = Infinity;
    do {
      const d = Math.abs(s.travelling()[0].dx);
      expect(d).toBeLessThanOrEqual(last);
      last = d;
    } while (s.advance(1));
  });

  it('carries a vertical move on the other axis', () => {
    const s = createSlide({ frames: 8 });
    s.begin([{ tile: 2, from: 1, to: 5, direction: 'down' }], 4, 39);
    const [t] = s.travelling();
    expect(t.dy).toBe(-39);
    expect(t.dx).toBe(0);
  });

  // ⚠️ ONE BRANCH, NO MEDIA QUERY. That is the only way the OS preference and the in-game switch can
  // agree — a `@media (prefers-reduced-motion)` rule would stop the DOM half and leave the canvas
  // half running, which is the seam in a costume.
  it('collapses to nothing when motion is reduced, and reads the switch each time', () => {
    let reduced = true;
    const s = createSlide({ frames: 8, reduced: () => reduced });
    s.begin([move], 4, 39);
    // ⚠️ THIS LINE USED TO EXPECT `[{ tile: 5, at: 5, dx: 0, dy: 0 }]`, AND THAT WAS THE DEFECT
    // WRITTEN DOWN AS A PROPERTY. A tile parked at displacement zero is not a shorter journey, it is
    // no journey — and the object that described it was the same non-empty `push` that kept
    // `active()` true for ever, so the board refused every press after the first. Under reduced
    // motion there is nothing travelling, and `[]` is what that is called.
    expect(s.travelling()).toEqual([]);
    expect(s.active()).toBe(false);
    expect(s.advance(1)).toBe(false);

    // And the property this test was always here to guard: the switch is read at each `begin`, not
    // captured once at construction.
    reduced = false;
    s.begin([move], 4, 39);
    expect(s.travelling()[0].dx).toBe(39);
  });

  /**
   * ⚠️ THE BUG THIS PINS COST A CHILD THE WHOLE GAME, AND EVERY GREEN RUN MISSED IT.
   *
   * `begin` set `t = 1` under reduced motion but left `push` full, and `advance` returned at its
   * `t >= 1` guard WITHOUT clearing it. So `active()` stayed true for ever, and the composition root
   * refuses input while a slide is active: one press, then a dead board.
   *
   * It was invisible because every verification ran with motion ON. It surfaced the moment the
   * accessibility bar was mounted and its calm icon was pressed — which is the whole argument for
   * mounting the bar, arriving early.
   *
   * The invariant, stated so it cannot rot: `active()` is true exactly while something still has to
   * move, and under reduced motion nothing does.
   */
  it('is never left ACTIVE under reduced motion — one press must not kill the board', () => {
    const s = createSlide({ frames: 8, reduced: () => true });
    s.begin([move], 4, 39);
    expect(s.active(), 'a finished slide is not an active one').toBe(false);
    expect(s.travelling()).toEqual([]);
    // And a second press must be possible, which is the symptom a player would report.
    s.begin([move], 4, 39);
    expect(s.active()).toBe(false);
  });

  it('clears itself when a full-frame step finishes it, not only when it eases out', () => {
    const s = createSlide({ frames: 8 });
    s.begin([move], 4, 39);
    expect(s.active()).toBe(true);
    s.advance(99);
    expect(s.active()).toBe(false);
  });

  it('takes dt in FRAMES, so a bigger step finishes sooner', () => {
    const fast = createSlide({ frames: 8 });
    fast.begin([move], 4, 39);
    expect(fast.advance(8)).toBe(false);      // one frame worth eight: done
    expect(fast.travelling()).toEqual([]);
  });

  it('can be cancelled mid-flight — a reshuffle must not leave a tile in the air', () => {
    const s = createSlide({ frames: 8 });
    s.begin([move], 4, 39);
    s.cancel();
    expect(s.active()).toBe(false);
    expect(s.travelling()).toEqual([]);
  });
});

describe('board-view — and the recorder never sees a glyph', () => {
  /** A fake `DesenhoComLinha` that records what it was asked to do. No PixiJS, no canvas. */
  function recorder() {
    const calls: { op: string; args: number[] }[] = [];
    const self = {
      clear() { calls.push({ op: 'clear', args: [] }); return self; },
      beginFill(c: number) { calls.push({ op: 'beginFill', args: [c] }); return self; },
      drawRect(...a: number[]) { calls.push({ op: 'drawRect', args: a }); return self; },
      endFill() { calls.push({ op: 'endFill', args: [] }); return self; },
      lineStyle(...a: number[]) { calls.push({ op: 'lineStyle', args: a }); return self; },
      moveTo(...a: number[]) { calls.push({ op: 'moveTo', args: a }); return self; },
      lineTo(...a: number[]) { calls.push({ op: 'lineTo', args: a }); return self; },
    };
    return { self: self as unknown as DesenhoComLinha, calls };
  }

  function view(size = 4) {
    const r = recorder();
    const added: unknown[] = [];
    const v = createBoardView({
      layer: { addChild: (c) => { added.push(c); return c; }, removeChild: (c) => c },
      criarDesenho: () => r.self,
      geometry: boardGeometry(size),
      palette: NORMAL,
    });
    return { v, calls: r.calls, added };
  }

  it('adds exactly one drawing to the layer', () => {
    expect(view().added).toHaveLength(1);
  });

  it('clears once per redraw, so frames do not accumulate', () => {
    const { v, calls } = view();
    const snapshot = { board: solved(4), movable: [], hint: [], travelling: [] };
    v.draw(snapshot); v.draw(snapshot);
    expect(calls.filter((c) => c.op === 'clear')).toHaveLength(2);
  });

  // ⚠️ THE STRUCTURAL PROOF OF ADR-0027. Not "we remembered not to draw text" — the port through
  // which this module draws HAS no text primitive, so the recorder can only ever see these.
  it('uses only rectangles and lines — there is no text primitive to misuse', () => {
    const { v, calls } = view();
    v.draw({
      board: solved(4),
      movable: [11, 14],
      hint: [14],
      travelling: [{ tile: 15, at: 15, dx: 12, dy: 0 }],
    });
    const ops = new Set(calls.map((c) => c.op));
    expect([...ops].sort()).toEqual(['beginFill', 'clear', 'drawRect', 'endFill', 'lineStyle', 'lineTo', 'moveTo']);
  });

  it('draws a body for every tile and none for the blank', () => {
    for (const n of SIZES) {
      const { v, calls } = view(n);
      const g = boardGeometry(n);
      v.draw({ board: solved(n), movable: [], hint: [], travelling: [] });
      const bodies = calls.filter(
        (c) => c.op === 'drawRect' && c.args[2] === g.cell && c.args[3] === g.cell,
      );
      // One well plus one body per tile; the blank's cell gets a well and no body.
      expect(bodies.length, `size ${n}`).toBe(n * n + (n * n - 1));
    }
  });

  it('draws the travelling tile at its offset, not at its cell', () => {
    const { v, calls } = view();
    const g = boardGeometry(4);
    const home = g.cellRect(15);
    v.draw({
      board: solved(4), movable: [], hint: [],
      travelling: [{ tile: 15, at: 15, dx: -13, dy: 0 }],
    });
    const bodies = calls.filter((c) => c.op === 'drawRect' && c.args[2] === g.cell && c.args[3] === g.cell);
    expect(bodies.some((c) => c.args[0] === home.x - 13 && c.args[1] === home.y)).toBe(true);
  });

  it('marks the movable tiles with an outline, and only those', () => {
    const board = solved(4);
    const movable = legalMoves(board).map((m) => m.from);
    const { v, calls } = view();
    v.draw({ board, movable, hint: [], travelling: [] });
    expect(calls.filter((c) => c.op === 'lineStyle' && c.args[0] === 1)).toHaveLength(movable.length);
  });

  it('lights the hinted tiles, and draws nothing extra when there is no hint', () => {
    const { v, calls } = view();
    const plain = { board: solved(4), movable: [], hint: [], travelling: [] };
    v.draw(plain);
    const without = calls.length;
    calls.length = 0;
    v.draw({ ...plain, hint: [14] });
    expect(calls.length).toBeGreaterThan(without);
  });

  it('follows a change of size and of palette without being rebuilt', () => {
    const { v, calls } = view(4);
    v.setGeometry(boardGeometry(5));
    v.setPalette(HIGH);
    calls.length = 0;
    v.draw({ board: solved(5), movable: [], hint: [], travelling: [] });
    const g = boardGeometry(5);
    expect(calls.some((c) => c.op === 'drawRect' && c.args[2] === g.cell)).toBe(true);
    expect(calls.some((c) => c.op === 'beginFill' && c.args[0] === 0xd99b00)).toBe(true);
  });
});

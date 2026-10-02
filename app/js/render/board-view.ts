// SPDX-License-Identifier: AGPL-3.0-or-later
// render/board-view — what the canvas draws, and it never draws a letter.
//
// ========================= PIXIJS IS NOT IMPORTED HERE =========================
// This module takes a `Layer` to add to and a `CreateDrawing` to make drawings with, both from the
// engine's `render/port.ts`, which is structural types and no renderer. The composition root — the
// only place PixiJS is known — hands in `() => new PIXI.Graphics()`. That is the adapter ADR-0035
// promised, in the shape the port says works: a VERB handed in, not an object borrowed.
//
// What it buys immediately: this file is tested in the NODE project, against a fake drawing that
// records its calls. The chess consumer's geometry needed a browser.
//
// ========================= ZERO GLYPHS IS STRUCTURAL HERE =========================
// ADR-0027 says the framebuffer holds no glyphs, because a screen reader cannot read a pixel. In
// this game that is not a rule anyone has to remember: `render/port.ts` HAS NO TEXT PRIMITIVE —
// `Desenho` is clear, beginFill, drawRect, endFill, and `DrawingWithLine` adds lineStyle, moveTo and
// lineTo. A glyph in the framebuffer is unrepresentable rather than merely unwritten, and the test
// asserts the recorder saw nothing else.
//
// The numbers live in the DOM, over this. See ui/tile-grid.
//
// ========================= AND THERE IS NO CURSOR MARKER =========================
// The chess consumer draws one, because its grid is `sr-only` and a sighted keyboard player would
// otherwise have focus somewhere invisible. Here the grid IS visible and IS the buttons, so the
// platform's own `:focus-visible` ring is the cursor — which respects forced-colors mode, as a
// rectangle drawn on a canvas cannot. One fewer thing to draw, and a better one.

import type { Layer, CreateDrawing, DrawingWithLine } from '@the-inclusionist/engine/render/port.js';
import type { Board } from '../puzzle/types.ts';
import { homeOf } from '../puzzle/board.ts';
import type { BoardGeometry, Rect } from './geometry.ts';
import { LOGICAL_H, LOGICAL_W } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Travelling } from './slide.ts';

export interface BoardSnapshot {
  readonly board: Board;
  /** Indices whose tile can slide right now — the declaration's `key` role, made visible. */
  readonly movable: readonly number[];
  /**
   * The tiles the hint says to press — the whole push, one to `size - 1` of them.
   *
   * ⚠️ IT USED TO BE AN ARROW IN THE DESTINATION, AND THAT WAS THE WRONG PICTURE. An arrow says
   * "something will arrive here"; what a player needs to know is WHICH TILES SHE IS ABOUT TO MOVE,
   * and with a push that is up to four of them at once. So the hint lights the tiles themselves.
   * Static, never blinking (WCAG 2.3.1).
   */
  readonly hint: readonly number[];
  readonly travelling: readonly Travelling[];
}

export interface BoardView {
  /** A full redraw. About thirty rectangles — cheaper than working out what changed. */
  draw(s: BoardSnapshot): void;
  setGeometry(g: BoardGeometry): void;
  setPalette(p: Palette): void;
  destroy(): void;
}

export interface BoardViewDeps {
  readonly layer: Layer;
  readonly createDrawing: CreateDrawing<DrawingWithLine>;
  readonly geometry: BoardGeometry;
  readonly palette: Palette;
}

const hex = (colour: string): number => parseInt(colour.replace('#', ''), 16);

export function createBoardView(deps: BoardViewDeps): BoardView {
  const g = deps.createDrawing();
  deps.layer.addChild(g);
  let geometry = deps.geometry;
  let palette = deps.palette;

  const fill = (r: Rect, colour: string): void => {
    g.beginFill(hex(colour)).drawRect(r.x, r.y, r.w, r.h).endFill();
  };

  /** A raised or recessed edge: two lines light, two dark. Depth without a gradient. */
  const bevel = (r: Rect, hi: string, lo: string, width = 1): void => {
    g.beginFill(hex(hi)).drawRect(r.x, r.y, r.w, width).drawRect(r.x, r.y, width, r.h).endFill();
    g.beginFill(hex(lo))
      .drawRect(r.x, r.y + r.h - width, r.w, width)
      .drawRect(r.x + r.w - width, r.y, width, r.h)
      .endFill();
  };

  return {
    setGeometry(next) { geometry = next; },
    setPalette(next) { palette = next; },
    destroy() { deps.layer.removeChild(g); },

    draw(s) {
      g.clear();
      fill({ x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H }, palette.backdrop);

      // The tray, recessed: light along the top and left, dark along the bottom and right.
      const tray = geometry.tray;
      fill(tray, palette.wellB);
      bevel(tray, palette.trayLo, palette.trayHi);

      // The wells. This is the upstream's checkerboard, and it is what shows through at the blank.
      for (let i = 0; i < s.board.length; i++) {
        const r = geometry.cellRect(i);
        const dark = ((i % geometry.size) + Math.floor(i / geometry.size)) % 2 === 0;
        fill(r, dark ? palette.wellA : palette.wellB);
      }

      const movable = new Set(s.movable);
      const hinted = new Set(s.hint);
      const flying = new Set(s.travelling.map((t) => t.at));

      for (let i = 0; i < s.board.length; i++) {
        const tile = s.board[i];
        if (tile === 0) continue;
        // Anything in flight is drawn LAST, offset, so it passes over its neighbours rather than
        // under them. Everything else is in place, because the model committed the push already.
        if (flying.has(i)) continue;
        drawTile(geometry.cellRect(i), tile, i);
      }

      for (const t of s.travelling) {
        const r = geometry.cellRect(t.at);
        drawTile({ ...r, x: r.x + t.dx, y: r.y + t.dy }, t.tile, t.at);
      }

      function drawTile(r: Rect, tile: number, index: number): void {
        const home = homeOf(tile) === index;
        fill(r, home ? palette.tileHome : palette.tileAway);
        bevel(r, palette.tileHi, palette.tileLo);
        // ⚠️ THE SECOND CARRIER. A settled tile differs from an unsettled one in VALUE (the fill
        // above) and in SHAPE (this inset line). Value survives every colour-vision filter; the line
        // survives a monochrome screen and forced-colors, where the palette does not apply at all.
        // WCAG 1.4.1 asks for one of these; shipping to a child asks for both.
        if (home && r.w > 6) {
          bevel({ x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, palette.tileLo, palette.tileHi);
        }
        // ⚠️ THE HINT LIGHTS THE TILES, and it is drawn thicker than the movable outline rather
        // than merely a different colour. Two states on the same square — "this can move" and "move
        // THIS" — separated only by hue would be a WCAG 1.4.1 failure and unreadable under every
        // colour-vision filter the engine ships. Weight is the second carrier.
        if (hinted.has(index) && r.w > 8) {
          const inset = 2;
          fill({ x: r.x + inset, y: r.y + inset, w: r.w - inset * 2, h: 2 }, palette.accent);
          fill({ x: r.x + inset, y: r.y + r.h - inset - 2, w: r.w - inset * 2, h: 2 }, palette.accent);
          fill({ x: r.x + inset, y: r.y + inset, w: 2, h: r.h - inset * 2 }, palette.accent);
          fill({ x: r.x + r.w - inset - 2, y: r.y + inset, w: 2, h: r.h - inset * 2 }, palette.accent);
        }
        // A tile that can slide gets a thin outline. Same information as the declaration's `key`
        // role, said to the eye instead of to the sonar.
        if (movable.has(index) && !hinted.has(index)) {
          g.lineStyle(1, hex(palette.accent), 1);
          g.moveTo(r.x + 0.5, r.y + 0.5).lineTo(r.x + r.w - 0.5, r.y + 0.5)
            .lineTo(r.x + r.w - 0.5, r.y + r.h - 0.5).lineTo(r.x + 0.5, r.y + r.h - 0.5)
            .lineTo(r.x + 0.5, r.y + 0.5);
          g.lineStyle(0);
        }
      }
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// render/board-view — what the canvas draws, and it never draws a letter.
//
// ========================= PIXIJS IS NOT IMPORTED HERE =========================
// This module takes a `Camada` to add to and a `CriarDesenho` to make drawings with, both from the
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
// `Desenho` is clear, beginFill, drawRect, endFill, and `DesenhoComLinha` adds lineStyle, moveTo and
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

import type { Camada, CriarDesenho, DesenhoComLinha } from '@the-inclusionist/engine/render/port.js';
import type { Board, Direction, Move } from '../puzzle/types.ts';
import { homeOf } from '../puzzle/board.ts';
import type { BoardGeometry, Rect } from './geometry.ts';
import { LOGICAL_H, LOGICAL_W } from './geometry.ts';
import type { Palette } from './palette.ts';
import type { Travelling } from './slide.ts';

export interface BoardSnapshot {
  readonly board: Board;
  /** Indices whose tile can slide right now — the declaration's `key` role, made visible. */
  readonly movable: readonly number[];
  /** The first move of the hint, or null. Shown as a static chevron; never blinking (WCAG 2.3.1). */
  readonly hint: Move | null;
  readonly travelling: Travelling | null;
}

export interface BoardView {
  /** A full redraw. About thirty rectangles — cheaper than working out what changed. */
  draw(s: BoardSnapshot): void;
  setGeometry(g: BoardGeometry): void;
  setPalette(p: Palette): void;
  destroy(): void;
}

export interface BoardViewDeps {
  readonly layer: Camada;
  readonly criarDesenho: CriarDesenho<DesenhoComLinha>;
  readonly geometry: BoardGeometry;
  readonly palette: Palette;
}

const hex = (colour: string): number => parseInt(colour.replace('#', ''), 16);

export function createBoardView(deps: BoardViewDeps): BoardView {
  const g = deps.criarDesenho();
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

  /**
   * A chevron pointing the way the hinted tile will travel, drawn as stacked rows so its edges land
   * on whole pixels. The engine's own icons are built this way (`game/props.ts`) for the same
   * reason: an anti-aliased diagonal at this resolution reads as a smudge.
   */
  const chevron = (r: Rect, direction: Direction, colour: string): void => {
    const rows = Math.max(3, Math.min(7, (r.h >> 2) | 1));
    const cx = r.x + (r.w >> 1);
    const cy = r.y + (r.h >> 1);
    g.beginFill(hex(colour));
    const half = rows >> 1;
    for (let i = 0; i < rows; i++) {
      const span = 1 + i * 2;
      if (direction === 'up') g.drawRect(cx - i, cy - half + i, span, 1);
      else if (direction === 'down') g.drawRect(cx - i, cy + half - i, span, 1);
      else if (direction === 'left') g.drawRect(cx - half + i, cy - i, 1, span);
      else g.drawRect(cx + half - i, cy - i, 1, span);
    }
    g.endFill();
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
      for (let i = 0; i < s.board.length; i++) {
        const tile = s.board[i];
        if (tile === 0) continue;
        // The travelling tile is drawn LAST, offset, so it passes over its neighbour rather than
        // under it. Everything else is in place, because the model committed the move already.
        if (s.travelling && s.travelling.at === i) continue;
        drawTile(geometry.cellRect(i), tile, i);
      }

      if (s.travelling) {
        const r = geometry.cellRect(s.travelling.at);
        drawTile({ ...r, x: r.x + s.travelling.dx, y: r.y + s.travelling.dy }, s.travelling.tile, s.travelling.at);
      }

      // The hint's chevron sits in the DESTINATION — the empty square the tile is going to — because
      // that is the thing the player has to look at, and because a marker on the tile would compete
      // with the focus ring on the same cell.
      if (s.hint) chevron(geometry.cellRect(s.hint.to), s.hint.direction, palette.accent);

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
        // A tile that can slide gets an outline. Same information as the declaration's `key` role,
        // said to the eye instead of to the sonar.
        if (movable.has(index)) {
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

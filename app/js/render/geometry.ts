// SPDX-License-Identifier: AGPL-3.0-or-later
// render/geometry — where everything is, in logical pixels AND in percentages.
//
// ========================= ONE GEOMETRY, TWO SURFACES =========================
// The tile bodies are drawn into a 320x180 framebuffer; the tile NUMBERS are DOM elements laid over
// it. They must land on the same pixel, and the only way to guarantee that without measuring
// anything at runtime is for both to be derived here.
//
// The percentages are exact rather than approximate, and that is the trick the whole DOM-over-canvas
// design rests on: the engine sizes `#game-region` to exactly 320k by 180k with k a whole number
// (ADR-0001), so a child element at `left: 2.5%` sits at logical x = 8 at every k, on every device
// pixel ratio, with no `getBoundingClientRect` anywhere.
//
// ========================= THE NUMBERS, AND WHY THEY ARE THESE NUMBERS =========================
// Base 320x180 with a safe area of 304x170 (ADR-0027): nothing essential may live in the margin,
// because the layout tolerates losing up to five logical pixels a side. The tray is 160x160 at
// x = 8..168, y = 10..170 — inside the safe area on every edge, for all three board sizes.
//
// A cell is `floor((160 - gap*(n+1)) / n)`, and the leftover is folded into the tray's own padding
// so every cell is a WHOLE number of pixels. A fractional cell would put the canvas body and the DOM
// number on different pixels at some k and not at others, which is the seam this file exists to
// close:
//
//   n | cell | interior | at the k=2 floor
//   3 |  50  |   158    | 100 CSS px
//   4 |  37  |   158    |  74 CSS px
//   5 |  29  |   157    |  58 CSS px
//
// ⚠️ The 44 CSS px floor of WCAG 2.5.5 is met by GEOMETRY, not by a `min-height`: a minimum on the
// cell would break the percentage grid and unstick the numbers from the art. `tap-target.browser`
// measures it instead. The invariant holds to 6x6 (cell 24 >= 22 logical) and fails at 7x7
// (20 < 22), so the 5x5 cap is a PRODUCT choice and not a technical limit.

/** The engine's base. Not ours to choose — `screenBaseSize(1)` is exactly this. */
export const LOGICAL_W = 320;
export const LOGICAL_H = 180;

/** ADR-0027's safe area: nothing essential outside this. */
export const SAFE = { x: 8, y: 5, w: 304, h: 170 } as const;

export const BOARD = { x: 8, y: 10, size: 160 } as const;
/** x = 176..320. The chess consumer's panel is 27.5% wide; this one can afford 45% because the
 *  engine's `--ui-fs` is 8k here against 16k there — 144 logical px at an 8px base is ~18 columns. */
export const HUD = { x: 176, w: 144 } as const;
export const GAP = 2;

/** The three sizes this game offers. The cap is a product decision; see the header. */
export const SIZES = [3, 4, 5] as const;
export type Size = (typeof SIZES)[number];

export interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export interface BoardGeometry {
  readonly size: number;
  /** Cell side in logical pixels. Always a whole number — see the header. */
  readonly cell: number;
  readonly gap: number;
  /** The tray's own box, in logical pixels. */
  readonly tray: Rect;
  /** Where the cells actually start, once the leftover has been folded into the padding. */
  readonly origin: { readonly x: number; readonly y: number };
  /** A cell's box in LOGICAL pixels, for the canvas. */
  cellRect(index: number): Rect;
  /** The same box as PERCENTAGES OF THE TRAY, for the DOM. */
  cellPercent(index: number): { left: number; top: number; width: number; height: number };
  /** A row's strip as percentages of the tray. Rows are positioned, not `display: contents`. */
  rowPercent(row: number): { top: number; height: number };
  /**
   * The multiplier the DOM digit uses: `font-size: calc(var(--ui-fs) * --num-fs)`.
   *
   * NOT `--ui-fs` alone. That is 16 CSS px at the k=2 floor, which overflows a 5x5 tile — but it is
   * still the right thing to scale FROM, because it is the engine's own scale and it moves when the
   * child changes her typography. So the digit rides the engine's scale and is sized by the TILE.
   */
  readonly numberScale: number;
}

export function boardGeometry(size: number): BoardGeometry {
  if (!Number.isInteger(size) || size < 2) throw new RangeError(`board size must be a whole number >= 2: ${size}`);
  const cell = Math.floor((BOARD.size - GAP * (size + 1)) / size);
  if (cell < 1) throw new RangeError(`board size ${size} leaves no room for a cell`);
  const interior = size * cell + GAP * (size + 1);
  const pad = Math.floor((BOARD.size - interior) / 2);
  const origin = { x: BOARD.x + pad, y: BOARD.y + pad };
  const tray: Rect = { x: BOARD.x, y: BOARD.y, w: BOARD.size, h: BOARD.size };

  const step = cell + GAP;
  const cellRect = (index: number): Rect => ({
    x: origin.x + GAP + (index % size) * step,
    y: origin.y + GAP + Math.floor(index / size) * step,
    w: cell,
    h: cell,
  });

  return {
    size,
    cell,
    gap: GAP,
    tray,
    origin,
    cellRect,
    cellPercent(index) {
      const r = cellRect(index);
      return {
        left: ((r.x - tray.x) / tray.w) * 100,
        top: ((r.y - tray.y) / tray.h) * 100,
        width: (r.w / tray.w) * 100,
        height: (r.h / tray.h) * 100,
      };
    },
    rowPercent(row) {
      const r = cellRect(row * size);
      return { top: ((r.y - tray.y) / tray.h) * 100, height: (r.h / tray.h) * 100 };
    },
    // 0.55 of the cell is about the largest a two-digit number sits at comfortably; dividing by the
    // engine's 8px logical base turns it into a multiplier of `--ui-fs`.
    numberScale: (cell * 0.55) / 8,
  };
}

/** Percentages of `#game-region` for the tray and the HUD, so the CSS and this module agree. */
export const LAYOUT = {
  tray: {
    left: (BOARD.x / LOGICAL_W) * 100,
    top: (BOARD.y / LOGICAL_H) * 100,
    width: (BOARD.size / LOGICAL_W) * 100,
    height: (BOARD.size / LOGICAL_H) * 100,
  },
  hud: { left: (HUD.x / LOGICAL_W) * 100, width: (HUD.w / LOGICAL_W) * 100 },
} as const;

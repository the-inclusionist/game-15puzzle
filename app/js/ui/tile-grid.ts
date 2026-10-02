// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/tile-grid — THE board. One grid, for everybody.
//
// ========================= THE DECISION THIS FILE IS =========================
// ADR-0027 puts zero glyphs in the framebuffer: text lives in the DOM, because a screen reader
// cannot read a pixel. A 15-puzzle is fifteen numbers, so the numbers are DOM elements laid over the
// canvas — and that turns out to be better than a workaround.
//
// The chess consumer needs TWO grids: a canvas nobody can read, and an invisible `sr-only` mirror
// carrying the board for assistive technology, with a cursor marker drawn on the canvas because a
// sighted keyboard player's focus would otherwise sit somewhere they cannot see. Here the numbers
// are VISIBLE TEXT, so one `role="grid"` of real buttons serves both audiences, and the platform's
// own `:focus-visible` ring is the cursor — which honours forced-colors mode, as a rectangle drawn
// on a canvas cannot.
//
// ========================= ⚠️ THE BUTTON IS THE CELL, NOT THE TILE =========================
// This was nearly built the other way round, and it is the mistake worth naming. If the button IS
// the tile — so it can be transformed across the board — then after every move DOM order no longer
// matches visual order. A screen reader walks the accessibility tree, not the screen: `role="grid"`
// stops being true, arrow navigation follows a sequence that is no longer the board, and WCAG 1.3.2
// (Meaningful Sequence) fails on every move.
//
// So cells are fixed and row-major forever, `aria-label` is rewritten per move, and what SLIDES is
// the `<span>` inside the destination cell — pushed back toward where the tile came from and
// released. One element moving over one empty neighbour.
//
// The cost is stated rather than hidden: focus does NOT travel with the tile, because the focused
// element is a square and squares do not move. The run's cursor follows the tile to its destination
// instead, so her next Enter still reaches what she just pressed, and the announcement says where
// it went.
//
// ========================= ARROWS MOVE THE CURSOR; THEY DO NOT PUSH =========================
// Both models exist in the wild. This one, because:
//  1. ONE FUNNEL. A pointer tap, Enter and Space all reach `run.activate(index)`. Keyboard and
//     pointer cannot drift apart if there is nowhere for them to drift to.
//  2. IT IS WHAT `role="grid"` MEANS. Arrows move focus and Enter activates is THE ARIA grid
//     pattern, and roving tabindex is defined against it. Arrows that moved TILES would make the
//     grid lie about being a grid, and a reader announcing "row 2, column 3" after a key that moved
//     a tile is announcing a contradiction.
//  3. Blank-pushing carries an irreducible ambiguity — does Left move the blank left, or the tile
//     left? — and has no way to say "nothing there" except a beep.
//
// There is no undo, and none is needed: the inverse of any move is always legal and always one
// keypress away. Worth saying, because "no undo" otherwise reads as an omission.

import type { BoardGeometry } from '../render/geometry.ts';

import type { Travelling } from '../render/slide.ts';
import type { Run } from '../puzzle/run.ts';
import type { I18n } from '../i18n/index.ts';
import { describeCell } from '../declaration/puzzle-declaration.ts';

export interface TileGridDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** The CURRENT run. A getter: a size change replaces the object. */
  run(): Run;
  geometry(): BoardGeometry;
  /** Called when a cell is activated, by any route. */
  onActivate(index: number): void;
}

export interface TileGrid {
  readonly root: HTMLElement;
  /**
   * MOVE THE CURSOR ONE STEP, called by whoever delivers input — in production the cartridge's
   * `onCommand(VirtualCommand)` dispatcher (ADR-0111 §1: the cartridge never reads keys). Clamped
   * at the edges, never wrapped — a sliding puzzle has corners, and a cursor reappearing on the far
   * side would tell a blind player the board is a torus.
   */
  move(dir: 'up' | 'down' | 'left' | 'right'): void;
  /** Activate the tile under the current cursor, as a native click would. */
  activate(): void;
  /** Rebuild labels, states and numbers from the run. Cheap: it writes, it does not recreate. */
  refresh(): void;
  /** Rebuild the whole grid — a new board size, or a language change. */
  rebuild(): void;
  /** Move the travelling numbers. Called once per frame, from the same callback as the canvas. */
  setOffset(travelling: readonly Travelling[]): void;
  /** Light the tiles the hint says to press — one to `size - 1` of them. Empty clears it. */
  setHint(indices: readonly number[]): void;
  /** Put focus on the run's cursor cell. */
  focusCursor(): void;
  /**
   * Hold the board out of the tab order while a dialog is open.
   *
   * ⚠️ MANDATORY, NOT POLISH. The engine installs no focus trap anywhere — `ui/settings-panel` says
   * so in as many words — and its menu key handler does not cover Tab. A visible grid of twenty-five
   * buttons behind an open overlay is directly Tab-reachable, which is WCAG 2.4.11 (Focus Not
   * Obscured) and 2.1.2. axe will not catch it, because it is an interaction and not markup.
   */
  setInert(on: boolean): void;
  destroy(): void;
}

export function createTileGrid(deps: TileGridDeps): TileGrid {
  const { doc, i18n } = deps;
  const root = doc.createElement('div');
  root.className = 'board';
  root.setAttribute('role', 'grid');

  let cells: HTMLButtonElement[] = [];
  let hint: readonly number[] = [];

  const cellAt = (index: number): HTMLButtonElement | undefined => cells[index];

  /** The one door in. A click, a native Enter/Space on a focused button, and `onCommand(action1)`
   *  from any transport all arrive here. */
  const activate = (index: number): void => { deps.onActivate(index); };

  /**
   * Move the cursor by one in one direction, clamped. Called from `onCommand({action: 'up'|…})`
   * delivered by the virtual controller — no key reading here (ADR-0111 §1).
   */
  function moveCursor(dir: 'up' | 'down' | 'left' | 'right'): void {
    const run = deps.run();
    const n = run.size;
    const cursor = run.cursor();
    const x = cursor % n; const y = Math.floor(cursor / n);
    const nx = Math.min(n - 1, Math.max(0, x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)));
    const ny = Math.min(n - 1, Math.max(0, y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0)));
    const target = ny * n + nx;
    if (target === cursor) return;
    run.setCursor(target);
    refresh();
    cellAt(target)?.focus();
  }

  function build(): void {
    const g = deps.geometry();
    const run = deps.run();
    const n = run.size;
    root.textContent = '';
    root.style.setProperty('--num-fs', String(g.numberScale));
    root.setAttribute('aria-rowcount', String(n));
    root.setAttribute('aria-colcount', String(n));
    root.setAttribute('aria-label', `${i18n.t('a11y.boardLabel', { size: n })}. ${i18n.t('a11y.gridHint')}`);

    cells = [];
    for (let y = 0; y < n; y++) {
      const row = doc.createElement('div');
      row.setAttribute('role', 'row');
      row.setAttribute('aria-rowindex', String(y + 1));
      const strip = g.rowPercent(y);
      row.style.top = `${strip.top}%`;
      row.style.height = `${strip.height}%`;
      for (let x = 0; x < n; x++) {
        const index = y * n + x;
        const cell = doc.createElement('button');
        cell.type = 'button';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-colindex', String(x + 1));
        cell.dataset.index = String(index);
        const box = g.cellPercent(index);
        cell.style.left = `${box.left}%`;
        cell.style.width = `${box.width}%`;
        const num = doc.createElement('span');
        num.className = 'tile-num';
        num.setAttribute('aria-hidden', 'true');
        cell.appendChild(num);
        row.appendChild(cell);
        cells.push(cell);
      }
      root.appendChild(row);
    }
    refresh();
  }

  function refresh(): void {
    const run = deps.run();
    const board = run.board();
    const cursor = run.cursor();
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const tile = board[i];
      cell.dataset.tile = String(tile);
      // aria-disabled and NOT `disabled`: a disabled button is a hole in a roving-tabindex grid, and
      // some readers skip it entirely — so the child never learns the empty square is there.
      if (tile === 0) cell.setAttribute('aria-disabled', 'true');
      else cell.removeAttribute('aria-disabled');
      cell.setAttribute('aria-label', describeCell({ run: deps.run, i18n }, i));
      // Roving tabindex: exactly one cell is in the tab order at any moment.
      cell.tabIndex = i === cursor ? 0 : -1;
      const num = cell.firstElementChild as HTMLElement | null;
      if (num) {
        num.textContent = tile === 0 ? '' : String(tile);
        num.style.transform = '';
      }
      if (hint.includes(i)) cell.dataset.hint = '1';
      else delete cell.dataset.hint;
    }
  }

  const onClick = (event: Event): void => {
    const cell = (event.target as HTMLElement | null)?.closest('[data-index]') as HTMLElement | null;
    if (!cell?.dataset.index) return;
    activate(Number(cell.dataset.index));
  };

  /**
   * ⚠️ NO `keydown` LISTENER (ADR-0111). The grid read keys as a transport in engine 8–10 because
   * `onCommand` did not exist. In 11.0.0 the engine delivers `VirtualCommand`s from EVERY transport —
   * keyboard, pad, touch, eyes, voice, scan — through one callback the cartridge passes to
   * `createGame`. The grid stopped being a transport; it became the receiver.
   *
   * The native `click` handler stays: it answers pointer and touch, AND it is what Enter/Space on a
   * focused `<button>` fire. The engine's `keyboardMapping` of ADR-0115 moves Enter OFF the engine's
   * `start` position (its default) so Enter no longer opens the pause card for a child whose focus
   * is on a tile — the native button activation is the one that fires.
   *
   * Home/End are not supported here. The engine's keyboard runtime has no concept for them, and
   * reading them locally would reintroduce exactly the key coupling ADR-0111 forbids. A cursor can
   * reach a corner with repeated arrow presses.
   */
  root.addEventListener('click', onClick);
  build();

  return {
    root,
    refresh,
    rebuild: build,

    setOffset(travelling) {
      // Written in the SAME callback as the canvas draw, from the same integer offset. A number is
      // rendered in its DESTINATION cell — the model committed the push already — pushed back
      // toward where it came from. `dx / cell` of a button that is `cell * k` CSS px wide is
      // `dx * k` CSS px, which is exactly what the canvas moved, at every k, with nothing measured.
      //
      // ⚠️ THE SPAN MUST FILL THE CELL for that percentage to mean the cell's width. See the rule in
      // app/css/style.css; without it the number travels a sixth of the distance the tile does.
      const g = deps.geometry();
      for (const cell of cells) {
        const num = cell.firstElementChild as HTMLElement | null;
        if (num && num.style.transform) num.style.transform = '';
      }
      for (const t of travelling) {
        const num = cellAt(t.at)?.firstElementChild as HTMLElement | null;
        if (num) num.style.transform = `translate(${(100 * t.dx) / g.cell}%, ${(100 * t.dy) / g.cell}%)`;
      }
    },

    setHint(indices) {
      hint = indices;
      for (const cell of cells) delete cell.dataset.hint;
      for (const index of indices) {
        const cell = cellAt(index);
        if (cell) cell.dataset.hint = '1';
      }
    },

    focusCursor() { cellAt(deps.run().cursor())?.focus(); },

    setInert(on) {
      if (on) root.setAttribute('inert', '');
      else root.removeAttribute('inert');
    },

    move: moveCursor,
    activate: () => activate(deps.run().cursor()),

    destroy() {
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// render/surface — the PixiJS application, and one of only two files that names PixiJS.
//
// ========================= THE INVARIANT THIS FILE HOLDS =========================
// The backing store is 320x180 and stays 320x180 however large the CSS box gets. `resolution: 1` is
// what says so, and it is load-bearing rather than a default worth restating: left alone, a Pixi
// application follows `devicePixelRatio`, the framebuffer comes out two or three times too large,
// the low resolution that is pillar 5 evaporates — and NOTHING reports an error. The chess consumer
// hit the same class of bug through Zdog and wrote the same warning over it.
//
// The upscale is the engine's job (`ui/layout`), in whole PHYSICAL pixels, and this game does not
// fork it: `screenBaseSize(1)` is exactly 320x180, so the reason chess had to fork — a game whose
// source resolution differs from the engine's has no way to say so — simply does not arise here.
//
// ⚠️ THE CANVAS IS SCENERY. `aria-hidden` and `pointer-events: none`, both set here rather than in
// the stylesheet, because they are not styling: they are the statement that the DOM grid above is
// the board as far as a person and a screen reader are concerned. A stylesheet edit could drop them
// without anything looking wrong.

import * as PIXI from 'pixi.js';
import { LOGICAL_H, LOGICAL_W } from './geometry.ts';
import type { Camada, CriarDesenho, DesenhoComLinha } from '@the-inclusionist/engine/render/port.js';

export interface Surface {
  readonly view: HTMLCanvasElement;
  /** Handed to the board view as a `Camada` — it only ever adds and removes children. */
  readonly layer: Camada;
  /** The verb the board view draws with. The adapter ADR-0035 promised, in the port's own shape. */
  readonly criarDesenho: CriarDesenho<DesenhoComLinha>;
  /** Structurally satisfies `startLoop`'s Ticker. */
  readonly ticker: { add: (fn: () => void) => void; deltaTime: number };
  render(): void;
  destroy(): void;
}

export function createSurface(): Surface {
  // Inside the factory, not at module scope: ADR-0038 forbids module-level mutable state, and a
  // global settings object mutated at import time is exactly that, one import away from a second
  // game on the same page.
  PIXI.settings.ROUND_PIXELS = true;

  const app = new PIXI.Application({
    // ⚠️ NO SECOND CLOCK. The loop belongs to the shell (ADR-0139 §3) and this game renders
    // explicitly, from `update(dt)`. Left on, the application would start its own ticker and render
    // beside the one the shell drives — two clocks for one 320x180 surface, on hardware pillar 1
    // describes as weak.
    autoStart: false,
    width: LOGICAL_W,
    height: LOGICAL_H,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 1,
    powerPreference: 'low-power',
  });

  const view = app.view as unknown as HTMLCanvasElement;
  view.id = 'board-canvas';
  view.setAttribute('aria-hidden', 'true');
  view.style.pointerEvents = 'none';

  return {
    view,
    layer: app.stage as unknown as Camada,
    criarDesenho: () => new PIXI.Graphics() as unknown as DesenhoComLinha,
    ticker: app.ticker,
    render: () => app.renderer.render(app.stage),
    destroy: () => app.destroy(true),
  };
}

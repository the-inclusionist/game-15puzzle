// SPDX-License-Identifier: AGPL-3.0-or-later
// render/slide — one clock, one rounding, two surfaces.
//
// ========================= THE SEAM THIS FILE EXISTS TO REMOVE =========================
// The tile body is drawn on the canvas; the number is a DOM element over it. A sliding tile is
// therefore two things moving, and the obvious implementation — a CSS transition on the number and
// a tween on the canvas — has SEVEN ways to come apart, every one of which shows as the digit
// shearing off its tile:
//
//   1. Two clocks. A CSS transition runs on the compositor's timeline; the canvas advances by the
//      engine ticker's dt, which `startLoop` CLAMPS. Any frame over the clamp, the canvas falls
//      behind by exactly the discarded time and never catches up.
//   2. Two units. `dt` here is counted in FRAMES; a CSS transition is specified in MILLISECONDS.
//      They agree at 60 Hz and nowhere else — on a 120 Hz panel one takes half as long.
//   3. Tab visibility. rAF stops when the tab is hidden; transitions are throttled differently.
//   4. Rounding. The canvas cannot draw a fractional pixel; the DOM can, and antialiases it.
//   5. Reduced motion reaching one surface only — a media query kills the transition and the tween
//      keeps running, and the in-game switch is the same failure mirrored.
//   6. The loop's error boundary stopping the canvas mid-slide while the transition completes alone.
//   7. An announcement fired while the label is mid-transition.
//
// So: NO CSS TRANSITION ANYWHERE. This module owns `t`; the frame function advances it once and then
// writes both surfaces in the same callback from the same integer. Drift stops being managed and
// becomes impossible — and reduced motion becomes one branch (`duration = 0`) instead of a media
// query that only reaches half the screen.
//
// ========================= THE MODEL COMMITS FIRST =========================
// The move is applied to the board IMMEDIATELY — the upstream does the same — and the animation is
// decoration over a board that is already correct. So labels, aria-* and the objective count are
// right from frame zero, and a reader is never told about a state that is still arriving.
//
// What travels is therefore drawn in its DESTINATION cell, pushed BACK toward where it came from and
// released: `offset = (origin - destination) * (1 - ease(t))`. One element moving over one empty
// neighbour, no re-parenting, no z-index to lose.

import type { Move } from '../puzzle/types.ts';

/** Cubic ease-out. The engine has the same curve in `render/fx`, which we do not import — see below. */
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

export interface Travelling {
  readonly tile: number;
  /** The cell it is drawn in: its DESTINATION, because the model has already committed. */
  readonly at: number;
  /** Logical-pixel offset from that cell. Whole numbers, always. */
  readonly dx: number;
  readonly dy: number;
}

export interface Slide {
  /** Start animating `move`. Replaces anything in flight — input is refused while one is. */
  begin(move: Move, size: number, step: number): void;
  /** Advance by `dt` FRAMES. Returns true while something is still moving. */
  advance(dt: number): boolean;
  /** What is in flight, or null. Both surfaces read THIS and nothing else. */
  travelling(): Travelling | null;
  active(): boolean;
  /** Drop the animation without finishing it — a size change, a reshuffle, a teardown. */
  cancel(): void;
}

export interface SlideOptions {
  /** In FRAMES, not milliseconds. Seven is about 120 ms at 60 Hz and reads as a slide, not a jump. */
  readonly frames?: number;
  /**
   * Whether motion is reduced. A FUNCTION, read per slide: the OS preference and the in-game switch
   * both feed it, and both must be able to change without rebuilding anything.
   */
  readonly reduced?: () => boolean;
}

export function createSlide(o: SlideOptions = {}): Slide {
  const frames = o.frames ?? 7;
  const reduced = o.reduced ?? (() => false);

  let move: Move | null = null;
  let size = 0;
  let step = 0;          // cell + gap, in logical pixels
  let t = 1;

  const offsets = (): { dx: number; dy: number } => {
    if (!move) return { dx: 0, dy: 0 };
    const back = 1 - easeOut(t);
    const dxCells = (move.from % size) - (move.to % size);
    const dyCells = Math.floor(move.from / size) - Math.floor(move.to / size);
    // ⚠️ ONE rounding, here, shared. The canvas cannot draw half a pixel; if the DOM moved smoothly
    // the two would separate by up to a pixel every frame. Quantising both to the same integer makes
    // that impossible — and it makes the slide read as pixel-art motion rather than as a CSS ease,
    // which is the right look for a 320x180 game anyway.
    return { dx: Math.round(dxCells * step * back), dy: Math.round(dyCells * step * back) };
  };

  return {
    begin(next, boardSize, cellStep) {
      move = next; size = boardSize; step = cellStep;
      // Reduced motion is ONE branch: the slide is constructed already finished, so the tile
      // teleports and the whole path collapses into the same code. No media query, which is the
      // only way the system preference and the in-game switch can agree.
      t = reduced() ? 1 : 0;
    },

    advance(dt) {
      if (!move || t >= 1) return false;
      t = Math.min(1, t + dt / frames);
      if (t >= 1) { move = null; return false; }
      return true;
    },

    travelling() {
      if (!move) return null;
      const { dx, dy } = offsets();
      return { tile: move.tile, at: move.to, dx, dy };
    },

    active: () => move !== null,
    cancel() { move = null; t = 1; },
  };
}

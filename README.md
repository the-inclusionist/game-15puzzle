# Inclusionist 15 Puzzle — a sliding puzzle you can play without seeing it

Slide numbered tiles into the one empty square until they are in order. 3×3, 4×4 or 5×5, drawn
procedurally at **320×180** and upscaled by a whole number of physical pixels.

Everything below the game comes from `@the-inclusionist/engine` through a single `createGame()`
call: screen reader, Libras, colour-vision filters, blind-navigation sonar, remappable input as
intent, typography, dialog stack and menu navigation.

## The one decision this game is built around

A 15 puzzle is fifteen **numbers**, and the engine's rule is that a framebuffer holds **zero
glyphs** — text lives in the DOM, because a screen reader cannot read a pixel (ADR-0010 pillar 2,
ADR-0027).

So the numbers are DOM, laid over the canvas, and the tile bodies are procedural art inside it. That
buys something the chess consumer cannot have: because the numbers are *visible* text, **one grid
serves everyone**. Chess needs two — a canvas nobody can read and an invisible `sr-only` mirror that
carries the board for assistive technology. Here there is a single `role="grid"` of real buttons.
The platform's own `:focus-visible` ring is the cursor, so it honours forced-colors mode, which a
rectangle drawn on a canvas cannot.

Two consequences worth stating, because both were nearly designed wrong:

- **The button is the CELL, not the tile.** A tile that carried its own button would leave DOM order
  disagreeing with visual order after every move, and a screen reader walks the accessibility tree,
  not the screen. Cells stay put, labels are rewritten, and what slides is the number *inside* the
  destination cell.
- **One clock, no CSS transition.** The canvas tile body and the DOM number are advanced by the same
  `dt`, in the same callback, quantised to the same whole logical pixel. Drift is impossible by
  construction rather than managed, and reduced motion is one branch instead of a media query that
  only reaches half the screen.

## Running it

```
npm install          # links the engine from ../SP-the-inclusionist-tracer
npm run dev
npm run validate     # typecheck + vitest (node & browser) + build — all three must be clean
```

⚠️ **Do not verify through `vite dev`.** Build, serve `dist/`, unregister the service worker, clear
its caches and cache-bust the HTML — then compare the `<script src>` hash in the served page against
what `dist/` actually contains. If they differ, the observation is void. `?debug=true` exposes
`window.__puzzle` with a `step(dt)` so a frame can be advanced by hand: a hidden browser pane never
fires `requestAnimationFrame`, and an animation that only advances when someone takes a screenshot
cannot be verified at all.

`?seed=<n>` reproduces a shuffle. Determinism is a requirement (ADR-0049), so the seed is recorded
rather than hidden.

## Layout

```
app/js/puzzle/        board, rng, shuffle, solver, run — PURE. Imports nothing, not even the engine.
app/js/declaration/   the seven declared fields (ADR-0027), said in sliding tiles.
app/js/render/        geometry, palette, slide, board-view — PixiJS-free, through render/port.ts.
app/js/ui/            the tile grid and the HUD. DOM.
app/js/i18n/          pt (base), en, es — registered into the engine's own t().
app/js/boot/main.ts   the composition root, and with render/surface.ts the only file naming PixiJS.
```

There is no `adr/` directory and there never will be one: the records live in the engine, where the
validator and the supersession graph already are (ADR-0068 §5). Game-local reasoning lives in file
headers. Anything architectural becomes an ADR **there**.

## CI

`.github/workflows/ci.yml` invokes the organisation's reusable workflow rather than carrying a copy
of it (ADR-0068 §4 — three hundred copies of a pipeline drift, and the ones that drift silently are
the ones that stop gating).

⚠️ **It cannot go green yet.** The engine is consumed as `file:../SP-the-inclusionist-tracer`, a
sibling directory that does not exist on a runner, and `the-inclusionist/the-inclusionist-engine` is
still an empty repository. The workflow checks out both, so the first green run arrives when the
engine is mirrored to GitHub. Until then the gates run locally through `npm run validate`.

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records how the section 13 source offer works
while the repository is still private.

Original 15 Puzzle by **arnisritins** (MIT) — <https://github.com/arnisritins/15-Puzzle>. The
reference for what the game is; no code is taken from it, since that project renders with positioned
DOM spans and CSS transitions and this one draws into a PixiJS framebuffer. **PixiJS** by the PixiJS
team (MIT).

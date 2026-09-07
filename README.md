# Inclusionist 15 Puzzle — a sliding puzzle you can play without seeing it

Slide numbered tiles into the one empty square until they are in order. 3×3, 4×4 or 5×5, drawn
procedurally at **320×180** and upscaled by a whole number of physical pixels.

Pressing any tile in the empty square's row or column slides the whole line — one press, up to four
tiles. The upstream this game remakes only ever shifts the single adjacent tile, so this is an
improvement on the reference rather than parity with it. It counts as ONE move, because the counter
records what the player did and she did one thing; the same displacement made one press at a time
counts three.

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
npm install          # the engine comes from npmjs, pinned exact
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

`.github/workflows/ci.yml` invokes the reusable workflow that lives in the **engine repository**
(`the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml`) and copies nothing of it —
ADR-0068 §4, and ADR-0067 §5 is why it lives there rather than in a `.github` repository nobody's
record declares. It runs with `a11y: true`, which is not a default: the input exists so that skipping
pillar 2 is a visible line rather than an absence.

The engine comes from **public npmjs**, pinned exact at `7.0.1` (ADR-0072), so the gate has
everything it needs: `npm ci` resolves from the registry and there is no sibling directory to be
missing. That was the last thing standing between this repository and a green pipeline.

To develop against a local engine checkout: `npm install ../SP-the-inclusionist-tracer`, which is
ADR-0036's loop — link locally, pin remotely — and revert before committing.

## No neural voice, on purpose

The engine takes the neural text-to-speech engine as a **port** (ADR-0094): a game passes
`carregarVozNeural` if it wants one. This game does not, so narration goes through Web Speech —
which speaks the right language, works offline and weighs nothing — and the audio panel stops
*offering* an engine it could not load, rather than offering one that never arrives.

The trade is measured, not assumed. Passing the port would put **27 MB of WASM** in the build and
**135 MB** in every `node_modules` (`onnxruntime-web` is a non-optional peer of the provider), for a
game whose entire spoken content is "tile 7 to the left". ADR-0058 targets under 30 MB for a school
download; **this game's whole `dist/` is 640 KB in seven files.**

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records how the section 13 source offer works
while the repository is still private.

Original 15 Puzzle by **arnisritins** (MIT) — <https://github.com/arnisritins/15-Puzzle>. The
reference for what the game is; no code is taken from it, since that project renders with positioned
DOM spans and CSS transitions and this one draws into a PixiJS framebuffer. **PixiJS** by the PixiJS
team (MIT).

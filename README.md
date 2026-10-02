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
npm install          # the engine is a peer AND a devDependency - see docs/LICENSES.md
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
app/js/cartridge.ts   THE CARTRIDGE: `createCartridge()` -> declaration, hooks, dicts, create(ctx).
                      Calls no createGame, opens no loop, reads no address, does nothing on import.
app/js/boot/standalone.ts  the app SHELL: createGame, the ctx, the clock, the voice, Libras, Vlibras.
```

## Two artifacts, one source

`npm run build` produces the **standalone PWA** — `app/index.html`, engine and Pixi bundled, and the
route a developer, a reviewer or an accessibility audit actually opens. `npm run build:lib` produces
the **cartridge**: `dist-lib/cartridge.js`, 35 kB, with the engine and Pixi left external so a
platform installs exactly one copy of each for every game it carries (ADR-0139, ADR-0140).

⚠️ **The standalone build is a development, audit and demonstration route — never a delivery route to
a child.** The moment one is deployed for children, every word of ADR-0117 applies: Cache Storage
partitions by origin, the accessibility profile stops following the child between games, and a school
network has a second address to allow.

`npm run validate` builds both, because a change tested only in the app build can break the lib build
and nothing notices until a platform installs it.

⚠️ **And `engine.problems` is no longer empty**, with exactly one line: the engine resolves the
declaration's `world()` selector at boot, and `#world` is created by the cartridge afterwards. The
effect is diagnostic only — the vision filter resolves the selector at the point of use, and the boot
protocol measures it landing on the board while sparing the bar and the panel. The shell names that
one line and throws on any other. It is evidence for ADR-0142, which gives the engine a `mount()` for
exactly this and is accepted but not built.

There is no `adr/` directory and there never will be one: the records live in the engine, where the
validator and the supersession graph already are (ADR-0068 §5). Game-local reasoning lives in file
headers. Anything architectural becomes an ADR **there**.

## CI

`.github/workflows/ci.yml` invokes the reusable workflow that lives in the **engine repository**
(`the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml`) and copies nothing of it —
ADR-0068 §4, and ADR-0067 §5 is why it lives there rather than in a `.github` repository nobody's
record declares. It runs with `a11y: true`, which is not a default: the input exists so that skipping
pillar 2 is a visible line rather than an absence.

The engine comes from **public npmjs**, pinned exact at `11.0.0` (ADR-0072), so the gate has
everything it needs: `npm ci` resolves from the registry and there is no sibling directory to be
missing. That was the last thing standing between this repository and a green pipeline.

To develop against a local engine checkout: `npm install ../SP-the-inclusionist-tracer`, which is
ADR-0036's loop — link locally, pin remotely — and revert before committing.

## Neural voice, and the argument that used to be here

This section used to be called *"No neural voice, on purpose"* and made the case for declining. The
case was wrong, and it is worth keeping the reason visible rather than quietly swapping the
conclusion: it ended on the sentence *"a game whose entire spoken content is «tile 7 to the left»"*,
which measured the wrong thing. **The voices are not game content.** They are narration — the
resource of a child who cannot read, for whatever reason — and a sliding puzzle is precisely a game
such a child can play, if it is read to her well. Weighing them against how much this game has to
say was the error.

So the port is passed. The engine takes the neural text-to-speech engine as a **port** (ADR-0094)
because `onnxruntime-web` is a *non-optional* peer of the provider: naming it inside the engine would
put 135 MB in the `node_modules` of every consumer, including games that never speak. A game that
wants a voice names the provider itself, in one line; a game that stays silent keeps Web Speech.

The price, and both numbers, because either one alone misleads:

| | on disk | over the wire |
|---|---|---|
| `ort-wasm-simd-threaded.jsep.wasm` | 27,797 kB | 6,651 kB |
| the ONNX runtime, piper and the voice catalogue | 604 kB | 164 kB |
| everything else — the game, the stylesheet, the font | 636 kB | 195 kB |

**And this is the standalone build, which is why that is acceptable.** ADR-0140 makes the standalone
artifact a development, audit and demonstration route and **never a delivery route to a child**, so
ADR-0058's 30 MB school-download ceiling is not a measurement of this. In cartridge form the weight
is not here at all: `carregarVozNeural` is the *host's* half of `CreateGameOptions` (ADR-0139), so
the import leaves with the shell and the platform pays it once for every cartridge (ADR-0117).

The download is asked for separately and **filtered**: `baixarPesados({ apenas })` for `voz:*` only,
derived from the engine's catalogue rather than hand-written. The blanket default would also fetch
34 MB of MediaPipe vision models and WebGazer, which nothing here uses.

## Contrast and colour vision belong to the engine

The panel used to carry a high-contrast checkbox and a vision `<select>`. It does not any more: the
accessibility bar's **🌗 contrast** and **🚥 colour correction** own both since engine 9, so this
game looks and behaves like every other one in the catalogue.

⚠️ **Two axes, not one field.** The old select held one value for what ADR-0104 splits into a theme
and a correction, which means a child who needs high contrast *and* colour correction could only
have one — the exclusivity ADR-0011's supersession refused. `setTemaDoJogador` and
`setCorrecaoDoJogador` are two fields because they are two questions.

## Experimenting with how other people see

The **Experimentar** button opens a panel of nine ways of seeing — three colour-blindness
simulations, five low-vision ones and blindness — and the child plays the puzzle inside whichever she
picks.

⚠️ **These are lesson content, not a grown-up's demonstration**, which is the Dev's correction and the
reason the panel exists at all: *"as crianças usam, mas não como adaptação, mas para experimentar no
jogo questões de acessibilidade e inclusão trabalhados em sala de aula"*. They were briefly lost when
the vision select was retired, and that was a removed feature rather than a retired convenience.

Three properties it is built around, each with a gate:

- **The way out is a row, not a close button.** A child inside `lv-tunnel` sees a keyhole and inside
  `blind` sees nothing; leaving has to be the same shape as arriving, in the same list, never
  disabled. The panel lives OUTSIDE `#world`, so the filter that blacks the board leaves it lit.
- **A simulation never runs over an adaptation**, and the refusal is visible and explained rather than
  silent (ADR-0076). Whoever turned on high contrast turned it on because she needs it.
- **Every mode delivers what it names.** The engine splits a low-vision mode into a CSS filter and an
  overlay texture the consumer supplies; this game supplied none, so `lv-tunnel` was a faint blur with
  no tunnel and `lv-macular` was nothing at all. The overlays are painted now — a mode that
  under-delivers teaches that tunnel vision is a slight blur, which is worse than a mode that is
  absent.

## Libras

The accessibility bar's 🤟 button toggles a real, persisted mode, and the gov.br VLibras plugin is
mounted so that it has something to translate with — every announcement this game makes reaches the
interpreter as well as the live region.

⚠️ **It is the only third-party, network-required thing on the page.** Everything else, including the
typeface, is in the build. The engine's own note explains why it is interim: the interpreter is meant
to appear in front of the screen while audio plays and leave afterwards, with nothing to click, and
the gov.br widget is a docked panel that translates the text of an element you click. ADR-0010's
pillar 2 plans an interpreter of our own. Until then, a button that toggles a mode and translates
nothing is the half-truth worth removing.

## Credits and licences

AGPL-3.0-or-later. Economic ownership belongs to the Município — see
[`docs/LICENSES.md`](docs/LICENSES.md), which also records how the section 13 source offer works
while the repository is still private.

Original 15 Puzzle by **arnisritins** (MIT) — <https://github.com/arnisritins/15-Puzzle>. The
reference for what the game is; no code is taken from it, since that project renders with positioned
DOM spans and CSS transitions and this one draws into a PixiJS framebuffer. **PixiJS** by the PixiJS
team (MIT).

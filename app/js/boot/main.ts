// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. Every `let` in this file is inside `boot()`, on purpose.
//
// ========================= THE ORDER HERE IS LOAD-BEARING =========================
//  1. `createI18n()` FIRST, because it calls the engine's `registerDict`, and `createGame` runs
//     `initI18n` — which translates the static markup. Keys registered after that point are correct
//     in `t()` and stale on the screen.
//  2. `createGame()`, which builds the whole accessibility stack from the seven declared fields.
//  3. `engine.nav.attach()`, WHICH `createGame` DOES NOT CALL. Without it the engine's own dialogs
//     are mouse-only — a WCAG 2.1.1 failure that axe cannot see, because it is an interaction.
//  4. The surface, the view, the grid and the panel; then the loop.
//
// ========================= THE THREE THINGS THE ENGINE LEAVES TO US =========================
// Each of these is something `createGame` builds the machinery for and does not wire, and each is a
// silent failure if it is skipped:
//   · `aoFalhar` on the loop. A frame that throws stops the loop (ADR-0054), and a stopped screen is
//     invisible to a child who cannot see it. The engine ships the hook and its own game never wires
//     it. Here it goes to `srAlert` and to a visible line.
//   · `inert` on the board while a dialog is open. The engine installs no focus trap anywhere and
//     its menu key handler does not cover Tab, so twenty-five buttons behind an overlay are
//     Tab-reachable — WCAG 2.4.11 and 2.1.2.
//   · The vision filter, on `#game-region` and not on the canvas. See `visionFilter` in ui/hud: the
//     engine deliberately spares the DOM layer for the empathy modes, which inverts the simulation
//     in a game whose visible content is DOM.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { initLayout, layout } from '@the-inclusionist/engine/ui/layout.js';
import * as store from '@the-inclusionist/engine/platform/storage.js';

import { createI18n } from '../i18n/index.ts';
import { createPuzzleDeclaration } from '../declaration/puzzle-declaration.ts';
import { createRng } from '../puzzle/rng.ts';
import { createRun } from '../puzzle/run.ts';
import { createSolver } from '../puzzle/solver.ts';
import { shuffle } from '../puzzle/shuffle.ts';
import { legalMoves } from '../puzzle/board.ts';
import { boardGeometry, SIZES } from '../render/geometry.ts';
import type { Size } from '../render/geometry.ts';
import { HIGH, NORMAL } from '../render/palette.ts';
import { createSlide } from '../render/slide.ts';
import { createBoardView } from '../render/board-view.ts';
import { createSurface } from '../render/surface.ts';
import { createTileGrid } from '../ui/tile-grid.ts';
import { createHud, visionFilter } from '../ui/hud.ts';
import type { Move } from '../puzzle/types.ts';

/**
 * ⚠️ NOT `store.kJogo()`. That helper hard-codes `JOGO_ID = 'inclusionist'`, so every consumer that
 * used it would write to `incl.inclusionist.*` and collide with the platformer's own per-game keys
 * on the same browser profile. The CONVENTION of ADR-0028 is right and the function cannot express
 * it yet; three lines here, and an engine issue for `createStorage(gameId)`.
 *
 * The shared `incl_*` scope — language, typography, key remapping — belongs to the CHILD and is used
 * exactly as the engine provides it. That two-scope split is the whole point of `platform/storage`.
 */
const key = (name: string): string => `incl.15puzzle.${name}`;

function boot(): void {
  const doc = document;
  const region = doc.getElementById('game-region');
  if (!region) throw new Error('#game-region is missing: the host contract is not met');

  const search = new URLSearchParams(location.search);
  const debug = search.get('debug') === 'true';

  // Recorded rather than hidden. ADR-0049 wants determinism, and determinism is only useful if the
  // seed can be named and handed back.
  const seedParam = Number(search.get('seed'));
  let seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam >>> 0 : Date.now() >>> 0;

  const i18n = createI18n(window);        // BEFORE createGame — see the header
  const solver = createSolver();

  const savedSize = Number(store.get(key('size'), '4'));
  let size: Size = (SIZES as readonly number[]).includes(savedSize) ? (savedSize as Size) : 4;
  let geometry = boardGeometry(size);
  let run = createRun({ size, seed, solver, board: shuffle(size, createRng(seed)).board });
  let hint: Move | null = null;

  let highContrast = store.getBool(key('contrast'), false);
  let vision = store.get(key('vision'), 'normal');
  const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let reducedMotion = store.getBool(key('motion'), systemReduced);

  const declaration = createPuzzleDeclaration({ run: () => run, i18n });

  const engine = createGame({
    declaration,
    host: { doc, win: window, cvdHost: doc.getElementById('cvd') },
    // No levels, no pause phase, no gamepad wizard. Declared rather than deduced from a getter that
    // returns null — and if `semMenuDePausa` were omitted, every arrow, Enter and Space would start
    // being eaten the moment anything created an element with a pause id.
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    isNavigable: () => true,
    // The sonar needs to know where the listener stands. On a grid that is the cursor's square, so
    // the engine can measure to the targets the declaration hands it.
    sonarPlayers: () => [{ i: 0, x: run.cursor() % run.size, y: Math.floor(run.cursor() / run.size), viz: 'normal' }],
  });

  if (engine.problems.length) console.warn('host contract:', engine.problems);
  engine.nav.attach();      // createGame does not — see the header

  const surface = createSurface();
  region.appendChild(surface.view);

  const slide = createSlide({ reduced: () => reducedMotion });
  const view = createBoardView({
    layer: surface.layer,
    criarDesenho: surface.criarDesenho,
    geometry,
    palette: highContrast ? HIGH : NORMAL,
  });

  const grid = createTileGrid({
    doc,
    i18n,
    run: () => run,
    geometry: () => geometry,
    actionOf: (code) => engine.keyboard.actionOf(code, 0),
    onActivate: (index) => activate(index),
  });
  region.appendChild(grid.root);

  const hud = createHud({
    doc,
    i18n,
    run: () => run,
    initial: { size, contrast: highContrast, vision, reducedMotion },
    onShuffle: () => newRun(size, Date.now() >>> 0, 'a11y.shuffled'),
    onHint: () => showHint(),
    onSize: (next) => { store.set(key('size'), next); newRun(next, Date.now() >>> 0, 'a11y.sizeChanged'); },
    onContrast: (on) => { highContrast = on; store.setBool(key('contrast'), on); applyLook(); },
    onVision: (next) => { vision = next; store.set(key('vision'), next); applyLook(); },
    onReducedMotion: (on) => { reducedMotion = on; store.setBool(key('motion'), on); },
  });
  region.appendChild(hud.root);

  function applyLook(): void {
    const palette = highContrast ? HIGH : NORMAL;
    view.setPalette(palette);
    region!.dataset.contrast = highContrast ? 'high' : 'normal';
    // ⚠️ THE DIGIT'S COLOUR COMES FROM THE SAME TABLE THE TILE BODY DOES. The stylesheet carries
    // fallbacks so the page is never unstyled, but a fallback that silently becomes the real value
    // is how the measured contrast ratios in render/palette stop describing what is on screen.
    region!.style.setProperty('--tile-ink', palette.ink);
    region!.style.setProperty('--accent', palette.accent);
    // ONE filter, on the region, reaching the canvas AND the numbers over it. See ui/hud.
    region!.style.filter = visionFilter(vision);
  }

  function newRun(next: Size, nextSeed: number, announcement: string): void {
    slide.cancel();
    hint = null;
    size = next;
    seed = nextSeed;
    geometry = boardGeometry(size);
    run = createRun({ size, seed, solver, board: shuffle(size, createRng(seed)).board });
    view.setGeometry(geometry);
    grid.rebuild();
    grid.setHint(null);
    hud.refresh();
    srSay(i18n.t(announcement, { size, need: size * size - 1 }));
  }

  function activate(index: number): void {
    if (slide.active()) return;            // one move at a time; the guard chess needed too
    const result = run.activate(index);
    if (result.kind === 'blocked') { srSay(i18n.t('a11y.blocked')); return; }
    if (result.kind === 'blank') { srSay(i18n.t('a11y.blankCell')); return; }

    hint = null;
    grid.setHint(null);
    slide.begin(result.move, run.size, geometry.cell + geometry.gap);
    grid.refresh();
    hud.refresh();

    // ⚠️ ONE announcement per completed move, never two. `srSay` is `aria-live="polite"`, which
    // QUEUES: splitting the move and the count into two utterances would put the reader a move
    // behind the board and keep it there.
    srSay(i18n.t('a11y.moved', {
      tile: i18n.describeTile(result.move.tile).text,
      dir: i18n.direction(result.move.direction),
      have: run.tilesHome(),
      need: run.size * run.size - 1,
    }));
    if (run.solved()) srAlert(i18n.t('status.solved', { moves: run.moves() }));
  }

  function showHint(): void {
    const moves = run.hint(3);
    if (!moves.length) { srSay(i18n.t('a11y.hintNone')); return; }
    hint = moves[0];
    grid.setHint(hint);
    // It REVEALS and never plays: the cursor goes to the tile so the next Enter is hers to press.
    run.setCursor(hint.from);
    grid.refresh();
    grid.focusCursor();
    srSay(i18n.t('a11y.hint', { moves: moves.map((m) => i18n.describeMove(m)).join(', ') }));
  }

  // The language can change under a running game; anything JavaScript BUILT has to rebuild. The
  // engine re-applies only the static markup, and says so.
  i18n.onChange(() => { grid.rebuild(); hud.relabel(); });

  initLayout({ numJogadores: () => 1 });
  layout();
  window.addEventListener('resize', layout);
  applyLook();

  let dialogWasOpen = false;
  startLoop(surface.ticker, (dt) => {
    // Held out of the tab order while an engine dialog is open. Polled rather than subscribed
    // because the engine offers no event for it, and it is one property read per frame.
    const open = engine.nav.sharedDialogOpen() !== null;
    if (open !== dialogWasOpen) { dialogWasOpen = open; grid.setInert(open); }

    slide.advance(dt);
    const travelling = slide.travelling();
    // ⚠️ TWO WRITES, ONE CALLBACK, ONE INTEGER. This is the whole animation design: there is no CSS
    // transition anywhere, so the number and the tile body cannot drift — they are the same number.
    view.draw({
      board: run.board(),
      movable: legalMoves(run.board()).map((m) => m.from),
      hint,
      travelling,
    });
    grid.setOffset(travelling);
    surface.render();
  }, 2, {
    aoFalhar: (error) => {
      console.error(error);
      srAlert(i18n.t('status.crashed'));
    },
  });

  if (debug) {
    (window as unknown as Record<string, unknown>).__puzzle = {
      seed: () => seed,
      run: () => run,
      declaration,
      engine,
      geometry: () => geometry,
      /** Advance one frame by hand. A hidden browser pane never fires rAF, and an animation that
       *  only moves when someone takes a screenshot cannot be verified at all. */
      step: (dt = 1) => {
        slide.advance(dt);
        const travelling = slide.travelling();
        view.draw({ board: run.board(), movable: legalMoves(run.board()).map((m) => m.from), hint, travelling });
        grid.setOffset(travelling);
        surface.render();
      },
      activate,
      hint: showHint,
    };
  }
}

boot();

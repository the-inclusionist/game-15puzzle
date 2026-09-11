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
import { alcanceDoModo } from '@the-inclusionist/engine/render/viz-setters.js';
import { PESADOS, baixarPesados } from '@the-inclusionist/engine/platform/pesados.js';
import { lerCenaGuardada } from '@the-inclusionist/engine/ui/motion-scene.js';
import { createTitleScreen } from '../ui/title-screen.ts';

/**
 * ⚠️ THIS WAS A LOCAL WORKAROUND AND THE ENGINE CLOSED THE REASON FOR IT (ADR-0088, engine #113).
 *
 * It used to read: «NOT `store.kJogo()`. That helper hard-codes `JOGO_ID = 'inclusionist'`, so every
 * consumer that used it would write to `incl.inclusionist.*` and collide with the platformer's own
 * per-game keys on the same browser profile.» That was true, and the note asked for the fix by name.
 * The fix landed: `kJogo(jogo, nome)` takes the id from the caller.
 *
 * The produced string is IDENTICAL — `'incl.' + jogo + '.' + nome` is what the three lines built — so
 * no saved key changes and no child loses anything. What changes is who owns the convention: it moves
 * from a comment in one game to the helper every game shares.
 *
 * The shared `incl_*` scope — language, typography, key remapping — belongs to the CHILD and is used
 * exactly as the engine provides it. That two-scope split is the whole point of `platform/storage`.
 */
const key = (name: string): string => store.kJogo('15puzzle', name);

function boot(): void {
  const doc = document;
  const region = doc.getElementById('game-region');
  if (!region) throw new Error('#game-region is missing: the host contract is not met');
  // The world: canvas, board and title screen. The panel is deliberately NOT in here — see the note
  // in index.html, and `applyLook` below.
  const world = doc.getElementById('world');
  if (!world) throw new Error('#world is missing: the host contract is not met');
  // The chrome column, and the bar the engine fills. Both outside `#world`: they are the controls
  // that turn an empathy simulation OFF, and a filter on an ancestor cannot be undone by a child.
  const side = doc.getElementById('side');
  const a11yBar = doc.getElementById('a11y-bar');
  if (!side || !a11yBar) throw new Error('#side / #a11y-bar are missing: the host contract is not met');

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
  // The tiles the hint is lighting — the whole press, one to `size - 1` of them. Not a move and not
  // an arrow: what a player needs to know is WHICH TILES she is about to shift.
  let hint: readonly number[] = [];

  let highContrast = store.getBool(key('contrast'), false);
  let vision = store.get(key('vision'), 'normal');
  const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let reducedMotion = store.getBool(key('motion'), systemReduced);

  /**
   * IS MOTION REDUCED — the OR of this game's switch and the engine's calm level.
   *
   * ⚠️ MOUNTING THE ACCESSIBILITY BAR GAVE THIS GAME TWO SWITCHES FOR ONE THING. The bar's TEA icon
   * writes the ENGINE's reduced-motion store; the panel's checkbox writes this game's own key; and
   * the engine offers no event and no general getter to reconcile them — its `reducedMotion` is four
   * flags shaped for the platformer (`parallax`, `decor`, `items`, `particles`), and the 2048 wrote
   * down its refusal to guess which one answers for a tile. Nobody in the catalogue has solved this.
   *
   * `items` is the closest of the four to a tile that slides, and reading it is a guess — but a guess
   * that can only ever ADD reduction is a safe one. The asymmetry is deliberate: turning TEA on quiets
   * the game, and the checkbox cannot turn motion back ON while calm is asked for, because whoever
   * asked for calm asked for it whole.
   *
   * Read per slide rather than per frame: it is a `getJSON`, cheap once, wasteful sixty times a second.
   */
  const motionReduced = (): boolean => reducedMotion || lerCenaGuardada().items === true;

  const declaration = createPuzzleDeclaration({ run: () => run, i18n, worldSelector: '#world' });

  const engine = createGame({
    declaration,
    host: {
      doc, win: window, cvdHost: doc.getElementById('cvd'),
      /**
       * WHERE THE SEVEN ACCESSIBILITY ICONS GO, and naming it is the whole fix.
       *
       * ⚠️ THE ENGINE REPORTED THIS GAME'S ABSENCE BEFORE IT WAS NOTICED HERE. Left unnamed it looks
       * for `#title-icons`, the platformer's id, and not finding one it put a line in `problems`:
       * "a criança não alcança modo cego, TTS, alto contraste nem Libras antes de começar". True —
       * the title screen covers the panel, so every control was behind a game she could not see to
       * start. Five of the six games in the catalogue were in that state.
       *
       * The engine BUILDS and WIRES the bar from here; the game only says where it fits. Seven
       * buttons mount: blind, TTS, Libras, TEA and three marked "soon". Contrast, colour-vision and
       * latching do NOT — the engine only mounts an icon that has somebody to action it, and this
       * game passes no theme or correction writer and declares `seguraTeclas() === false`. So the
       * bar does not duplicate the panel's own contrast and vision controls.
       */
      a11yBarHost: a11yBar,
    },
    // No gamepad wizard and no pause actor. Declared rather than deduced from a getter returning null.
    //
    // ⚠️ `semMenuDePausa` IS GONE, and not because this game stopped wanting it: ADR-0120 made the
    // pause UNDECLINABLE, so the option no longer exists and `pauseHost` decides only WHERE the card
    // hangs. The engine mounts it. That is a behaviour change here — this game had no pause at all —
    // and the keyboard is the thing to watch, because the engine's menu handler listens on the window
    // in CAPTURE. It only consumes while a dialog IS open, which is why `isNavigable` can stay true.
    declines: { semAssistenteDePad: true, semAtorDePausa: true },
    isNavigable: () => true,
    /**
     * THE NEURAL VOICE, which this game used to decline.
     *
     * ⚠️ THE REASON FOR DECLINING WAS WRONG, and the correction is the Dev's: the voices are not game
     * content, so "this puzzle only ever says tile 7 to the left" was measuring the wrong thing. They
     * are NARRATION — the resource of a child who cannot read, for whatever reason — and a sliding
     * puzzle is exactly a game such a child can play, if it is read to her well.
     *
     * One line, per ADR-0094. The engine cannot name the provider itself: it drags `onnxruntime-web`
     * in as a NON-optional peer, 135 MB into every consumer's node_modules including games that never
     * speak. So the game names it, and a game that stays silent keeps Web Speech.
     */
    carregarVozNeural: () => import('@mintplex-labs/piper-tts-web'),
    /**
     * ⚠️ FALSE HERE, AND THE DOWNLOAD IS ASKED FOR SEPARATELY — see below. The engine's blanket
     * default fetches the WHOLE heavy catalogue, and most of it is not this game's: 34 MB of
     * MediaPipe vision models (face, gesture, hand) plus WebGazer, which the 2048's measurement says
     * fails by CORS on every single load. Nothing here uses a camera.
     */
    baixarPesados: false,
    // The sonar needs to know where the listener stands. On a grid that is the cursor's square, so
    // the engine can measure to the targets the declaration hands it.
    sonarPlayers: () => [{ i: 0, x: run.cursor() % run.size, y: Math.floor(run.cursor() / run.size), viz: 'normal' }],
  });

  /**
   * THE VOICES, AND ONLY THE VOICES.
   *
   * `createGame` takes a boolean and does not pass a filter through, but `baixarPesados` itself does,
   * and its own comment says who for: "Só estas ids, se dado. Serve ao consumidor que quer as vozes e
   * não o resto." This is that consumer.
   *
   * ⚠️ THE LIST IS DERIVED FROM THE CATALOGUE, never written by hand. A voice added upstream arrives
   * here on its own; a hand-copied list would be a second place to forget.
   *
   * Why it runs at all, when the models are ~190 MB: pillar 8 became "first day ONLINE, then
   * offline-first" (ADR-0116). A child who comes back on day two, with no network, and finds the
   * voice was never fetched is the case this prevents. It does not block the boot — no `await`, and
   * the failure is swallowed, because a game that will not start because a voice is missing is worse
   * than a game that speaks in the browser's own voice.
   *
   * 📌 On a catalogue origin this is paid once for every game: Cache Storage is partitioned by ORIGIN,
   * so `incl-pesados-v1` is shared by siblings served from the same host and by nobody else. ADR-0117
   * says the platform should be the one asking; until it does, the game asks.
   */
  void baixarPesados({ apenas: PESADOS.filter((p) => p.id.startsWith('voz:')).map((p) => p.id) });

  if (engine.problems.length) console.warn('host contract:', engine.problems);
  engine.nav.attach();      // createGame does not — see the header

  const surface = createSurface();
  world.appendChild(surface.view);

  const slide = createSlide({ reduced: motionReduced });
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
  world.appendChild(grid.root);

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
  side.appendChild(hud.root);

  /* ===================== THE TWO SCREENS =====================
   *
   * `createGame` hands over a scene stack, empty and ready, and this is what it is for. Two screens
   * is little enough that a boolean would run — and a boolean is exactly how the third consumer ends
   * up with a third spelling of the same idea. The engine declares the mechanism; a consumer that
   * hand-rolls past it is not simpler, it is divergent.
   *
   * What the stack decides here is narrow and honest: WHICH screen is up. The title screen's own
   * input is native (it is a button), and the board's is the grid's, so nothing is routed through
   * `Scene.input` that the platform already routes better.
   */
  const titleScreen = createTitleScreen({
    doc,
    i18n,
    reducedMotion: motionReduced,
    onStart: () => start(),
  });
  world.appendChild(titleScreen.root);

  const cenaJogo = { nome: 'playing' };
  const cenaTitulo = {
    nome: 'title',
    enter: () => { titleScreen.show(); grid.setInert(true); },
    exit: () => { titleScreen.hide(); grid.setInert(false); },
  };

  function start(): void {
    if (engine.cenas.top()?.nome !== 'title') return;
    engine.cenas.replace(cenaJogo);
    grid.focusCursor();
    // The board has just arrived and she cannot see it. One sentence, and it is the same one the
    // grid carries as its own label — said once here because nothing else announces an arrival.
    srSay(`${i18n.t('a11y.boardLabel', { size: run.size })}. ${i18n.t('a11y.gridHint')}`);
  }

  function playing(): boolean { return engine.cenas.top()?.nome === 'playing'; }

  function applyLook(): void {
    const palette = highContrast ? HIGH : NORMAL;
    view.setPalette(palette);
    region!.dataset.contrast = highContrast ? 'high' : 'normal';
    // ⚠️ THE DIGIT'S COLOUR COMES FROM THE SAME TABLE THE TILE BODY DOES. The stylesheet carries
    // fallbacks so the page is never unstyled, but a fallback that silently becomes the real value
    // is how the measured contrast ratios in render/palette stop describing what is on screen.
    region!.style.setProperty('--tile-ink', palette.ink);
    region!.style.setProperty('--accent', palette.accent);
    region!.style.setProperty('--title-bg', palette.backdrop);
    region!.style.setProperty('--title-ink', palette.tileAway);

    /* ===================== THE VISION FILTER IS THE ENGINE'S JOB NOW =====================
     *
     * This used to be `region.style.filter = ...`, written here because the engine's own path spared
     * the DOM layer for the empathy modes — which inverted the simulation in a game whose visible
     * content IS DOM: `blind` blacked the canvas and left the numbers perfectly legible. The engine
     * closed that by making the game DECLARE which element is the world, and `aplicarFiltroDeVisao`
     * puts the filter there. Same surface, and now the reach rule lives in one place.
     */
    engine.aplicarFiltroDeVisao(visionFilter(vision), alcanceDoModo(vision));

    /* ⚠️ AND THE PANEL IS OUTSIDE THE WORLD, WHICH IS THE ONLY THING THAT ACTUALLY WORKS.
     *
     * This was `hud.root.style.filter = 'none'` for a while, and it was a no-op dressed as a fix: a
     * CSS filter on an ancestor rasterises its whole subtree, and a descendant cannot opt out of it.
     * `brightness(0)` on the world would have blacked the panel — and the panel holds the control
     * that turns the simulation off, so a child who chose `blind` would have been locked inside it
     * with no visible way out. The engine's own exemption for `#game-region .overlay` has the same
     * shape and, for a descendant, the same limit.
     *
     * Being a SIBLING is what makes it true, so it is markup rather than a style: index.html puts
     * the canvas, the board and the title screen inside `#world`, and the panel beside it.
     */
  }

  function newRun(next: Size, nextSeed: number, announcement: string): void {
    slide.cancel();
    hint = [];
    size = next;
    seed = nextSeed;
    geometry = boardGeometry(size);
    run = createRun({ size, seed, solver, board: shuffle(size, createRng(seed)).board });
    view.setGeometry(geometry);
    grid.rebuild();
    grid.setHint([]);
    hud.refresh();
    srSay(i18n.t(announcement, { size, need: size * size - 1 }));
  }

  function activate(index: number): void {
    if (!playing()) return;                // the title screen is up; the board is scenery behind it
    if (slide.active()) return;            // one move at a time; the guard chess needed too
    const result = run.activate(index);
    if (result.kind === 'blocked') { srSay(i18n.t('a11y.blocked')); return; }
    if (result.kind === 'blank') { srSay(i18n.t('a11y.blankCell')); return; }

    hint = [];
    grid.setHint([]);
    slide.begin(result.push, run.size, geometry.cell + geometry.gap);
    grid.refresh();
    hud.refresh();

    // ⚠️ ONE announcement per completed move, never two. `srSay` is `aria-live="polite"`, which
    // QUEUES: splitting the move and the count into two utterances would put the reader a move
    // behind the board and keep it there.
    const first = result.push[0];
    srSay(i18n.t(result.push.length === 1 ? 'a11y.moved' : 'a11y.movedMany', {
      tile: i18n.describeTile(first.tile).text,
      count: result.push.length,
      dir: i18n.direction(first.direction),
      have: run.tilesHome(),
      need: run.size * run.size - 1,
    }));
    if (run.solved()) srAlert(i18n.t('status.solved', { moves: run.moves() }));
  }

  function showHint(): void {
    const presses = run.hint(3);
    if (!presses.length) { srSay(i18n.t('a11y.hintNone')); return; }
    // ⚠️ THE TILES, NOT AN ARROW. An arrow says "something arrives here"; what she has to know is
    // which tiles she is about to shift — and with a push that is up to four of them at once. So the
    // first press lights its whole line, one to four tiles.
    const next = presses[0];
    hint = next.map((m) => m.from);
    grid.setHint(hint);
    // It REVEALS and never plays. The cursor goes to the tile she would PRESS — the far end of the
    // push, since pressing any nearer one would move fewer tiles than the hint is showing.
    run.setCursor(next[next.length - 1].from);
    grid.refresh();
    grid.focusCursor();
    srSay(i18n.t('a11y.hint', { moves: presses.map((p) => i18n.describePush(p)).join(', ') }));
  }

  // The language can change under a running game; anything JavaScript BUILT has to rebuild. The
  // engine re-applies only the static markup, and says so.
  i18n.onChange(() => { grid.rebuild(); hud.relabel(); titleScreen.refresh(); });

  initLayout({ numJogadores: () => 1 });
  layout();
  window.addEventListener('resize', layout);
  applyLook();

  engine.cenas.push(cenaTitulo);

  let dialogWasOpen = false;
  startLoop(surface.ticker, (dt) => {
    // Held out of the tab order while an engine dialog is open — or while the title screen is up,
    // which is the same requirement for the same reason: a grid of twenty-five buttons behind
    // something is still Tab-reachable, and the engine installs no focus trap anywhere.
    const open = engine.nav.sharedDialogOpen() !== null || !playing();
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
    // The engine's own, which narrates through the TTS rather than only writing to a live region —
    // it is delivered ready and not installed, precisely because the game owns the ticker. The extra
    // line here is for whoever is reading a console, which the engine has no business assuming.
    aoFalhar: (error) => { console.error(error); engine.aoFalhar(error); },
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
      start,
      scene: () => engine.cenas.top()?.nome ?? null,
    };
  }
}

boot();

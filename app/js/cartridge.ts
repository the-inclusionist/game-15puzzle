// SPDX-License-Identifier: AGPL-3.0-or-later
// cartridge — the game, with no page and no composition root.
//
// ========================= WHAT THIS FILE MAY NOT DO =========================
// It may not call `createGame`, it may not call `startLoop`, it may not read `location`, and it may
// not do anything at all on import. Each of those is a rule with a defect behind it (ADR-0139):
// `createGame` mounts a whole accessibility stack, so N cartridges calling it is N accessibility
// bars, N TTS instances and N keyboard runtimes competing for one document; N frame loops fight over
// one frame; one address serves every cartridge, so `location.search` reads another game's
// parameters; and a module that acts on import cannot be instantiated twice or torn down once.
//
// ⚠️ AND THIS FILE IS WRITTEN AHEAD OF ITS TURN, WHICH THE DEV DECIDED AND WHICH IS RECORDED HERE
// RATHER THAN ASSUMED. ADR-0068 §6 and the cartridge brief both put `game-whackwhack` through the
// contract first, precisely so that a hole is found once instead of six times. The Dev's instruction
// on 2026-09-11 was not to wait. So the four questions ADR-0139 leaves open are answered BELOW, in
// this game, by this file — they are readings and not records, each marked, and the record is free
// to overrule any of them.

import { createPuzzleDeclaration } from './declaration/puzzle-declaration.ts';
import { createI18n, catalogs } from './i18n/index.ts';
import { createRun } from './puzzle/run.ts';
import { createSolver } from './puzzle/solver.ts';
import { shuffle } from './puzzle/shuffle.ts';
import { solved, legalMoves } from './puzzle/board.ts';
import { boardGeometry, SIZES } from './render/geometry.ts';
import { HIGH, NORMAL } from './render/palette.ts';
import { createSlide } from './render/slide.ts';
import { createBoardView } from './render/board-view.ts';
import { createSurface } from './render/surface.ts';
import { createTileGrid } from './ui/tile-grid.ts';
import { createHud, visionFilter } from './ui/hud.ts';
import { createTitleScreen } from './ui/title-screen.ts';
import { createEmpathyPanel } from './ui/empathy-panel.ts';

import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { createStorage } from '@the-inclusionist/engine/platform/storage.js';
import { gameKey } from '@the-inclusionist/engine/platform/storage-keys.js';
import { readStoredScene } from '@the-inclusionist/engine/ui/motion-scene.js';
import { VIZ_MODES } from '@the-inclusionist/engine/render/viz-modes.js';
import { reachOfMode, readStoredVisual } from '@the-inclusionist/engine/render/viz-setters.js';
import { DEFAULT_VISUAL } from '@the-inclusionist/engine/render/viz-axes.js';

import type { Size } from './render/geometry.ts';
import type { Run } from './puzzle/run.ts';
import type { Solver } from './puzzle/solver.ts';
import type { GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
// ⚠️ THE BARE SPECIFIER, not a `boot/…` subpath: the engine's export map routes `.` to
// `dist-pkg/boot/create-game` and publishes no `./boot/*` pattern at all.
import type { CartridgeHooks } from '@the-inclusionist/engine';
import type { VisualState } from '@the-inclusionist/engine/render/viz-axes.js';

/** This game's own generator, never the engine's shared stream — ADR-0141, and `puzzle/rng.ts` for why. */
export interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
}

/**
 * WHAT A SHELL HANDS IN.
 *
 * Derived from `CreateGameOptions` by ADR-0139's test — could a PAGE answer this without knowing
 * which game is running? — rather than designed. `engine` is what `createGame` returned; the other
 * three exist because leaving each one out reintroduces a named defect.
 */
export interface GameCtx {
  /** Exactly what `createGame` returned. One instance, however many cartridges exist. */
  readonly engine: EngineLike;
  /**
   * This cartridge's element. It writes inside it and nowhere else.
   *
   * ⚠️ AND ONE THING THE SHELL PUT THERE IS NOT OURS — see `borrowBar` below. That is an answer to an
   * open question, not a reading of one.
   */
  readonly region: HTMLElement;
  /** This cartridge's own stream. ADR-0141: not a convenience. */
  readonly rng: (seed: number) => Rng;
  /** What the shell decided this cartridge may read from the address — never `location.search`. */
  readonly params: URLSearchParams;
}

export interface GameInstance {
  /** ⚠️ `dt` is counted in FRAMES, not seconds. The engine's ticker deals in `deltaTime`. */
  update(dt: number): void;
  /** Release everything this instance created, and give back everything it borrowed. */
  teardown(): void;
  /**
   * The verification surface — handed OUT, never installed.
   *
   * ⚠️ THIS USED TO BE `window.__puzzle = …` WRITTEN BY THE GAME, AND THE SPLIT IS WHY IT MOVED. A
   * cartridge writes inside its region and nowhere else; `window` is the page, so publishing belongs
   * to whoever owns the page. The shell decides whether `?debug=true` was asked for and under what
   * name it lands — which also means a platform can expose six of these without six games fighting
   * over one global.
   *
   * It exists at all because a hidden browser pane never fires `requestAnimationFrame`: an animation
   * that only advances when someone takes a screenshot cannot be verified, so `step(dt)` advances a
   * frame by hand and `frames()` counts the ones the real clock delivered.
   */
  readonly debug: Readonly<Record<string, unknown>>;
}

export interface Cartridge {
  /** The repository and the package, one word, per ADR-0082 §1. */
  readonly slug: string;
  /** The engine's contract object. ⚠️ Read by `createGame` BEFORE `create` runs — see the note below. */
  readonly declaration: GameDeclaration;
  /** Registered by whichever shell loads this cartridge; a cartridge never registers its own. */
  readonly dicts: typeof catalogs;
  /** The game-owned half of `CreateGameOptions` — every one a callback INTO the game. */
  readonly hooks: CartridgeHooks;
  /** Nothing runs until this is called. */
  create(ctx: GameCtx): GameInstance;
}

/**
 * THE GAME'S HALF OF `CreateGameOptions`, and it is short because this game is small.
 *
 * ⚠️ `sonarPlayers` BELONGS HERE AND THE SHELL TRIED TO OWN IT FIRST. The draft of `standalone.ts`
 * rebuilt the listener's square from `declaration.topology()` and `focusOf`, which typechecked
 * against nothing — `Topology` is a union and the `hotspots` arm has no `size` — and which was wrong
 * before it was broken: where the listener STANDS is a statement about the game, so ADR-0139's own
 * test puts it on this side. The compiler caught the wrong owner by refusing the wrong type.
 *
 * `isNavigable` is here for the same reason and answers TRUE: the engine captures keys on the window
 * while one of its own dialogs is open, and this game draws no menu of its own to compete with it.
 *
 * ⚠️ AND `declines` MOVED HERE FROM THE SHELL, WHICH IS AN ERRATUM CORRECTING ME. The cartridge
 * contract listed «whether `declines` is host-owned or game-owned» as open, and this repository
 * answered it wrongly — it sat in `standalone.ts` until engine 9.0.0 shipped `CartridgeHooks` with
 * the answer. The record's own erratum says why: ADR-0139 §1 counted fifteen fields out of twenty and
 * left five on the wrong side — `declines`, `getPauseActs`, `setPauseActor`, `setPlayerTheme` and
 * `setPlayerCorrection`. Its own test settles them: a PAGE cannot say what a GAME does not have.
 *
 * 📌 The type is now the ENGINE's, not a local shape. A local interface with two members was a second
 * place for this list to drift, and it had already drifted once.
 */
// Re-exported from the engine for consumers of this cartridge module.
export type { CartridgeHooks } from '@the-inclusionist/engine';

/** The narrow slice of the engine this game actually uses. Typed here so the cartridge does not
 *  depend on the whole `Engine` shape while the contract is still moving. */
interface EngineLike {
  readonly problems: readonly string[];
  readonly pause: { show(i: number): void; hide(i: number): void };
  readonly keyboard: { actionOf(code: string, player: number): string | null };
  readonly scenes: {
    push(s: unknown): void; replace(s: unknown): void; pop(): void;
    top(): { name: string } | null;
  };
  readonly nav: { attach(): void; sharedDialogOpen(): unknown };
  /** Engine 11's root-owned translator (ADR-0232 D3). The game reads through these two arrows. */
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly locale: () => string;
  applyVisionFilter(filter: string | null, reach: unknown): void;
}

const SLUG = 'game-15puzzle';

/**
 * ⚠️ MODULE-LEVEL IS JUST A HELPER THAT WRITES A STRING. ADR-0139 §5's rule — nothing module-scope
 * holds state — is about the state itself, and `gameKey('15puzzle', 'size')` is a pure call: it
 * returns `'incl.15puzzle.size'` and reads nothing. The STORE that gets written to is built inside
 * `create(ctx)` from the host's `localStorage` (or a test's memory backend), and nothing survives a
 * teardown.
 */
const key = (name: string): string => gameKey('15puzzle', name);

/**
 * THE CARTRIDGE IS BUILT BY A FACTORY, AND THAT IS THE FIRST OPEN QUESTION ANSWERED.
 *
 * ⚠️ ADR-0139 §2 types `Cartridge` as a VALUE a module exports. Exporting a value means building it
 * at import time, and the thing it has to hold is a pointer to the mounted run — because
 * `createGame` reads `declaration` BEFORE `create(ctx)` can exist, so every member of the
 * declaration has to forward to whatever is current. A pointer at module scope is exactly the
 * module-level state spec D14 forbids and the reason it forbids it: it survives `teardown()` and
 * leaks into the next instantiation.
 *
 * So the module exports a FACTORY for the cartridge and the shell calls it once. The pointer lives
 * in this closure, which is per-cartridge-object rather than per-module, and the import remains
 * observably inert. It is one extra call on the shell's side and it removes the whole class.
 *
 * 📌 This is a reading, not a record. If the platform needs a bare `Cartridge` value, the right fix
 * is for the engine to grow `mount()` (ADR-0142, accepted and not built) so the declaration stops
 * having to exist before the game does — not for this file to keep state at module scope.
 */
export function createCartridge(): Cartridge {
  // The pointer the declaration forwards through. Function scope, not module scope.
  let run: Run | null = null;

  /**
   * THE STORE, BUILT ONCE PER FACTORY CALL (ADR-0232). Engine 11 made storage a factory rather than
   * module-level getters: `createStorage(backend)` returns a `Store` object with `get/set/getBool/…`,
   * and a `null` backend is a host with no storage worth writing to — every write reports `false`,
   * every read returns its fallback.
   *
   * ⚠️ `globalThis.localStorage` RATHER THAN `window.localStorage`, so a Node test that imports this
   * module reaches the same door through its own `memoryBackend` without going through a global
   * `window`.
   */
  const backend = typeof globalThis !== 'undefined'
    && typeof (globalThis as { localStorage?: Storage }).localStorage !== 'undefined'
    ? (globalThis as { localStorage: Storage }).localStorage
    : null;
  const store = createStorage(backend);

  /**
   * THE CHILD'S VISUAL STATE, AND THE ENGINE IS ITS OWNER NOW.
   *
   * ⚠️ THIS IS THE «MENUS, ICONS AND THEMES OF THE ENGINE» DECISION, IN ONE POINTER. Until 9.0.0 this
   * game kept its own contrast checkbox and its own vision select, writing `incl.15puzzle.contrast`
   * and `.vision`. It did that because the engine mounted neither icon — and the engine's own note
   * about that absence names the mistake exactly: «o consumidor externo leu a ausência como «este
   * jogo tem os seus próprios controles», o que é verdade sobre o resultado e falso sobre a causa».
   * There was no door. There is one now, and walking through it is what keeps every game in the
   * catalogue looking and behaving like the same product.
   *
   * 📌 TWO AXES AND NOT ONE STRING, which is ADR-0104 and the reason ADR-0011's exclusivity clause was
   * superseded: a child with colour blindness may need high contrast AT THE SAME TIME, and one field
   * holding one value makes the two cancel each other. The old select had exactly that defect.
   *
   * ⚠️ It lives in the FACTORY's closure and not in `create`, because it is the CHILD's and not the
   * game's: ADR-0038 puts the profile at PAGE lifetime, so it has to survive a mount/unmount cycle.
   * `run` above is the opposite case and that is why they are two pointers rather than one object.
   */
  let visual: VisualState = DEFAULT_VISUAL;
  let repaint: ((v: VisualState) => void) | null = null;
  let pauseActs: Record<string, (() => void) | undefined> = {};

  const savedSize = Number(store.get(key('size'), '4'));
  const startSize: Size = (SIZES as readonly number[]).includes(savedSize) ? (savedSize as Size) : 4;

  /**
   * ⚠️ AND BUILDING IT HERE IS CHEAP, WHICH HAD TO BE CHECKED RATHER THAN ASSUMED. A first draft of
   * this file wrapped the solver in a lazy proxy on the theory that `createSolver()` builds a
   * 362,880-entry endgame table up front, and that a cartridge the platform merely LISTED should not
   * pay for it. `puzzle/solver.ts:68` says otherwise in its own words — the table is «built once per
   * solver instance on first use» — so the constructor allocates a closure and nothing else. The
   * proxy was solving a problem the module had already solved.
   */
  const solver: Solver = createSolver();

  /**
   * ⚠️ A SOLVED BOARD, AND IT IS NEVER SEEN. `createGame` runs `conformanceProblems(declaration)` and
   * the `world()` check at boot — that is, before `create(ctx)` — so the declaration must answer
   * without throwing while no game exists. The alternative is `run` being null and every member
   * carrying a null branch, which is nine places to get wrong instead of one board that is replaced
   * by the first line of `create`.
   */
  run = createRun({ size: startSize, seed: 1, solver, board: solved(startSize) });

  const declaration = createPuzzleDeclaration({
    run: () => run as Run,
    i18n: createI18n(null),   // no window at factory time: `onChange` simply never fires here
    worldSelector: '#world',
  });

  return {
    slug: SLUG,
    declaration,
    dicts: catalogs,

    hooks: {
      // No pause actor. Declared rather than deduced from a getter returning null.
      //
      // ⚠️ `semAssistenteDePad` IS GONE IN ENGINE 11 — the pad wizard became unconditional, and the
      // key was removed from `Declinios` without a replacement. The record this cartridge rode on
      // («assume uncondicional and keep going») is written in the engine now; the game has no
      // sentence to say about it. `semMenuDePausa` had already gone with ADR-0120.
      //
      // ⚠️ `semVozNeural` IS NOT WRITTEN HERE either (would be `noNeuralVoice` in 11.0.0). Whether
      // the neural voice loads is the DECISION OF `uses: { neuralVoice }` on the shell's createGame
      // (step 11f), not of a decline here.
      declines: { noPauseActor: true },

      /**
       * ⚠️ EVERY GAME_KEYED ACCOMMODATION ANSWERED, OR THE BOOT REFUSES (ADR-0153, engine 11.0.0).
       *
       * `AccommodationAnswers` is `Readonly<Record<GameKeyedAccommodation, AccommodationKeys | false>>`
       * — the KEYS, not the words. A missing key is a malformed declaration; `false` is «no subject in
       * this game», which is explicit so a silence cannot decide for a child.
       *
       * The one subject this game has is **hints**: the button that illuminates tiles. Everything
       * else — a wheelchair, an easy mode, text pace, tile-matching suits, aim assist, owner colours
       * — has no subject in a sliding-tile puzzle.
       */
      accommodations: {
        hints: { labelKey: 'accom.hints.label', hintKey: 'accom.hints.hint' },
        cameraSway: false,
        easyMode: false,
        wheelchairMode: false,
        detectionLeniency: false,
        intensity: false,
        reducedCharacterMotion: false,
        caneSpacing: false,
        textPace: false,
        lexicalDifficulty: false,
        wordHighlight: false,
        pieceSets: false,
        distinguishableSuits: false,
        timingWindow: false,
        aimAssist: false,
        repeatedInput: false,
        ownerColors: false,
        contrastOutlines: false,
      },

      /**
       * THE GENRE, OPTIONAL. `'Traditional puzzle game'` is a leaf of the engine's `Puzzle` family in
       * `core/genres` — exactly the one that fits a sliding-tile puzzle. Declaring one costs a line
       * and informs the engine's genre-keyed derivations (ADR-0156).
       */
      genre: 'Traditional puzzle game',

      /**
       * THE POSITIONS THIS GAME USES, with the KEYS of their words — resolved at every drawing in the
       * page's language (ADR-0074, ADR-0232 D3 erratum). The engine takes the keys and asks the
       * translator for each one at every surface — remap screen, help, scan, pad.
       *
       * ⚠️ `start` AND `select` ARE NOT HERE. They belong to the pause (ADR-0144 §4, ADR-0155), and
       * `startClaimProblem`/`selectClaimProblem` would refuse the boot if they were.
       *
       * Four directions move the cursor; `action1` activates the tile under it (slides it, or pushes
       * a whole line). Shuffle and hint arrive in step 11e as `action4` and `action3`.
       */
      preset: {
        up: { labelKey: 'preset.up.label' },
        down: { labelKey: 'preset.down.label' },
        left: { labelKey: 'preset.left.label' },
        right: { labelKey: 'preset.right.label' },
        action1: { labelKey: 'preset.action1.label', hintKey: 'preset.action1.hint' },
      },
      isNavigable: () => true,

      /**
       * ⚠️ PASSING THESE IS WHAT MOUNTS 🌗 AND 🚥. `iconesQueAccionam` only builds an icon that has
       * somebody to action it, and that rule is right — an icon that does nothing teaches a child
       * that the adjustment she depends on is broken. The engine owns the VALUE and persists it; the
       * game owns the EFFECT, which is ADR-0106's division and is why these are two lines here and a
       * repaint below rather than a settings screen of our own.
       *
       * The player index is ignored: this game seats one.
       */
      setPlayerTheme: (_i, tema) => { visual = { ...visual, tema }; repaint?.(visual); },
      setPlayerCorrection: (_i, correcao) => { visual = { ...visual, correcao }; repaint?.(visual); },

      /**
       * ⚠️ AND THIS ONE IS NOT A FEATURE, IT IS A DEFECT BEING CLOSED. Without a table, `acts.resume`
       * is `undefined` — and `entrarNaBarra` calls it to leave the pause card before handing the
       * directional to the accessibility bar. So the card stayed on top of the game and item 7 of
       * ADR-0044, the directional driving the bar, was UNREACHABLE from any game `createGame` mounted.
       * The whole catalogue had it.
       *
       * 📌 A FUNCTION and not a value, which the engine's own note asks for: a game's action table
       * changes during play, and `refrescarItensDaPausa` exists precisely because «a tabela de acções
       * deste jogo pode ter mudado desde a montagem». Frozen at boot it would describe the cartridge
       * that started first.
       */
      getPauseActs: () => pauseActs,
      // ⚠️ `sonarPlayers` LEFT `CartridgeHooks` IN ENGINE 11, and the removal is a feature. The engine
      // derives the listener's position from the DECLARATION now — `topology`, `targetsOf`, `nameAt`,
      // `focusOf` — because every one of those answers was already in the declaration anyway, and
      // asking the hooks for a redundant projection of them was two sources of truth. The sonar does
      // the measuring from the one source it already reads.
    },

    create(ctx: GameCtx): GameInstance {
      const { engine, region, params } = ctx;
      const doc = region.ownerDocument;
      const win = doc.defaultView;
      if (!win) throw new Error('the region is not in a rendered document');

      /**
       * TIE THE GAME'S i18n WRAPPER TO THE ENGINE'S TRANSLATOR. Engine 11 made `t` and `locale`
       * methods of a `Translator` the ROOT builds (ADR-0232 D3), and the game now reads through
       * `engine.t` / `engine.locale`. The arrows are LATE: `onChange` on this wrapper listens to
       * `i18n:change` on `window`, and when it fires `provider.t()` and `.locale()` go through to
       * the engine's new values.
       */
      const i18n = createI18n({
        t: () => engine.t,
        locale: () => engine.locale(),
        win,
      });

      const seedParam = Number(params.get('seed'));
      let seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam >>> 0 : Date.now() >>> 0;

      let size: Size = startSize;
      let geometry = boardGeometry(size);
      run = createRun({ size, seed, solver, board: shuffle(size, ctx.rng(seed)).board });
      // The tiles the hint is lighting — the whole press, one to `size - 1` of them. Not a move and
      // not an arrow: what a player needs to know is WHICH TILES she is about to shift.
      let hint: readonly number[] = [];

      // ⚠️ READ FROM THE ENGINE, NOT FROM THIS GAME'S OWN KEYS. `readStoredVisual` also MIGRATES a
      // profile saved before the two axes existed, which is the difference between migrating a child's
      // setting and silently resetting it — and whoever chose `fix-deuter` chose it because she sees
      // that way.
      visual = readStoredVisual(store, 0);
      let highContrast = visual.tema !== 'padrao';
      const systemReduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      let reducedMotion = store.getBool(key('motion'), systemReduced);

      /**
       * IS MOTION REDUCED — the OR of this game's switch and the engine's calm level.
       *
       * ⚠️ THE ACCESSIBILITY BAR GAVE THIS GAME TWO SWITCHES FOR ONE THING. The bar's TEA icon writes
       * the ENGINE's reduced-motion store; the panel's checkbox writes this game's own key; and the
       * engine offers no event and no general getter to reconcile them — its `reducedMotion` is four
       * flags shaped for the platformer, and the 2048 wrote down its refusal to guess which one
       * answers for a tile.
       *
       * `items` is the closest of the four to a tile that slides, and reading it is a guess — but a
       * guess that can only ever ADD reduction is a safe one. The asymmetry is deliberate: the
       * checkbox cannot turn motion back ON while calm is asked for, because whoever asked for calm
       * asked for it whole.
       */
      // ⚠️ `readStoredScene` NOW TAKES TWO ARGS in engine 11 (ADR-0232 D2c): the store built above and
      // the system's default. Called per slide — not per frame — so the store read stays cheap.
      const motionReduced = (): boolean =>
        reducedMotion || readStoredScene(store, systemReduced).items === true;

      // The engine writes the value and calls this; the game repaints. ADR-0106's division, and the
      // reason the cartridge needs no settings screen of its own for either axis.
      repaint = (v) => { highContrast = v.tema !== 'padrao'; applyLook(); };

      /**
       * THE PAUSE TABLE, AND IT IS SHORT ON PURPOSE.
       *
       * `resume` is the one that is not optional: `entrarNaBarra` calls `acts.resume?.()` to leave the
       * card before handing the directional to the accessibility bar, so an absent table left the card
       * on top of the game and made item 7 of ADR-0044 unreachable from any game `createGame` mounted.
       *
       * ⚠️ AND NOTHING ELSE IS LISTED, WHICH IS THE RULE WORKING RATHER THAN AN OVERSIGHT. A 15-puzzle
       * has nowhere to quit TO, no help screen and nothing to print; `itensQueAccionam` hides what a
       * game cannot action, because «um item sem acção é um botão morto, e em silêncio» — a child who
       * presses it gets no error, no announcement and nothing at all, and a screen reader has just read
       * her an item that does not exist.
       */
      pauseActs = {
        resume: () => engine.pause.hide(0),
        // The engine's own menu carries it too, so the day the card gains an opener this is already
        // the route — and the HUD button beside it is the bridge until then, not a second design.
        empatia: () => { engine.pause.hide(0); empathy.show(); },
      };

      /* ===================== THE TWO BOXES THIS GAME NEEDS, BOTH ITS OWN =====================
       *
       * ⚠️ THE WORLD IS NOT THE REGION, and the distinction is load-bearing rather than tidy. The
       * declaration's `world()` names what the engine may treat as the game, and the engine puts an
       * empathy filter THERE: `blind` is `brightness(0)`, applied to a whole subtree. A CSS filter on
       * an ancestor rasterises everything under it and a descendant CANNOT opt out — `filter: none`
       * on a child is a no-op, not an escape hatch. So the panel has to be a SIBLING of the world,
       * or the simulation blacks out the very control that turns the simulation off and a child is
       * locked inside it.
       *
       * Both are created HERE rather than found in the page, which is what makes `teardown()` a fact:
       * everything this instance made is inside two elements it can remove.
       */
      const world = doc.createElement('div');
      world.id = 'world';
      /**
       * THE LOW-VISION OVERLAY — the half of a simulation a CSS filter cannot carry.
       *
       * The engine splits a low-vision mode in two: a filter (blur, contrast) and an OVERLAY it asks
       * the consumer for through `lvOverlayTex(lv)`. This game never supplied one, so `lv-tunnel` was
       * a faint blur with no tunnel and `lv-macular` was nothing at all. As a grown-up's demonstration
       * that was thin; as the lesson content the Dev says it is, it teaches something false.
       *
       * ⚠️ A SIBLING OF THE BOARD AND NOT A CANVAS PASS. The board is a 320x180 framebuffer with DOM
       * digits over it, and the digits are the game's text — an overlay drawn into the canvas would
       * leave them untouched and the simulation would be a lie in the other direction. A single
       * element on top of both, painted by the stylesheet, covers exactly what a child sees.
       */
      const lvOverlay = doc.createElement('div');
      lvOverlay.id = 'lv-overlay';
      lvOverlay.setAttribute('aria-hidden', 'true');
      const side = doc.createElement('div');
      side.id = 'side';
      region.append(world, side);
      world.appendChild(lvOverlay);

      /**
       * ⚠️ THE ACCESSIBILITY BAR IS BORROWED, NOT OWNED — AND THIS IS THE SECOND OPEN QUESTION
       * ANSWERED, WITH A MEASUREMENT BEHIND IT.
       *
       * The bar belongs to the host: `createGame` builds it into `host.a11yBarHost` before this
       * function exists, and it must survive a cartridge swap because the child's profile is PAGE
       * lifetime (ADR-0038). The obvious reading of the contract — «the shell empties `region`» —
       * would therefore put the bar OUTSIDE the region.
       *
       * 📏 It cannot be. Measured in `dist-pkg/ui/layout.js:102-103`: the engine publishes `--ui-fs`
       * and `--tap` on `#game-region` AND NOWHERE ELSE. `--tap` is `22 * k`, which is what makes the
       * seven icons 44 CSS px at the k=2 floor — the WCAG 2.5.5 target size. A bar outside the region
       * inherits neither, so either it misses the floor or the host re-derives the engine's scale
       * arithmetic by hand, which is the duplicated fact this project spends its records avoiding.
       *
       * So the bar is inside the region, and this cartridge moves it into its own column while it is
       * mounted and puts it back on teardown. What that costs is said out loud: **a shell may not
       * blanket-empty `region`** — `teardown()` is the boundary, not `innerHTML = ''`.
       *
       * 📌 THIS IS WORTH A RECORD AND IT IS NOT THIS FILE'S TO WRITE. Either `--tap` is published
       * somewhere a sibling can reach, or ADR-0139's emptying clause becomes «the cartridge's
       * teardown is the boundary». Both are engine-side; this is the game-side finding.
       */
      const a11yBar = doc.getElementById('a11y-bar');
      const barHome = a11yBar?.parentElement ?? null;
      if (a11yBar) side.appendChild(a11yBar);

      const surface = createSurface();
      world.appendChild(surface.view);

      const slide = createSlide({ reduced: motionReduced });
      const view = createBoardView({
        layer: surface.layer,
        createDrawing: surface.createDrawing,
        geometry,
        palette: highContrast ? HIGH : NORMAL,
      });

      const grid = createTileGrid({
        doc,
        i18n,
        run: () => run as Run,
        geometry: () => geometry,
        actionOf: (code) => engine.keyboard.actionOf(code, 0),
        onActivate: (index) => activate(index),
      });
      world.appendChild(grid.root);

      const hud = createHud({
        doc,
        i18n,
        run: () => run as Run,
        initial: { size, reducedMotion },
        onShuffle: () => newRun(size, Date.now() >>> 0, 'a11y.shuffled'),
        onHint: () => showHint(),
        onEmpathy: () => (empathy.isOpen() ? empathy.hide() : empathy.show()),
        onSize: (next) => { store.set(key('size'), next); newRun(next, Date.now() >>> 0, 'a11y.sizeChanged'); },
        onReducedMotion: (on) => { reducedMotion = on; store.setBool(key('motion'), on); },
      });
      side.appendChild(hud.root);

      /**
       * ⚠️ IN THE COLUMN AND NOT IN THE WORLD, WHICH IS WHAT MAKES LEAVING POSSIBLE. The empathy filter
       * lands on `#world` and a CSS filter rasterises its whole subtree — so a panel inside it would go
       * dark with everything else under `blind`, and the control for switching the simulation off would
       * be the first thing the simulation hid. A child would be locked inside a lesson.
       */
      const empathy = createEmpathyPanel({
        doc,
        i18n,
        visual: () => visual,
        onPick: (simulacao) => { visual = { ...visual, simulacao }; applyLook(); },
      });
      side.appendChild(empathy.root);

      /* ===================== THE TWO SCREENS =====================
       *
       * `createGame` hands over a scene stack, empty and ready, and this is what it is for. Two
       * screens is little enough that a boolean would run — and a boolean is exactly how the third
       * consumer ends up with a third spelling of the same idea.
       */
      const titleScreen = createTitleScreen({
        doc,
        i18n,
        reducedMotion: motionReduced,
        onStart: () => start(),
      });
      world.appendChild(titleScreen.root);

      const cenaJogo = { name: 'playing' };
      const cenaTitulo = { name: 'title',
        enter: () => { titleScreen.show(); grid.setInert(true); },
        exit: () => { titleScreen.hide(); grid.setInert(false); },
      };

      function start(): void {
        if (engine.scenes.top()?.name !== 'title') return;
        engine.scenes.replace(cenaJogo);
        grid.focusCursor();
        // The board has just arrived and she cannot see it. One sentence, the same one the grid
        // carries as its own label — said once here because nothing else announces an arrival.
        srSay(`${i18n.t('a11y.boardLabel', { size: (run as Run).size })}. ${i18n.t('a11y.gridHint')}`);
      }

      function playing(): boolean { return engine.scenes.top()?.name === 'playing'; }

      function applyLook(): void {
        const palette = highContrast ? HIGH : NORMAL;
        view.setPalette(palette);
        region.dataset.contrast = highContrast ? 'high' : 'normal';
        // ⚠️ THE DIGIT'S COLOUR COMES FROM THE SAME TABLE THE TILE BODY DOES. The stylesheet carries
        // fallbacks so the page is never unstyled, but a fallback that silently becomes the real
        // value is how the measured ratios in render/palette stop describing what is on screen.
        region.style.setProperty('--tile-ink', palette.ink);
        region.style.setProperty('--accent', palette.accent);
        region.style.setProperty('--title-bg', palette.backdrop);
        region.style.setProperty('--title-ink', palette.tileAway);
        /**
         * THE FILTER COMES FROM THE ENGINE'S AXES NOW, and the mapping is three lines because the
         * vocabulary is the engine's: `tricro` is a NAME for trichromatic vision and not an absence,
         * so it is the one correction that resolves to no filter at all.
         *
         * The game declares which element is the world and `applyVisionFilter` puts the filter
         * there, so the reach rule stays in one place — and `#world` is a filter boundary precisely so
         * the panel and the borrowed bar stay legible under a simulation.
         */
        /**
         * ⚠️ SIMULATION WINS OVER CORRECTION, and it is not a hidden precedence rule: the two cannot
         * coexist, and `simulationUnavailable` is what keeps them apart — the panel refuses to offer a
         * simulation while an adaptation is on, and says why. This `??` only ever fires for a state
         * nobody could build through the interface.
         */
        const mode = visual.simulacao
          ?? (visual.correcao === 'tricro' ? 'normal' : `fix-${visual.correcao}`);
        // The overlay carries the SHAPE of a low-vision mode; the filter carries its haze. Absent
        // attribute = no overlay, which is every other mode including `blind`.
        const lv = VIZ_MODES.find((m) => m.key === mode)?.lv;
        if (lv) lvOverlay.dataset.lv = lv; else delete lvOverlay.dataset.lv;
        engine.applyVisionFilter(visionFilter(mode), reachOfMode(mode));
      }

      function newRun(next: Size, nextSeed: number, announcement: string): void {
        slide.cancel();
        hint = [];
        size = next;
        seed = nextSeed;
        geometry = boardGeometry(size);
        run = createRun({ size, seed, solver, board: shuffle(size, ctx.rng(seed)).board });
        view.setGeometry(geometry);
        grid.rebuild();
        grid.setHint([]);
        hud.refresh();
        srSay(i18n.t(announcement, { size, need: size * size - 1 }));
      }

      function activate(index: number): void {
        if (!playing()) return;            // the title screen is up; the board is scenery behind it
        if (slide.active()) return;        // one move at a time; the guard chess needed too
        const r = run as Run;
        const result = r.activate(index);
        if (result.kind === 'blocked') { srSay(i18n.t('a11y.blocked')); return; }
        if (result.kind === 'blank') { srSay(i18n.t('a11y.blankCell')); return; }

        hint = [];
        grid.setHint([]);
        slide.begin(result.push, r.size, geometry.cell + geometry.gap);
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
          have: r.tilesHome(),
          need: r.size * r.size - 1,
        }));
        if (r.solved()) srAlert(i18n.t('status.solved', { moves: r.moves() }));
      }

      function showHint(): void {
        const r = run as Run;
        const presses = r.hint(3);
        if (!presses.length) { srSay(i18n.t('a11y.hintNone')); return; }
        // ⚠️ THE TILES, NOT AN ARROW. An arrow says "something arrives here"; what she has to know is
        // which tiles she is about to shift — and with a push that is up to four at once.
        const next = presses[0];
        hint = next.map((m) => m.from);
        grid.setHint(hint);
        // It REVEALS and never plays. The cursor goes to the tile she would PRESS — the far end of
        // the push, since pressing any nearer one would move fewer tiles than the hint is showing.
        r.setCursor(next[next.length - 1].from);
        grid.refresh();
        grid.focusCursor();
        srSay(i18n.t('a11y.hint', { moves: presses.map((p) => i18n.describePush(p)).join(', ') }));
      }

      // The language can change under a running game; anything JavaScript BUILT has to rebuild. The
      // engine re-applies only the static markup, and says so.
      const stopI18n = i18n.onChange(() => {
        grid.rebuild(); hud.relabel(); titleScreen.refresh(); empathy.refresh();
      });

      applyLook();
      engine.scenes.push(cenaTitulo);

      let dialogWasOpen = false;
      let frames = 0;

      return {
        update(dt: number): void {
          frames++;
          // Held out of the tab order while an engine dialog is open — or while the title screen is
          // up, which is the same requirement for the same reason: a grid of twenty-five buttons
          // behind something is still Tab-reachable, and the engine installs no focus trap anywhere.
          const open = engine.nav.sharedDialogOpen() !== null || !playing();
          if (open !== dialogWasOpen) { dialogWasOpen = open; grid.setInert(open); }

          slide.advance(dt);
          const travelling = slide.travelling();
          // ⚠️ TWO WRITES, ONE CALLBACK, ONE INTEGER. There is no CSS transition anywhere, so the
          // number and the tile body cannot drift — they are the same number.
          view.draw({
            board: (run as Run).board(),
            movable: legalMoves((run as Run).board()).map((m) => m.from),
            hint,
            travelling,
          });
          grid.setOffset(travelling);
          surface.render();
        },

        teardown(): void {
          stopI18n();
          slide.cancel();
          // ⚠️ THE POINTERS GO FIRST. Both are read by the engine through the cartridge's hooks, which
          // outlive this instance: a `setPlayerTheme` arriving after teardown would repaint a board
          // that no longer exists, and a pause item would call into a torn-down closure. The visual
          // STATE stays — it is the child's, not the game's (ADR-0038).
          repaint = null;
          pauseActs = {};
          // ⚠️ THE BORROWED BAR GOES BACK FIRST, before anything is removed. It is the host's, it
          // outlives this cartridge, and it is inside a column that is about to stop existing.
          if (a11yBar && barHome) barHome.appendChild(a11yBar);
          // ⚠️ THE STACK IS EMPTIED BEFORE ANYTHING IS DESTROYED, and the order is the whole of it.
          // Each `exit()` touches the screen it belongs to — `titleScreen.hide()`, `grid.setInert`
          // — so popping after `destroy()` would call a method on a component that has already let
          // go of its DOM. ADR-0142 §3 makes the same point from the engine's side: a `clear()` that
          // skipped `exit()` would be the wrong fix, because `exit()` is where the cleanup lives.
          while (engine.scenes.top()) engine.scenes.pop();
          titleScreen.destroy();
          empathy.destroy();
          grid.destroy();
          hud.destroy();
          surface.destroy();
          world.remove();
          side.remove();
          // The look was written onto the HOST's element, so it is this instance's to undo.
          delete region.dataset.contrast;
          for (const v of ['--tile-ink', '--accent', '--title-bg', '--title-ink']) {
            region.style.removeProperty(v);
          }
          run = null;
        },

        debug: {
          run: () => run,
          declaration,
          seed: () => seed,
          geometry: () => geometry,
          frames: () => frames,
          /**
           * ⚠️ FOR THE AXE GATE, AND IT IS NOT A BACK DOOR AROUND THE ENGINE. The high-contrast theme
           * is the engine's to write now; the scan needs to reach a NAMED level without depending on
           * how many presses of the 🌗 icon it currently takes to get there — which is the engine's
           * business and would rot this script silently the day it changes. So the scan sets the axis
           * and the game repaints through the same path the icon uses.
           */
          setTema: (tema: VisualState['tema']) => {
            visual = { ...visual, tema };
            repaint?.(visual);
          },
          activate,
          hint: showHint,
          start,
          /** Advance one frame by hand, for a pane that is not firing rAF. */
          step: (dt = 1) => {
            slide.advance(dt);
            const travelling = slide.travelling();
            view.draw({
              board: (run as Run).board(),
              movable: legalMoves((run as Run).board()).map((m) => m.from),
              hint,
              travelling,
            });
            grid.setOffset(travelling);
            surface.render();
          },
        },
      };
    },
  };
}

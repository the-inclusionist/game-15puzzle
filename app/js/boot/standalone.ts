// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/standalone — the app shell. The PAGE's half of `CreateGameOptions`, and nothing about tiles.
//
// ========================= WHY THERE ARE TWO SHELLS AND THIS IS ONE OF THEM =========================
// ADR-0140: a game is a standalone PWA *and* a cartridge, from one source. This file is what makes
// the first half true — it calls `createGame`, builds a `ctx`, calls the cartridge's factory and runs
// the loop. The platform is simply a different shell around the same factory, and nothing in
// `cartridge.ts` knows which one it got.
//
// ⚠️ AND THE LINE ADR-0140 §3 DRAWS IS WORTH REPEATING WHERE IT IS EASY TO CROSS. The artifact this
// file produces is a DEVELOPMENT, TEST, AUDIT AND DEMONSTRATION route. It is not a delivery route to
// a child: the moment one is deployed for children, every word of ADR-0117 applies — Cache Storage
// partitions by origin, the accessibility profile stops following the child between games, and a
// school network has a second address to allow. Publishing one would be a new record, not an
// extension of this one.
//
// ========================= THE ORDER HERE IS LOAD-BEARING =========================
//  1. The dictionaries FIRST, because `createGame` runs `initI18n`, which translates the static
//     markup. Keys registered after that point are correct in `t()` and stale on the screen.
//  2. `createGame()`, which builds the whole accessibility stack from the declared fields.
//  3. `engine.nav.attach()`, WHICH `createGame` DOES NOT CALL. Without it the engine's own dialogs
//     are mouse-only — a WCAG 2.1.1 failure axe cannot see, because it is an interaction.
//  4. The cartridge, then the loop.

import { createGame } from '@the-inclusionist/engine';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { createLayout } from '@the-inclusionist/engine/ui/layout.js';

import { createCartridge } from '../cartridge.ts';
import { createRng } from '../puzzle/rng.ts';

/**
 * THE CLOCK, AND IT BELONGS TO THE SHELL — which is the change this conversion actually makes here.
 *
 * ⚠️ IT USED TO BE THE CARTRIDGE'S, BY ACCIDENT OF WHERE PIXI LIVES. `startLoop` takes a Pixi-shaped
 * ticker, the Pixi `Application` is built inside the game's surface, and so the composition root
 * reached into the game for its clock. ADR-0139 §3 puts it the other way round and gives the reason:
 * six cartridges each opening their own frame callback is six loops competing for one frame, and in
 * the platform ONE loop calls each mounted cartridge's `update(dt)`.
 *
 * The shape `startLoop` needs is three members, so the shell can satisfy it without importing Pixi
 * at all — which also means the cartridge's renderer stops being the thing that decides when
 * anything ticks. `createSurface` passes `autoStart: false` for the same reason: its application
 * must not run a second clock beside this one.
 *
 * 📏 `deltaTime` IS IN FRAMES, NOT SECONDS, because that is what Pixi's ticker means by it and what
 * every game in this house was written against — 1.0 at 60 Hz. Handing seconds to physics written
 * for frames is the inherited convention that most often breaks, and the brief names it twice.
 */
function rafTicker(): { add(fn: () => void): void; deltaTime: number; remove(fn: () => void): void } {
  const callbacks = new Set<() => void>();
  let last = performance.now();
  const ticker = {
    deltaTime: 1,
    add(fn: () => void) { callbacks.add(fn); },
    remove(fn: () => void) { callbacks.delete(fn); },
  };
  const step = (now: number): void => {
    // Clamped at the source as well as by `startLoop`'s own `maxDt`: a tab that was in the
    // background for a minute must not deliver one frame worth 3,600 of them.
    ticker.deltaTime = Math.min((now - last) / (1000 / 60), 4);
    last = now;
    for (const fn of callbacks) fn();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return ticker;
}

function mount(): void {
  const doc = document;
  const need = (id: string): HTMLElement => {
    const el = doc.getElementById(id);
    if (!el) throw new Error(`#${id} is missing: the host contract is not met`);
    return el;
  };
  const region = need('game-region');
  const a11yBar = need('a11y-bar');

  const cartridge = createCartridge();

  const engine = createGame({
    /**
     * THIS GAME'S WORDS. Engine 11 took `dictionaries` as a REQUIRED companion to anything the
     * declaration names by key — accommodations, preset, hud, gameOptions, howToPlay (ADR-0232 D3
     * erratum). The old `registerDict` loop in this shell is gone; the engine's translator registers
     * everything itself from this map before anything is drawn.
     *
     * ⚠️ WE PASS THE INNER `.strings`, not the catalog objects. The cartridge exports `dicts` with
     * the full `Catalog` shape (nouns, patterns, strings); the engine wants just the string table.
     */
    dictionaries: Object.fromEntries(
      Object.entries(cartridge.dicts).map(([code, catalog]) => [code, catalog.strings]),
    ),
    declaration: cartridge.declaration,
    host: {
      doc,
      win: window,
      cvdHost: doc.getElementById('cvd'),
      /**
       * WHERE THE SEVEN ACCESSIBILITY ICONS GO. Left unnamed the engine looks for `#title-icons` —
       * the platformer's id — and, not finding one, reports the real defect: the child cannot reach
       * blind mode, TTS or Libras before starting, because the title screen covers the panel. Five of
       * the six games in the catalogue were in that state.
       *
       * ⚠️ IT IS INSIDE `#game-region` ON PURPOSE, and the cartridge borrows it into its own column
       * while mounted. The engine publishes `--tap` (22·k, so 44 CSS px at the k=2 floor) on the
       * region and nowhere else, so a bar outside it either misses the WCAG 2.5.5 target size or
       * makes the host re-derive the engine's scale arithmetic by hand. See the long note in
       * `cartridge.ts`, and the consequence: this shell must never blanket-empty the region.
       */
      a11yBarHost: a11yBar,
    },
    // ⚠️ EVERY GAME-OWNED FIELD COMES FROM THE CARTRIDGE, SPREAD RATHER THAN LISTED. Engine 9.0.0
    // exports `CartridgeHooks` — the fifteen fields ADR-0139 §1 puts on the game's side, after the
    // erratum that moved five of them — so listing them here again would be a second copy of a list
    // that has already been wrong once. `declines` was one of the five, and it lived here.
    ...cartridge.hooks,
    /**
     * WHAT THIS GAME USES (ADR-0216, ADR-0255). Engine 11 took the delivery of narration AND fonts
     * out of the game's hands: `uses: { neuralVoice, fonts }` says what to make available, and the
     * engine imports its own Kokoro runtime at the first neural utterance («o jogo não deve precisar
     * saber como isso funciona») and streams the declared fonts from the font library.
     *
     * ⚠️ `piper-tts-web` AND `carregarVozNeural` ARE GONE. The engine ships its own Kokoro — espeak-ng
     * + onnxruntime-web — and the 27 MB WASM leaves this game's dependency tree with them.
     *
     * `fonts: ['Press Start 2P']` names what the title screen draws with. The library serves it from
     * `heavy/` with a SHA256-pinned `@font-face` the engine writes; `app/public/fonts/` goes away in
     * this commit together with the local `@font-face` rule. `npx inclusionist-heavy dist --fonts
     * "Press Start 2P"` writes the file into the delivery at build time (step 11g wires that into the
     * script).
     */
    uses: { neuralVoice: true, fonts: ['Press Start 2P'] },
  });

  engine.nav.attach();      // createGame does not — see the header

  const instance = cartridge.create({
    engine,
    region,
    // ⚠️ THE SHELL BUILDS THE STREAM, ONE PER CARTRIDGE (ADR-0141). The engine's `core/rng` exports
    // `rnd`/`randInt`/`shuffle`/`reseed` bound to ONE module-level generator, so two cartridges
    // importing them draw from the same stream and a `reseed` in one repositions the other's. With
    // one game on one page that is invisible, which is exactly why the rule needs a gate, not care.
    rng: createRng,
    // ⚠️ NOT handed `location` itself. In the platform there is one address for every cartridge, so
    // a game reading `location.search` reads another game's parameters — and this one reads `?seed=`.
    params: new URLSearchParams(location.search),
  });

  /**
   * MOUNT AFTER CREATE, AND THE ORDER IS THE WHOLE POINT (ADR-0142, engine 9.0.0).
   *
   * 📏 MEASURED BEFORE THIS LINE EXISTED: `engine.problems` held «mundo declarado não encontrado:
   * #world». `createGame` resolves the declaration's `world()` selector at boot, and after the
   * cartridge conversion `#world` is created by `create(ctx)` — which necessarily runs later. The
   * effect was diagnostic only, because `applyVisionFilter` resolves the selector at the point of
   * use, but a diagnostic that is wrong is worse than one that is missing.
   *
   * ⚠️ AND IT SHOWED THE RECORD'S CLAIM WAS NARROWER THAN THE DEFECT. ADR-0142 says `problems` and
   * `alcance` are not to be trusted «in platform mode»; this is one shell and one game, and they were
   * already wrong. They go stale the moment a game stops pre-declaring its own DOM, which is what the
   * cartridge contract asks of every game. `mount` re-derives them with the world in the document.
   *
   * 📌 It also LANDS the hooks: `mount(declaration, ganchos)` is how the fifteen game-owned fields
   * reach an engine that may serve several cartridges. Here there is one, and the call is the same.
   */
  engine.mount(cartridge.declaration, cartridge.hooks);
  if (engine.problems.length) throw new Error(`host contract: ${engine.problems.join(' | ')}`);

  /**
   * ⚠️ THE PAGE IS THE SHELL'S, SO PUBLISHING IS TOO. The cartridge hands its verification surface
   * back; this decides whether anyone asked for it and what it is called. In a platform the same
   * instance surface can be exposed per game without six cartridges racing for one global name.
   */
  if (new URLSearchParams(location.search).get('debug') === 'true') {
    (window as unknown as Record<string, unknown>).__puzzle = { ...instance.debug, engine };
  }

  /**
   * ⚠️ `createLayout(ctx)` IS A FACTORY NOW. `initLayout`/`layout` were module-level in engine 8–9
   * and gone in 11.0.0 (`ui/layout.d.ts`): a `Layout` object with its own `.layout()` method, and the
   * ctx takes `afterScale` as a REQUIRED port because the engine stopped reaching for the CRT by
   * import (ADR-0232 D2c). A game with no CRT passes `() => {}` and the record asks it to say so.
   */
  const stage = createLayout({
    doc: document,
    win: window,
    numPlayers: () => 1,
    afterScale: () => { /* no CRT in this game */ },
  });
  stage.layout();
  window.addEventListener('resize', stage.layout);

  /**
   * ⚠️ THE LOOP IS THE SHELL'S (ADR-0139 §3), AND `dt` IS IN FRAMES.
   *
   * Six cartridges each opening their own frame callback is six loops competing for one frame. In
   * the platform one loop calls each mounted cartridge's `update(dt)`; here there is one cartridge
   * and the shape is the same.
   *
   * `onFailure` is where spec D16 lives — one broken game must stay distinguishable from a broken
   * engine. In 11.0.0 the loop's option object changed from `{ aoFalhar }` to **required**
   * `{ speed, onFailure }` (ADR-0232 D2c erratum): `speed` is read every frame so a child's choice
   * takes effect on the next one; `onFailure` is the one-shot channel of whoever cannot see the
   * screen stop, now owned by the engine (`engine.onFailure` — screen reader, narration and a
   * visible line all at once). The console line is for whoever is reading one.
   */
  // ⚠️ `vlTick()` IS GONE WITH THE REST OF VLIBRAS. Engine 11 owns deaf mode as `engine.deafMode`
  // and the sign-language interpreter arrives through `host.interpreter`. Until there is an
  // interpreter the game cares about, the loop does one thing per frame: tell the cartridge.
  startLoop(rafTicker(), (dt) => instance.update(dt), 2, {
    speed: engine.gameSpeed,
    onFailure: (failure: unknown) => { console.error(failure); engine.onFailure(failure); },
  });
}

mount();

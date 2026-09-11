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
import { registerDict } from '@the-inclusionist/engine/core/i18n.js';
import { srAlert, setVlibrasSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { vlibrasSay, vlTick } from '@the-inclusionist/engine/ui/vlibras.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { initLayout, layout } from '@the-inclusionist/engine/ui/layout.js';
import { PESADOS, baixarPesados } from '@the-inclusionist/engine/platform/pesados.js';

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

  // ⚠️ THE SHELL REGISTERS, NOT THE CARTRIDGE (ADR-0139). Which locales exist and when they are
  // installed is a statement about the page. The cartridge exports the catalogues and never decides
  // when they land — which is also why this has to happen before `createGame` runs `initI18n`.
  for (const [code, catalog] of Object.entries(cartridge.dicts)) registerDict(code, catalog.strings);

  const engine = createGame({
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
    // No gamepad wizard and no pause actor. Declared rather than deduced from a getter returning null.
    // `semMenuDePausa` no longer exists: ADR-0120 made the pause undeclinable, and `pauseHost` decides
    // only WHERE the card hangs.
    declines: { semAssistenteDePad: true, semAtorDePausa: true },
    isNavigable: cartridge.hooks.isNavigable,
    /**
     * THE NEURAL VOICE — the host's half, which is why it is here and not in the cartridge.
     *
     * The voices are NARRATION, the resource of a child who cannot read, and a sliding puzzle is
     * exactly a game such a child can play if it is read to her well. The engine takes the provider
     * as a PORT (ADR-0094) because `onnxruntime-web` is a non-optional peer: naming it in the engine
     * would put 135 MB in every consumer's node_modules, including games that never speak.
     *
     * 📌 In cartridge form this line does not exist and the platform carries it once for every game
     * (ADR-0117), which is the whole of the arithmetic — Cache Storage is partitioned by origin, so
     * one platform pays once where six PWAs would each pay in full.
     */
    carregarVozNeural: () => import('@mintplex-labs/piper-tts-web'),
    /**
     * ⚠️ FALSE, AND THE DOWNLOAD IS ASKED FOR SEPARATELY. The engine's blanket default fetches the
     * whole heavy catalogue, and most of it is not this game's: 34 MB of MediaPipe vision models plus
     * WebGazer, which the 2048's measurement says fails by CORS on every load. Nothing here uses a
     * camera.
     */
    baixarPesados: false,
    // The sonar's listener position is the GAME's to state — ADR-0139 puts every callback INTO the
    // game on its side of the split, and this one reads the cursor.
    sonarPlayers: cartridge.hooks.sonarPlayers,
  });

  /**
   * THE VOICES, AND ONLY THE VOICES. `createGame` takes a boolean and does not pass a filter through,
   * but `baixarPesados` itself does, and its own comment names the consumer: «Só estas ids, se dado.
   * Serve ao consumidor que quer as vozes e não o resto.»
   *
   * ⚠️ DERIVED FROM THE CATALOGUE, never hand-written: a voice added upstream arrives on its own.
   * It does not block the boot and its failure is swallowed — a game that will not start because a
   * voice is missing is worse than a game that speaks in the browser's own voice.
   */
  void baixarPesados({ apenas: PESADOS.filter((p) => p.id.startsWith('voz:')).map((p) => p.id) });

  // LIBRAS — the announcements reach the interpreter and not only the live region. The bar's button
  // and the mode are the engine's; this is the translator being handed the text.
  setVlibrasSay(vlibrasSay);

  /**
   * ⚠️ `engine.problems` IS NO LONGER EMPTY, AND THE CONVERSION IS WHY — MEASURED, NOT SUPPOSED.
   *
   * It holds exactly one line: «mundo declarado não encontrado: #world». `createGame` resolves the
   * declaration's `world()` selector AT BOOT (`create-game.js:120`, one of the nine eager reads
   * ADR-0139 §5 counted), and `#world` does not exist at boot any more — the CARTRIDGE creates it,
   * inside the region, when `create(ctx)` runs, which is necessarily after this call.
   *
   * 📏 THE EFFECT IS DIAGNOSTIC ONLY, and that was checked rather than hoped: `aplicarFiltroDeVisao`
   * resolves the selector at the point of USE, so the blindness simulation still lands on the world
   * and spares the bar and the panel. The boot protocol measures one filtered ancestor over the
   * board and zero over both controls.
   *
   * 📌 AND IT IS EVIDENCE FOR A RECORD THAT IS ALREADY ACCEPTED AND NOT BUILT. ADR-0142 gives the
   * engine `mount(declaration, hooks)` precisely to re-derive those eager reads, and says
   * `engine.problems` is not to be trusted «in platform mode». This shows the claim is wider than the
   * record states: it goes stale the moment a game stops pre-declaring its own DOM, which is exactly
   * what the cartridge contract asks every game to do. One shell, one game, and the diagnostic is
   * already wrong.
   *
   * So the line is NAMED rather than tolerated. A tolerated defect hides the next one; a named one
   * fails loudly the moment anything else joins it.
   */
  const KNOWN = ['mundo declarado não encontrado: #world'];
  const unexpected = engine.problems.filter((p) => !KNOWN.includes(p));
  if (unexpected.length) throw new Error(`host contract: ${unexpected.join(' | ')}`);
  if (engine.problems.length !== KNOWN.length) {
    console.warn('host contract: a known problem stopped being reported — the engine may have grown mount()');
  }

  engine.nav.attach();      // createGame does not — see the header

  const instance = cartridge.create({
    engine,
    region,
    // ⚠️ THE SHELL BUILDS THE STREAM, ONE PER CARTRIDGE (ADR-0141). The engine's `core/rng` exports
    // `rnd`/`randInt`/`shuffle`/`reseed` bound to ONE module-level generator, so two cartridges
    // importing them draw from the same stream and a `reseed` in one repositions the other's. With
    // one game on one page that is invisible, which is exactly why the rule needs a gate and not care.
    rng: createRng,
    // ⚠️ NOT handed `location` itself. In the platform there is one address for every cartridge, so
    // a game reading `location.search` reads another game's parameters — and this one reads `?seed=`.
    params: new URLSearchParams(location.search),
  });

  /**
   * ⚠️ THE PAGE IS THE SHELL'S, SO PUBLISHING IS TOO. The cartridge hands its verification surface
   * back; this decides whether anyone asked for it and what it is called. In a platform the same
   * instance surface can be exposed per game without six cartridges racing for one global name.
   */
  if (new URLSearchParams(location.search).get('debug') === 'true') {
    (window as unknown as Record<string, unknown>).__puzzle = { ...instance.debug, engine };
  }

  initLayout({ numJogadores: () => 1 });
  layout();
  window.addEventListener('resize', layout);

  /**
   * ⚠️ THE LOOP IS THE SHELL'S (ADR-0139 §3), AND `dt` IS IN FRAMES.
   *
   * Six cartridges each opening their own frame callback is six loops competing for one frame. In
   * the platform one loop calls each mounted cartridge's `update(dt)`; here there is one cartridge
   * and the shape is the same.
   *
   * `aoFalhar` is where spec D16 lives — one broken game must stay distinguishable from a broken
   * engine. It reaches `srAlert`, because a stopped screen is invisible to a child who cannot see it,
   * and the console line is for whoever is reading one.
   */
  startLoop(rafTicker(), (dt) => {
    vlTick();
    instance.update(dt);
  }, 2, {
    aoFalhar: (error: unknown) => { console.error(error); srAlert(String(error)); },
  });
}

mount();

// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';

// ============================ THE ENGINE COMES FROM THE REGISTRY ============================
// `"@the-inclusionist/engine": "^11.0.0"` as a PEER and `11.0.0` exact as a devDependency (ADR-0140 §4). It was `file:../SP-the-inclusionist-tracer`
// while nothing was published — a bootstrap, and the reason CI could never go green, since no runner
// has a sibling directory. ADR-0072 settled where it comes from instead (public npmjs, because a
// volunteer without a token cannot install from GitHub Packages), and it is there now.
//
// ⚠️ AND IT IS DECLARED TWICE, WHICH IS NOT REDUNDANCY. `peerDependencies` installs nothing — it is
// a requirement addressed to whoever consumes this package, and it is what makes a platform install
// exactly ONE engine for six games. Without a `devDependency` beside it a clean clone has no engine
// and does not build. The peer range is a caret because a consumer must be able to unify six games
// onto one copy; the dev pin is exact, for the reason the house already pins PixiJS — the catalogue's
// manifest names an exact version per game (ADR-0068 §2), and a range would make "which engine did
// this build use" a question about the day rather than about the lockfile.
//
// To develop against a local engine checkout again: `npm install ../SP-the-inclusionist-tracer`,
// which is ADR-0036's loop — link locally, pin remotely — and revert before committing.
//
// The engine ships `dist-pkg/*.js` with a `.d.ts` beside each one, so a game imports
// `@the-inclusionist/engine/core/contract.js`. ⚠️ The `.js` is part of the subpath pattern:
// `core/contract.ts` resolves to NOTHING, with an error that names export conditions rather than the
// extension, which is a confusing half-minute the first time.
//
// `optimizeDeps.exclude` no longer has a symlink to argue about, and is kept for a duller reason:
// the engine is a large ESM package whose modules Vite would otherwise pre-bundle into one blob,
// which makes a stack trace inside it unreadable while this game is still learning its surface.
// ============================ TWO TARGETS, ONE SOURCE (ADR-0140) ============================
// `vite build`            -> the APP: `app/index.html`, engine and Pixi BUNDLED, a standalone PWA.
//                            It is also the test harness, the demonstration and the accessibility
//                            audit surface, which is most of the reason the record exists.
// `vite build --mode lib` -> the CARTRIDGE: `app/js/cartridge.ts`, engine and Pixi EXTERNAL, no
//                            HTML and no service worker. This is what gets published.
//
// #include-both-in-ci: the record's first gate is that CI builds BOTH and fails on either, because
// "a change tested only in the app build can break the lib build, and nothing notices until the
// platform installs it". `npm run validate` runs both for the same reason.
const LIB = {
  // ⚠️ A REGEX FOR THE ENGINE, NOT A STRING. Every import in this repository is a SUBPATH —
  // `@the-inclusionist/engine/core/a11y-sr.js` — and an exact string would externalise the bare
  // specifier only, silently inlining the twenty subpath modules that are the whole of the weight.
  external: [/^@the-inclusionist\/engine/, 'pixi.js'],
};

/**
 * THE APP BUILD IS A PWA, AND THE PRECACHE LIST IS THE WHOLE DECISION.
 *
 * ADR-0140's third gate is that the app build emits a service worker and a manifest; five of the six
 * games were not PWAs, and `game-2048`'s README promised «offline as a PWA» over a build with
 * neither. That is the promise being made true here.
 *
 * ⚠️ AND THE 27 MB WASM IS DELIBERATELY NOT PRECACHED. Workbox's default ceiling is 2 MB, so the
 * honest choices were to raise it and have a first visit download 28 MB before the page is usable,
 * or to leave the voice runtime to be fetched when the voice is actually wanted. The second is the
 * one that matches ADR-0116's «first day ONLINE, then offline-first»: the shell, the board and every
 * control are offline after the first visit, and the neural voice — which `baixarPesados` already
 * fetches in the background, into the engine's own Cache Storage bucket — is not held hostage to the
 * page's own precache. Precaching it twice, in two caches, would be the duplicated fact as bytes.
 *
 * 📌 `lang` is pt-BR and `scope` is './'. Both are named because the platformer got them wrong in the
 * only two ways available: `"lang": "en"` on a product delivered in Portuguese, and `"scope": "/"`,
 * which claims the whole origin — fatal the day more than one thing is served from it.
 */
const PWA = VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,txt}'],
    globIgnores: ['**/ort-wasm*', '**/*.wasm'],
  },
  manifest: {
    name: 'Inclusionist 15-Puzzle',
    short_name: '15-Puzzle',
    lang: 'pt-BR',
    dir: 'ltr',
    scope: './',
    start_url: './',
    display: 'standalone',
    background_color: '#05070f',
    theme_color: '#05070f',
  },
});

export default defineConfig(({ mode }) => ({
  root: 'app',
  // ⚠️ THE LIB BUILD IS NOT A PWA, and that is the general rule rather than an exception: a cartridge
  // inside a platform must not install a second service worker on the platform's origin.
  plugins: mode === 'lib' ? [] : [PWA],
  /**
   * ⚠️ NO `public/` IN THE CARTRIDGE, AND IT COST A GATE TO NOTICE. The first lib build copied
   * `app/public/fonts/` into `dist-lib/`, which ADR-0117's confirmation forbids in as many words:
   * «A CARTRIDGE DECLARES NO DELIVERY — no font file, no voice, no runtime in a game's own package or
   * `dist`. ⚠️ Asserted as ABSENCE on the cartridge side too, or «the platform has it» would pass
   * while every game shipped its own copy anyway.» Six cartridges each carrying their own copy of a
   * typeface is the arithmetic that record exists to prevent.
   *
   * 📌 AND IT LEAVES A REAL EDGE OPEN, which is named rather than papered over. ADR-0119 lists what
   * the platform supplies once — fonts, neural voice, vision runtime, art — and the "fonts" there are
   * the engine's readability ROSTER (ADR-0012). Press Start 2P is not in that roster: it is this
   * game's LOGO, scoped to the title screen and deliberately kept off the board. So in cartridge form
   * the title falls back to the platform's own stack until somebody decides where a game-specific
   * display face belongs. That is a question for the record, not for this file.
   */
  publicDir: mode === 'lib' ? false : undefined,
  build: mode === 'lib'
    ? {
        outDir: '../dist-lib',
        emptyOutDir: true,
        target: 'es2022',
        lib: { entry: 'js/cartridge.ts', formats: ['es'], fileName: () => 'cartridge.js' },
        rollupOptions: { external: LIB.external },
      }
    : { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: {
    exclude: ['@the-inclusionist/engine'],
    include: ['pixi.js'],
  },

  test: {
    projects: [
      {
        // The puzzle itself: board, shuffle, solver, run, the declaration, geometry, palette,
        // i18n. None of it may touch a DOM or PixiJS, and running here without either is the
        // pressure that keeps it that way.
        test: {
          name: 'node',
          root: import.meta.dirname,
          environment: 'node',
          include: ['tests/**/*.node.test.ts'],
        },
      },
      {
        // Anything needing a real focus ring, a real canvas or a real aria-live region: the tile
        // grid, the HUD, the announcements, and the registration between DOM number and canvas
        // tile body that the whole DOM-over-canvas decision rests on.
        test: {
          name: 'browser',
          root: import.meta.dirname,
          include: ['tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
}));

// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE COMES FROM THE REGISTRY ============================
// `"@the-inclusionist/engine": "^8.0.0"` as a PEER and `8.0.0` exact as a devDependency (ADR-0140 §4). It was `file:../SP-the-inclusionist-tracer`
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

export default defineConfig(({ mode }) => ({
  root: 'app',
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

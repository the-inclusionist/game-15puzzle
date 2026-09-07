// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE COMES FROM THE REGISTRY ============================
// `"@the-inclusionist/engine": "7.0.1"`, pinned exact. It was `file:../SP-the-inclusionist-tracer`
// while nothing was published — a bootstrap, and the reason CI could never go green, since no runner
// has a sibling directory. ADR-0072 settled where it comes from instead (public npmjs, because a
// volunteer without a token cannot install from GitHub Packages), and it is there now.
//
// Pinned exact rather than caret, for the reason the house already pins PixiJS: the catalogue's
// manifest is meant to name an exact version per game (ADR-0068 §2), and a range would make "which
// engine did this build use" a question about the day rather than about the lockfile.
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
export default defineConfig({
  root: 'app',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
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
});

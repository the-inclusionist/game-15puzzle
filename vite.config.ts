// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE IS A LINKED DEPENDENCY ============================
// `file:../SP-the-inclusionist-tracer` makes npm symlink the engine into node_modules under the
// DEPENDENCY KEY, not under the package's own `name` — so the name in package.json is the one that
// has to be right. It is `@the-inclusionist/engine` (ADR-0071); the chess consumer still asks for
// `@pm-monte/inclusionist-engine` and works only by accident of that mechanism.
//
// ⚠️ AND THE ENGINE NOW SHIPS A BUILT PACKAGE, WHICH CHANGES WHAT THIS FILE HAS TO DO. Its `exports`
// map used to point at raw `.ts`; since the package build (`tsc -p tsconfig.pkg.json`, run by its
// own `prepare` hook) it points at `dist-pkg/*.js` with `.d.ts` beside each one. So the import
// specifier a game writes is `@the-inclusionist/engine/core/contract.js` — the `.js` is part of the
// subpath pattern, and `core/contract.ts` resolves to NOTHING with an error that names conditions
// rather than the missing extension.
//
// What that leaves this config doing: `exclude` keeps esbuild's pre-bundler off the linked package,
// so its emitted modules go through the normal transform pipeline rather than being pre-bundled
// from a symlink whose contents are rebuilt by `npm install`. Stated rather than relied upon.
//
// ⚠️ THE EXCLUDE STRING MUST MATCH THE DEPENDENCY KEY EXACTLY. A stale name matches nothing and
// emits no warning — Vite simply stops excluding, silently.
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

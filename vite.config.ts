// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE IS A LINKED DEPENDENCY ============================
// `file:../SP-the-inclusionist-tracer` makes npm symlink the engine into node_modules under the
// DEPENDENCY KEY, not under the package's own `name`. Three settings make raw-`.ts` exports work
// through that symlink, and each does a different job:
//
//  · `optimizeDeps.exclude` here — keeps esbuild's pre-bundler away from the linked package, so
//    `@the-inclusionist/engine/core/contract.ts` reaches Vite's own TS transform instead of being
//    pre-bundled as though it were published JavaScript.
//  · `allowImportingTsExtensions` in tsconfig — the exports map's targets end in `.ts` and every
//    import site writes `.ts` explicitly. Only legal alongside `noEmit`, which is why the build is
//    Vite's job and never `tsc`'s.
//  · `moduleResolution: "bundler"` — the only mode that reads the exports map (including the
//    `./core/*` wildcard) AND tolerates extensioned specifiers.
//
// ⚠️ THE EXCLUDE STRING MUST MATCH THE DEPENDENCY KEY EXACTLY. A stale name matches nothing and
// emits no warning — Vite would simply stop excluding, silently. Chess carries exactly that defect
// in the opposite direction (its package.json still says `@pm-monte/inclusionist-engine`).
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

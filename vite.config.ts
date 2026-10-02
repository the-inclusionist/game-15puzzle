// SPDX-License-Identifier: AGPL-3.0-or-later
// Vite config, built on the engine's `defineGameBuild` wrapper (ADR-0253).
//
// ========================= THE SURFACE ONE DECLARATION BUYS =========================
// `defineGameBuild({ cartridge, config })` turns a single file into two targets:
//
//   · `vite build`                   → the APP (the game's config, PWA included, engine bundled)
//   · `vite build --mode cartridge`  → the CARTRIDGE (external engine/Pixi, no PWA, no public/,
//                                      types emitted, `dist-lib/cartridge.js` and its `.d.ts`)
//
// All the sharp edges earlier commits had to spell out are now the engine's: the engine, PixiJS and
// Zdog are matched by prefix as `external` (an exact string externalises the bare name and silently
// inlines every subpath — this game measured 35 kB turn into 74.5 kB from that trap); no `public/`
// in the cartridge (the OLD lib build shipped `app/public/fonts/` for the same reason); no service
// worker (the cartridge must not install a second one on the platform's origin); types emitted for
// the one entry.
//
// Engine 11 renamed the lib mode from `lib` to `cartridge`; the `package.json` script moves too.
//
// ========================= WHAT THIS FILE STILL OWNS =========================
// The APP's shape: the game's root, its plugins (VitePWA, with the game's own manifest and workbox
// settings), its `optimizeDeps`, its `test` field for Vitest. `defineGameBuild` reads them all and
// returns them UNCHANGED for every mode but `cartridge` (ADR-0140 §3: the standalone build is the
// game's; the cartridge is the platform's input).
//
// ⚠️ `uses: { neuralVoice }` NOW SKIPS Workbox's 2 MB limit SILENTLY — the voice is on the engine's
// side of the delivery (served from `heavy/`) and `inclusionist-heavy dist` writes it there at build
// time. The old `globIgnores: ['**/ort-wasm*']` is no longer necessary and goes.

import { defineConfig } from 'vitest/config';          // not 'vite': `test` is Vitest's field
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';
import { defineGameBuild } from '@the-inclusionist/engine/build';

const PWA = VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,txt}'],
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

export default defineGameBuild({
  // ⚠️ RELATIVE TO THE GAME'S ROOT (package.json), not to Vite's `root: 'app'`. The engine's
  // scripts/game-build resolves this with `process.cwd()`, which is where `npm run build:cartridge`
  // runs — so the path is `app/js/cartridge.ts`, not `js/cartridge.ts`.
  cartridge: 'app/js/cartridge.ts',
  config: defineConfig({
    root: 'app',
    plugins: [PWA],
    optimizeDeps: {
      // The engine is a large ESM package Vite would otherwise pre-bundle into one blob, making a
      // stack trace inside it unreadable. `include: ['pixi.js']` lets Pixi stay pre-bundled.
      exclude: ['@the-inclusionist/engine'],
      include: ['pixi.js'],
    },

    test: {
      projects: [
        {
          test: {
            name: 'node',
            root: import.meta.dirname,
            environment: 'node',
            include: ['tests/**/*.node.test.ts'],
          },
        },
        {
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
  }),
});

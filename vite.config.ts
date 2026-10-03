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

/**
 * THE SUBPATH THE ROUTER WORKER SERVES THIS GAME FROM (ADR-0117, Cloudflare orientation).
 *
 * `o-inclusionista.jrocha.dev.br/game-15-puzzle/*` — one origin per catalogue so the 1,2 GiB of
 * `heavy/` cache (`incl-pesados-v2`) is downloaded ONCE per child, not once per game. On the CF
 * Pages build the environment carries `INCL_BASE = "/game-15-puzzle/"`; locally, without it, the
 * build goes to `dist/` cru for `vite preview` to open at the root.
 *
 * ⚠️ `build.outDir` MOVES WITH THE BASE. The subpath has to be baked into the folder structure of
 * `dist/` because `wrangler.toml` points `pages_build_output_dir` at the subdirectory, and the
 * assets inside carry the base-prefixed paths that match. A single `dist/` with subpath-prefixed
 * references and a Pages root at `dist/` would ship the HTML at the wrong origin path.
 */
const INCL_BASE = process.env.INCL_BASE || '/';
const OUT_SUBDIR = INCL_BASE.replace(/^\/+|\/+$/g, '');          // 'game-15-puzzle' or ''
const OUT_DIR = OUT_SUBDIR ? `../dist/${OUT_SUBDIR}` : '../dist';

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
    base: INCL_BASE,
    build: { outDir: OUT_DIR, emptyOutDir: true, target: 'es2022' },
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

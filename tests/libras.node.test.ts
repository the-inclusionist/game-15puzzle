// SPDX-License-Identifier: AGPL-3.0-or-later
// Libras — now a NEGATIVE assertion: this game mounts no VLibras widget.
//
// ========================= WHY THIS TEST STILL EXISTS =========================
// Through engines 8–10 this file gated THREE pieces of wiring that could silently vanish and leave
// a deaf child's experience broken without anything else noticing: the four `[vw]` hooks the gov.br
// plugin needs, `setVlibrasSay(vlibrasSay)` so announcements reached the interpreter, and `vlTick()`
// so the mode state restored from storage was reconciled on every frame.
//
// ⚠️ ENGINE 11 REMOVED `setVlibrasSay`, `vlibrasSay` AND `vlTick` from `core/a11y-sr` and
// `ui/vlibras` (step 11f). Deaf mode is now `engine.deafMode`, and the sign-language interpreter
// arrives through `host.interpreter`. The gov.br widget stopped being the game's thing to mount
// because the engine no longer exposes a seam for it.
//
// This file flips: it now ASSERTS THE ABSENCE. If somebody wires VLibras back in without wiring
// `host.interpreter` first, the gate catches it. The old positive assertions were preserved as
// comments inside the removed code, where a mutation would still have to re-add the wiring to
// reintroduce the bug — so the symmetry is intact.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const html = readFileSync(join(root, 'app', 'index.html'), 'utf8');
/**
 * ⚠️ COMMENTS STRIPPED BEFORE MATCHING. A note explaining «`vlTick()` is gone» contains the string
 * `vlTick`, and a sieve measuring prose would read the obituary as the ghost. Taught once by the
 * libras gate's earlier draft against the same symbol, and taught again by the `cartridge-rules`
 * gate against `createGame` in its own comment.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const shell = stripComments(readFileSync(join(root, 'app', 'js', 'boot', 'standalone.ts'), 'utf8'));
const cartridge = stripComments(readFileSync(join(root, 'app', 'js', 'cartridge.ts'), 'utf8'));
const indexCode = html.replace(/<!--[\s\S]*?-->/g, '');

describe('this game no longer mounts the VLibras widget (engine 11, step 11f)', () => {
  it('loads no plugin script from vlibras.gov.br', () => {
    expect(indexCode).not.toMatch(/vlibras\.gov\.br/);
    expect(indexCode).not.toMatch(/VLibras/);
  });

  it('carries none of the four attribute hooks the plugin would look for', () => {
    for (const attr of ['vw', 'vw-access-button', 'vw-plugin-wrapper', 'vw-plugin-top-wrapper']) {
      expect(indexCode, `${attr} is still in index.html`).not.toMatch(new RegExp(`\\b${attr}\\b`));
    }
  });

  it('calls no `setVlibrasSay` and no `vlTick` from the shell or the cartridge', () => {
    for (const src of [shell, cartridge]) {
      expect(src).not.toMatch(/\bsetVlibrasSay\b/);
      expect(src).not.toMatch(/\bvlibrasSay\b/);
      expect(src).not.toMatch(/\bvlTick\b/);
    }
  });
});

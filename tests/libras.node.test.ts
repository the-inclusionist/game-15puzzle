// SPDX-License-Identifier: AGPL-3.0-or-later
// Libras, as a wiring that cannot be removed quietly.
//
// ========================= WHY THIS IS A GATE AND NOT A COMMENT =========================
// The Libras path is made of four pieces that live in three files and never import one another: the
// engine mounts the bar button and wires it to `toggleLibras` itself; `app/index.html` carries the
// four attribute hooks the gov.br plugin looks for and the plugin tag; `boot/main.ts` registers
// `vlibrasSay` into the announcer and ticks the module each frame.
//
// ⚠️ NOTHING FAILS IF ANY ONE OF THEM GOES. Delete the markup and the button still toggles, still
// says it is on, still persists the choice — and translates nothing. Drop `setVlibrasSay` and every
// announcement still reaches the live region, so a screen-reader run stays perfectly green while the
// interpreter is handed no text at all. Drop `vlTick` and only the RETURNING user is broken. Each of
// the three is invisible to every other test in this repository, and the person who finds out is a
// deaf child who cannot report it, because from her side the feature simply does not work.
//
// So the gate reads the files. It is a blunt instrument and it is the right one here: what it pins is
// exactly that these lines have not disappeared.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
// Same reason as `code()` below, one file earlier: the markup is explained by a long comment that
// names the very hooks being asserted, so the comment has to go before anything is measured.
const html = readFileSync(join(root, 'app', 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

/**
 * ⚠️ THE COMMENTS ARE STRIPPED, AND THE FIRST VERSION OF THIS FILE PROVES WHY.
 *
 * The `vlTick` assertion below was written against the raw source, and a mutation that DELETED the
 * call left it green — because the comment beside the call explains why `vlTick()` matters and
 * contains the string `vlTick()`. The gate was reading the justification for the line instead of the
 * line. A test whose subject can be satisfied by prose about the subject is not a test.
 *
 * Block comments and whole-line comments go; a trailing `// …` on a line of code stays, which is
 * enough here and is said rather than implied — every subject below is a statement of its own.
 */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const boot = code(readFileSync(join(root, 'app', 'js', 'boot', 'main.ts'), 'utf8'));

describe('the interpreter has somewhere to mount', () => {
  // The plugin finds its home by ATTRIBUTE, not by class or id, and all four have to be there: it
  // walks `[vw]` for the root, `[vw-access-button]` for the control it re-parents, and the wrapper
  // pair for where the panel would dock.
  it('carries the four hooks the gov.br plugin looks for', () => {
    // As ATTRIBUTES, not as substrings: `toContain('vw')` is satisfied by the word `vw-access-button`
    // and by any stray `vw` anywhere, which would make the first of the four assert nothing.
    for (const attr of ['vw', 'vw-access-button', 'vw-plugin-wrapper']) {
      expect(html, `the ${attr} attribute is missing from index.html`).toMatch(
        new RegExp(`<div[^>]*\\s${attr}(\\s|>|=)`),
      );
    }
    expect(html, 'the top wrapper is missing').toMatch(/class="vw-plugin-top-wrapper"/);
  });

  it('loads the plugin from the government address and survives it being down', () => {
    expect(html).toContain('https://vlibras.gov.br/app/vlibras-plugin.js');
    // ⚠️ THE `try` IS THE LOAD-BEARING PART. This is the only network-required thing on the page, and
    // a school without a link must still get a game. An uncaught `new VLibras.Widget(...)` against a
    // plugin that never arrived throws during parse and takes nothing else with it — but the warning
    // is the difference between a known limit and a mystery.
    expect(html).toMatch(/try\s*\{[^}]*VLibras\.Widget/);
  });

  // ⚠️ NOT A STYLE PREFERENCE. The engine used to read the panel's open state from this block's
  // geometry; the plugin re-parented itself onto `<body>`, the block became 747x0, and the detector
  // answered "open" for ever — the layout reserved 380px for an absent interpreter and pushed the
  // canvas to `left: -136`. Nothing in this repository may measure that block, and the cheapest way
  // to keep that true is to keep it out of the stylesheet entirely.
  it('is never given a size by this game', () => {
    const css = readFileSync(join(root, 'app', 'css', 'style.css'), 'utf8');
    expect(css).not.toMatch(/\[vw/);
  });
});

describe('the announcements reach the interpreter', () => {
  it('registers the Libras speaker into the announcer', () => {
    expect(boot).toContain('setVlibrasSay(vlibrasSay)');
  });

  // The one the engine's own doc comment calls decorative. `librasOpen` is restored from storage at
  // module load; `_vlOpen`, which is what `vlibrasSay` actually tests, starts false and is assigned
  // only inside `toggleLibras`. Without this call a child who left Libras on yesterday returns to a
  // mode that reads as ON and a translator that is mute.
  it('reconciles the restored mode each frame, which is what the returning user depends on', () => {
    expect(boot).toContain('vlTick()');
  });
});

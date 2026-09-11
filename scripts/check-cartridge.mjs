// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0140's second gate, on the artifact rather than on the config.
//
// ========================= WHY THIS CANNOT BE A UNIT TEST =========================
// The property is about BUILD OUTPUT: «the lib build's output contains no import of the engine's file
// contents — only a bare `@the-inclusionist/engine` specifier». A test that ran before the build
// would be measuring a file from the last run, and one that skipped when `dist-lib/` was absent would
// report success by measuring nothing. So it runs immediately after `vite build --mode lib`, in the
// same npm script, and fails the script.
//
// ⚠️ WHAT IT IS ACTUALLY PROTECTING. `external` in a Vite config is easy to get subtly wrong — an
// exact string `'@the-inclusionist/engine'` externalises the bare specifier and silently INLINES
// every subpath, and every import in this repository is a subpath. The visible symptom would be a
// 36 kB cartridge becoming a 600 kB one, which nobody measures on a file nobody opens, and the real
// symptom would arrive much later: the platform shipping one engine per game, which is the entire
// arithmetic ADR-0117 exists for.

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'dist-lib', 'cartridge.js');
const BARE = [/^@the-inclusionist\/engine(\/|$)/, /^pixi\.js$/];
// A generous ceiling rather than a tight one: this exists to catch an engine or a renderer being
// inlined (hundreds of kB), not to police the game's own growth.
// ⚠️ 60 kB AND NOT 120, AND THE NUMBER WAS SET BY A MUTATION RATHER THAN BY TASTE. Swapping the
// config's `external` regex for the exact string `'@the-inclusionist/engine'` — the trap this file
// exists to catch — produced a 74.5 kB bundle with the engine inlined, and a 120 kB ceiling waved it
// through. The honest build is 35.4 kB.
const CEILING = 60 * 1024;

let failures = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); failures++; };

let source;
try {
  source = readFileSync(OUT, 'utf8');
} catch {
  console.error(`✗ ${OUT} is missing: run \`vite build --mode lib\` first`);
  process.exit(1);
}

const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]);
if (specifiers.length === 0) fail('no imports at all — the engine has been inlined, or this is not the lib build');

/**
 * ⚠️ THE POSITIVE HALF, AND WITHOUT IT THIS WHOLE FILE PASSED A BUNDLE WITH THE ENGINE INSIDE IT.
 *
 * The first draft only asserted that nothing UNEXPECTED was imported, which a bundle importing
 * nothing satisfies perfectly. Inlining the engine does not add a bad specifier — it REMOVES the good
 * ones. So the rule has to be stated in both directions: this cartridge uses the engine, therefore it
 * must say so out loud, at its edge, where a consumer can resolve it.
 */
if (!specifiers.some((s) => s.startsWith('@the-inclusionist/engine'))) {
  fail('the bundle imports the engine from nowhere — it has been inlined, which is the exact-string `external` trap');
}

for (const spec of new Set(specifiers)) {
  if (spec.startsWith('.') || spec.startsWith('/')) {
    fail(`relative import survived bundling: ${spec}`);
  } else if (!BARE.some((re) => re.test(spec))) {
    fail(`unexpected external: ${spec} — a cartridge may only require the engine and the shared renderer`);
  }
}

// ⚠️ ADR-0139's SINGLE-CALL RULE, ASSERTED ON THE SHIPPED BYTES and not only on the source. A
// cartridge that called `createGame` would mount a second accessibility stack inside the platform.
for (const forbidden of ['createGame', 'startLoop']) {
  if (new RegExp(`\\b${forbidden}\\b`).test(source)) fail(`the cartridge bundle names ${forbidden}`);
}

// And the delivery rule of ADR-0117: a cartridge declares no voice, no font and no heavy runtime.
for (const forbidden of ['piper-tts-web', 'onnxruntime', 'vlibras', 'huggingface']) {
  if (source.includes(forbidden)) fail(`the cartridge bundle carries a delivery concern: ${forbidden}`);
}

const bytes = statSync(OUT).size;
if (bytes > CEILING) fail(`the cartridge is ${(bytes / 1024).toFixed(1)} kB, over the ${CEILING / 1024} kB ceiling — something large was inlined`);

if (failures) {
  console.error(`\n✗ cartridge: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`✓ cartridge: ${(bytes / 1024).toFixed(1)} kB, importing only ${[...new Set(specifiers)].length} bare specifiers.`);

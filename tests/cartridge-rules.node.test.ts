// SPDX-License-Identifier: AGPL-3.0-or-later
// Two rules this game already keeps, pinned so that keeping them stops depending on memory.
//
// ========================= WHY GATE WHAT IS ALREADY TRUE =========================
// ADR-0141 forbids a cartridge from importing `rnd`, `randInt`, `shuffle` or `reseed` from the
// engine's `core/rng`, and ADR-0139 forbids module-level mutable state. This repository satisfies
// both today, and the temptation is to leave them as habits.
//
// ⚠️ THE RECORD ANSWERS THAT DIRECTLY, AND IT IS THE WHOLE REASON THIS FILE EXISTS. ADR-0141 §3:
// «é necessário precisamente porque o defeito é invisível onde os testes correm: um build autónomo
// tem uma corrente e passa de qualquer maneira». One game on one page cannot collide with anything.
// Every test in this repository would stay green through a regression, and the failure would first
// appear inside a platform, in another game, as a shuffle that changes depending on what the child
// opened first. The engine's own user story is the sentence being protected: «I want the engine to
// carry no game state, so that two games on one page do not collide».
//
// The same holds for the `let`: state at module scope survives a `teardown()` and leaks into the next
// game instantiated on the same document. Neither defect can be caught by playing this game.
//
// 📌 The forbidden-import rule is meant to live in the organisation's reusable workflow so six
// repositories inherit it rather than copy it (ADR-0141 §3). This is the local copy until it does,
// and it costs four lines to delete on the day it arrives.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Anchored on this file rather than on a repository name: renaming the repository once blinded
// thirty-six gates here without turning any of them red, and a path relative to the test survives it.
const SRC = join(import.meta.dirname, '..', 'app', 'js');

/**
 * ⚠️ NOT A GLOB. `app/js/**` + `*.ts` drops the files sitting at the root of a directory in more than
 * one tool, and a pattern that matches nothing reports success — the gate would pass by measuring an
 * empty set. A walk cannot silently return fewer files than exist, and the count is asserted below.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Block comments and whole-line comments, gone. See `tests/libras.node.test.ts` for the bug that
 *  taught this file the lesson: an assertion satisfied by the prose ABOUT the code is not a test. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const files = walk(SRC).map((path) => ({ path, src: code(readFileSync(path, 'utf8')) }));

describe('the rules a standalone build cannot enforce for itself', () => {
  it('is looking at the whole of app/js, including the files at each directory root', () => {
    expect(files.length).toBeGreaterThan(15);
    expect(files.map((f) => f.path)).toContain(join(SRC, 'boot', 'standalone.ts'));
    expect(files.map((f) => f.path)).toContain(join(SRC, 'cartridge.ts'));
  });

  // ADR-0141. The engine exports `createRng`, an independent stream, right beside four helpers bound
  // to a shared module-level one. The wrong import is one word shorter than the right one.
  it('never draws from the engine`s shared random stream', () => {
    const offenders = files.filter(({ src }) => {
      const imports = src.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*core\/rng[^'"]*['"]/g) ?? [];
      return imports.some((i) => /\b(rnd|randInt|shuffle|reseed)\b/.test(i));
    });
    expect(offenders.map((f) => f.path), 'these reach the shared stream').toEqual([]);
  });

  // ⚠️ THE PROJECT'S OWN `shuffle` IS NOT THE ENGINE'S, and the check above must not confuse them:
  // `app/js/puzzle/shuffle.ts` takes an `Rng` and holds nothing. Asserted so that a future tightening
  // of the rule above cannot start failing on the game's own module and be "fixed" by renaming it.
  it('keeps its own shuffle, which takes a generator instead of reaching for one', () => {
    const own = readFileSync(join(SRC, 'puzzle', 'shuffle.ts'), 'utf8');
    expect(own).not.toMatch(/from\s*['"][^'"]*core\/rng/);
  });

  /**
   * ⚠️ ADR-0139's SECOND GATE, WORD FOR WORD: «grep for `createGame` inside a cartridge's own source
   * returns nothing». And two more of the same family, because they are the same rule about who owns
   * the page: `startLoop` (six cartridges each opening a frame callback is six loops fighting over
   * one frame) and `location` (one address serves every cartridge, so reading the query string reads
   * another game's parameters — and this game takes `?seed=`).
   *
   * The SHELL is exempt and named rather than excluded by pattern: it is the file whose entire job is
   * to be the page, so a rule that hid it by wildcard would hide the next file that drifted into
   * doing the same thing.
   */
  it('leaves the page to the shell — no createGame, no startLoop, no location', () => {
    const shell = join(SRC, 'boot', 'standalone.ts');
    const offenders = files
      .filter((f) => f.path !== shell)
      .map(({ path, src }) => ({
        path,
        hits: [/createGame/, /startLoop/, /location\s*\.\s*search/]
          .filter((re) => re.test(src)).map(String),
      }))
      .filter((f) => f.hits.length > 0);
    expect(offenders.map((f) => `${f.path}: ${f.hits.join(' ')}`), 'the page is not theirs').toEqual([]);
  });

  // ADR-0139 / spec D14. Column zero is how this codebase spells module scope: everything inside a
  // function is indented, and the convention is stated in the first line of cartridge.ts.
  it('holds no mutable state at module scope', () => {
    const offenders = files
      .map(({ path, src }) => ({ path, hits: src.match(/^(?:export\s+)?(?:let|var)\s+\w+/gm) ?? [] }))
      .filter((f) => f.hits.length > 0);
    expect(offenders.map((f) => `${f.path}: ${f.hits.join(', ')}`), 'module-level state').toEqual([]);
  });
});

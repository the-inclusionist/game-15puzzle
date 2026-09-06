// SPDX-License-Identifier: AGPL-3.0-or-later
// The licence, as something checkable rather than something asserted.
//
// ========================= WHY SECTION 13 GETS A GATE OF ITS OWN =========================
// Section 13 is the ENTIRE reason this project is AGPL and not GPL (ADR-0064): running a service is
// not distributing, so under GPL a supplier could take this code, improve it, host it for schools,
// and owe the improvement to nobody. Section 13 closes that — and it creates an obligation that,
// until this repository, nothing in the ecosystem discharged. A grep for `github.com` or
// `gitlab.com` across the engine's `app/` or the chess consumer's returns nothing at all.
//
// An obligation with no gate is a comment. This is the gate: the offer is in the interface, it
// points where the source actually is, and the two places that name the licence agree.
//
// ⚠️ THE LINK RESOLVES TO A PRIVATE REPOSITORY UNTIL THE ATO. That is a limit of the process and not
// of the implementation — the offer is in place and becomes effective on the day the Município
// authorises publication (ADR-0066 §3). Recorded in docs/LICENSES.md rather than left as a promise
// nobody wrote down.

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_URL } from '../app/js/ui/hud.ts';
import { catalogs } from '../app/js/i18n/index.ts';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string; license: string; repository: { url: string };
};

/**
 * Where this working copy actually came from, read out of `.git/config`.
 *
 * ⚠️ THIS IS THE ANCHOR, AND THE GATE HAD NONE UNTIL A RENAME PROVED IT. When the repository was
 * renamed from `pixi-15-puzzle` to `game-15puzzle`, every check below still passed: `SOURCE_URL` and
 * `package.json` agreed with each other, and GitHub redirects an old name, so the offer pointed at a
 * repository that no longer had that name and NOTHING said so. Internal consistency is not the same
 * property as being right, and a gate that only checks two files against each other is a gate that
 * goes green when both are wrong together.
 *
 * The remote is the one statement of the fact that does not live in a file somebody edits by hand.
 * Read from `.git/config` rather than by spawning git, so this stays a pure node test — and it
 * THROWS when there is no checkout, because a gate that skips itself is a gate that stopped running.
 */
function remoteUrl(): string {
  const config = readFileSync(join(root, '.git', 'config'), 'utf8');
  const match = config.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
  if (!match) throw new Error('no origin remote in .git/config: the source offer has nothing to be checked against');
  return match[1].replace(/\.git$/, '');
}

async function sourceFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await sourceFiles(path, out);
    else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('the licence is stated in two places that agree', () => {
  // ADR-0064's own confirmation: "two places, one string, mechanically comparable".
  it('says AGPL-3.0-or-later in package.json and carries the FSF text in LICENSE', () => {
    expect(pkg.license).toBe('AGPL-3.0-or-later');
    const licence = readFileSync(join(root, 'LICENSE'), 'utf8');
    expect(licence).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    expect(licence).toContain('Version 3, 19 November 2007');
  });

  // ⚠️ THE TEMPLATE IS LEFT BLANK ON PURPOSE, and this pins the decision so a later tidy-up cannot
  // quietly fill it in. Publication under AGPL is a PEDIDO to the Poder Executivo (requerimento item
  // 39, alínea e) and not the developer's call, so nothing here claims a holder the ato has not yet
  // named. Ownership is asserted in docs/LICENSES.md, where somebody who intends to USE the code
  // reads it.
  it('leaves the copyright holder unnamed, as the engine and the chess consumer do', () => {
    const licence = readFileSync(join(root, 'LICENSE'), 'utf8');
    expect(licence).toContain('Copyright (C) <year>  <name of author>');
    expect(licence).not.toMatch(/Prefeitura|Munic[ií]pio de/);
  });

  it('asserts the ownership in docs/LICENSES.md instead, with the law that creates it', () => {
    const doc = readFileSync(join(root, 'docs', 'LICENSES.md'), 'utf8');
    expect(doc).toContain('MUNICÍPIO');
    expect(doc).toContain('9.609');
    expect(doc).toContain('pedido');
  });
});

describe('every source file carries SPDX, and no copyright line', () => {
  it('opens each .ts with the identifier', async () => {
    const files = [
      ...await sourceFiles(join(root, 'app', 'js')),
      ...await sourceFiles(join(root, 'tests')),
    ];
    expect(files.length).toBeGreaterThan(15);
    for (const file of files) {
      const first = readFileSync(file, 'utf8').split('\n')[0];
      expect(first, file).toBe('// SPDX-License-Identifier: AGPL-3.0-or-later');
    }
  });

  it('and carries no copyright holder in code, which is the same decision as the LICENSE', async () => {
    for (const file of await sourceFiles(join(root, 'app', 'js'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/Copyright \(c\)|Copyright \(C\) 20|©/);
    }
  });
});

describe('the section 13 source offer', () => {
  it('points at the repository this code is actually in', () => {
    // Three statements of one fact now, not two: the link a person clicks, the machine-readable
    // field, and the remote this checkout came from. The third is what a rename cannot fool.
    expect(SOURCE_URL).toBe(remoteUrl());
    expect(pkg.repository.url).toContain(SOURCE_URL.replace('https://', ''));
  });

  it('is named the same way the package is, so the two cannot drift apart', () => {
    // `@the-inclusionist/<repo>` — the shape `game-chess` and `game-zdog-whackwhack` already use.
    expect(pkg.name).toBe(`@the-inclusionist/${SOURCE_URL.split('/').pop()}`);
  });

  it('is over https and names a host, so it is an offer and not a placeholder', () => {
    const url = new URL(SOURCE_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('github.com');
    expect(url.pathname.split('/').filter(Boolean)).toHaveLength(2);
  });

  it('is sayable in all three languages the game speaks', () => {
    for (const code of ['pt', 'en', 'es'] as const) {
      expect(catalogs[code].strings['legal.source'].trim(), code).not.toBe('');
      expect(catalogs[code].strings['legal.licence'], code).toContain('AGPL');
    }
  });

  it('is built into the panel rather than living only in a file', () => {
    const hud = readFileSync(join(root, 'app', 'js', 'ui', 'hud.ts'), 'utf8');
    expect(hud).toContain("sourceLink.href = SOURCE_URL");
    // A link that opens a new tab without `noopener` hands the opened page a handle on this one.
    expect(hud).toContain("rel = 'noopener noreferrer'");
    expect(hud).toContain("legal.source");
  });
});

describe('ADR-0037 — no configurable address for a room', () => {
  // The prohibition is on a CONFIGURABLE ROOM ADDRESS: an environment variable, a settings field, a
  // build flag, an endpoint reached at runtime. A static source link is none of those, and this game
  // fetches nothing off-origin. The check is here so that stays true by accident of nobody noticing.
  it('reaches no network host at runtime beyond the static source link', async () => {
    for (const file of await sourceFiles(join(root, 'app', 'js'))) {
      const source = readFileSync(file, 'utf8');
      const urls = source.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
      for (const url of urls) {
        const allowed = url.startsWith(SOURCE_URL) || url.startsWith('http://localhost');
        expect(allowed, `${file} reaches ${url}`).toBe(true);
      }
      expect(source, file).not.toMatch(/import\.meta\.env\.[A-Z_]*(URL|HOST|SERVER|ROOM)/);
    }
  });
});

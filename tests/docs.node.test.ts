// SPDX-License-Identifier: AGPL-3.0-or-later
// The prose is checked against the manifest, because a duplicated fact rots.
//
// ========================= THE DEFECT THAT ASKED FOR THIS =========================
// The engine went from 7.0.1 to 8.0.0 and `README.md` went on saying «pinned exact at 7.0.1» for the
// whole of the upgrade. Nothing failed. Every test passed, the build was green, and the one sentence
// a newcomer reads to learn which engine this game is built against named a version the lockfile had
// not held for weeks. `docs/LICENSES.md` said the same thing in its own table.
//
// ⚠️ AND THE ROT IS ASYMMETRIC, which is why a gate is worth more here than care is. Code that names
// a stale version stops compiling; prose that names one keeps rendering perfectly and simply lies.
// The people it lies to are exactly the people who cannot check it — whoever is arriving.
//
// THE INVARIANT, and it is deliberately not "the docs must mention every dependency": prose gets to
// choose what it talks about. What it does not get to do is name a version this repository does not
// install. So: every `x.y.z` written in a document must be a version `package.json` actually
// declares. That is enough to catch the failure above, and it never argues with an author about
// which dependencies deserve a paragraph.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

// `^4.0.0` and `4.0.0` are the same claim as far as a sentence is concerned; the range operator is a
// resolution detail and nobody writes it in prose.
const declared = new Set(
  [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]
    .map((range) => range.replace(/^[\^~>=<\s]+/, '')),
);

const DOCS = ['README.md', join('docs', 'LICENSES.md')];

describe('the documents name only versions this repository installs', () => {
  for (const doc of DOCS) {
    it(`${doc} states no version package.json does not declare`, () => {
      const text = readFileSync(join(root, doc), 'utf8');
      // Three-part versions only. A two-part number is a licence ("SIL OFL 1.1", "AGPL-3.0"), a
      // resolution ("320x180" is not even this shape), or a section, and none of those is a claim
      // about what is installed.
      const found = [...new Set(text.match(/\b\d+\.\d+\.\d+\b/g) ?? [])];
      const strangers = found.filter((v) => !declared.has(v));
      expect(strangers, `${doc} names ${strangers.join(', ')}, which package.json does not declare`)
        .toEqual([]);
    });
  }

  // The other half, and it is the one the upgrade actually needed: the engine is the single most
  // important version in this repository, and both documents are supposed to say which one.
  it('both documents name the engine version that is installed', () => {
    const engine = pkg.dependencies['@the-inclusionist/engine'];
    expect(engine, 'the engine is not in dependencies at all').toBeTruthy();
    for (const doc of DOCS) {
      expect(readFileSync(join(root, doc), 'utf8'), `${doc} does not name engine ${engine}`)
        .toContain(engine);
    }
  });
});

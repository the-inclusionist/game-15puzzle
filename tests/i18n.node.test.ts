// SPDX-License-Identifier: AGPL-3.0-or-later
// Pillar 3 of ADR-0010 is "zero hardcoded strings" and a floor of three languages. A locale that is
// half-written does not fail — it silently degrades to Portuguese, which is the right behaviour and
// the wrong thing to ship unnoticed. These are the checks that notice.

import { describe, expect, it } from 'vitest';
import { catalogs, createI18n } from '../app/js/i18n/index.ts';
import { speakableProblems } from '@the-inclusionist/engine/core/contract.js';
import type { LocaleCode } from '../app/js/i18n/types.ts';

const CODES: LocaleCode[] = ['pt', 'en', 'es'];
const i18n = createI18n(null);

/** Every {param} a string asks for. A frame that loses one prints the brace to the child. */
const params = (s: string): string[] => (s.match(/\{[a-z]+\}/gi) ?? []).sort();

describe('the three catalogues', () => {
  it('carry exactly the same key set', () => {
    const base = Object.keys(catalogs.pt.strings).sort();
    for (const code of CODES) expect(Object.keys(catalogs[code].strings).sort(), code).toEqual(base);
  });

  it('has no empty value anywhere — an empty string is a reader falling silent', () => {
    for (const code of CODES) {
      for (const [key, value] of Object.entries(catalogs[code].strings)) {
        expect(value.trim(), `${code}:${key}`).not.toBe('');
      }
    }
  });

  // The defect this catches is specific and quiet: a translator drops {need} from one string, the
  // sentence still reads, and the number simply never appears.
  it('asks for the same parameters in every language', () => {
    for (const [key, value] of Object.entries(catalogs.pt.strings)) {
      for (const code of CODES) expect(params(catalogs[code].strings[key]), `${code}:${key}`).toEqual(params(value));
    }
  });

  it('gives every noun a gender the engine will accept', () => {
    for (const code of CODES) {
      for (const noun of [catalogs[code].tile, catalogs[code].blank, catalogs[code].objective]) {
        expect(speakableProblems(noun), `${code}: ${noun.text}`).toEqual([]);
      }
    }
  });

  it('keeps the number in the tile pattern, whatever the order', () => {
    for (const code of CODES) {
      expect(catalogs[code].tileNamePattern, code).toContain('{number}');
      expect(catalogs[code].tileNamePattern, code).toContain('{noun}');
    }
  });
});

describe('createI18n', () => {
  it('registers the keys into the ENGINE, so one t() answers for both', () => {
    // If this resolved to the key itself, registerDict never ran — which is the whole point of
    // using the engine's dictionary rather than a private one.
    expect(i18n.t('hud.shuffle')).not.toBe('hud.shuffle');
    expect(i18n.t('hud.shuffle')).toBe(catalogs.pt.strings['hud.shuffle']);
  });

  it('still answers an ENGINE key, which a private catalogue could not', () => {
    expect(i18n.t('i18n.nome')).not.toBe('');
  });

  it('returns a key it has never heard of unchanged, rather than empty', () => {
    expect(i18n.t('nothing.like.this')).toBe('nothing.like.this');
  });

  it('names a tile as a well-formed Speakable', () => {
    const seven = i18n.describeTile(7);
    expect(speakableProblems(seven)).toEqual([]);
    expect(seven.text).toContain('7');
    expect(seven.gender).toBe('f');          // "peça" is feminine, and the frames agree with it
  });

  it('names the blank and the objective too — the blank is not an absence here', () => {
    expect(speakableProblems(i18n.describeBlank())).toEqual([]);
    expect(speakableProblems(i18n.describeObjective())).toEqual([]);
    expect(i18n.describeObjective().plural).toBe(true);
  });

  it('phrases a move as tile plus direction', () => {
    const phrase = i18n.describeMove({ tile: 7, from: 1, to: 0, direction: 'left' });
    expect(phrase).toContain('7');
    expect(phrase).toContain(catalogs.pt.strings['dir.left']);
  });

  it('interpolates the frame it is given', () => {
    expect(i18n.t('hud.progress', { have: 3, need: 15 })).toBe('3 de 15 no lugar');
  });

  it('reports pt-BR rather than bare pt, because the prosody differs', () => {
    expect(i18n.bcp47()).toBe('pt-BR');
  });

  it('survives having no window — it is the node project that proves the module is screen-free', () => {
    const stop = i18n.onChange(() => { throw new Error('never'); });
    expect(() => stop()).not.toThrow();
  });
});

describe('AGPL section 13', () => {
  // The offer has to be sayable in every language the game speaks; an English-only "Source code"
  // link in a Portuguese interface is an offer a child cannot read.
  it('names the source offer in all three languages', () => {
    for (const code of CODES) {
      expect(catalogs[code].strings['legal.source'].trim(), code).not.toBe('');
      expect(catalogs[code].strings['legal.licence'], code).toContain('AGPL');
    }
  });
});

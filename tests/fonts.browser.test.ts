// SPDX-License-Identifier: AGPL-3.0-or-later
// The vendored typeface, and whether it can actually draw the words this game shows.
//
// ========================= WHY THE OBVIOUS CHECKS ARE USELESS =========================
// This gate is here because a sibling game in this ecosystem shipped its title in the WRONG typeface
// for four commits while every available check said it was right. The vendored file was the
// cyrillic-ext subset: a valid woff2, correctly declared, correctly loaded, containing not one Latin
// letter. Google Fonts serves this family as several files ordered by `unicode-range` with latin
// LAST, and the vendoring took the first `src:` it found.
//
// What the page reported, live, with the wrong glyphs on screen:
//
//     document.fonts.check('16px "Press Start 2P"')   →  true
//     [...document.fonts].map(f => f.status)          →  ['loaded']
//     getComputedStyle(el).fontFamily                 →  '"Press Start 2P", monospace'
//
// All three are true and all three are worthless, because each compares the family NAME — a string
// written twice, once in the `@font-face` and once in the rule, by the same hand. Nothing there
// looks inside the file. And CSS font matching resolves PER CODEPOINT, so a face that loads but has
// no glyph for `U+0031` is skipped for that character in silence: no console error, no failed
// request, no `document.fonts` state that differs.
//
// ========================= WHAT MEASURES IT INSTEAD =========================
// The ADVANCE WIDTH of each character, which comes from the glyph and therefore from the file.
// Press Start 2P is monospaced at exactly 1em, so at 48px every character it can draw advances
// 48px. The fallback is `monospace`, which is also uniform — so uniformity alone is not enough, and
// the test also checks the advance EQUALS the font size, which the platform monospace does not.

import { beforeAll, describe, expect, it } from 'vitest';
// ⚠️ THE FILE ITSELF, BY URL, RATHER THAN THE STYLESHEET'S `@font-face`. The test project serves
// from the repository root and the app serves from `app/`, so `/fonts/...` means two different
// things in the two places — and chasing that with a `publicDir` override would leave the test
// asserting against a path the game does not use. Loading the BYTES and naming the face here tests
// the one thing that matters and cannot drift: what is inside the woff2.
import fontUrl from '../app/public/fonts/press-start-2p-400.woff2?url';
import { TITLE_MARK } from '../app/js/ui/title-screen.ts';
import { catalogs } from '../app/js/i18n/index.ts';

const FAMILY = 'Press Start 2P';
const SIZE = 48;

/** Every character the title screen can put on screen, in every language it speaks. */
const CHARACTERS = [...new Set([
  ...TITLE_MARK,
  ...catalogs.pt.strings['title.start'],
  ...catalogs.en.strings['title.start'],
  ...catalogs.es.strings['title.start'],
].filter((c) => c !== ' '))];

let measure: CanvasRenderingContext2D;

beforeAll(async () => {
  const face = new FontFace(FAMILY, `url(${fontUrl}) format('woff2')`);
  await face.load();
  document.fonts.add(face);
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  measure = canvas.getContext('2d')!;
});

const advance = (character: string, family: string): number => {
  measure.font = `${SIZE}px ${family}`;
  return measure.measureText(character).width;
};

describe('the vendored Press Start 2P', () => {
  it('is loaded at all — necessary, and on its own worth nothing', () => {
    expect(document.fonts.check(`${SIZE}px "${FAMILY}"`)).toBe(true);
  });

  // ⚠️ THIS is the check that would have caught the cyrillic subset. A missing glyph falls back for
  // that character alone, so a single wrong advance means a single wrong letter on screen.
  it('gives every character of the title the same 1em advance', () => {
    for (const character of CHARACTERS) {
      expect(advance(character, `"${FAMILY}"`), `${character} (U+${character.codePointAt(0)!.toString(16).toUpperCase()})`)
        .toBeCloseTo(SIZE, 0);
    }
  });

  // Uniformity alone would also be satisfied by falling through to the platform's monospace, which
  // is uniform and NOT 1em. Comparing against it is what separates "the face is being used" from
  // "something consistent is being used".
  it('does not simply agree with the fallback, which is what a missing face looks like', () => {
    const withFace = CHARACTERS.map((c) => advance(c, `"${FAMILY}", monospace`));
    const fallback = CHARACTERS.map((c) => advance(c, 'monospace'));
    expect(withFace).not.toEqual(fallback);
  });

  it('draws the whole mark at the width its layout assumes', () => {
    // Monospaced at 1em means the mark is exactly its character count wide. The title's own CSS
    // leans on that to stay inside a 320-logical-pixel screen.
    expect(advance(TITLE_MARK, `"${FAMILY}"`)).toBeCloseTo(TITLE_MARK.length * SIZE, 0);
  });
});

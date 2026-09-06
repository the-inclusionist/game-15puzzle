// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/index — this game's catalogues, registered INTO the engine's dictionary.
//
// ========================= WHY NOT A CATALOGUE OF OUR OWN =========================
// The chess consumer rolled its own `t()` because at the time there was no other option: the
// engine's locales are resolved at ITS build, against ITS folder, and `DICTS` is private — a game
// installed from a package has no way to put a file in there. The engine closed that with
// `registerDict()`, and this game is the first to use it. Two reasons it matters, and both are
// defects the chess consumer carries today:
//
//  · THE CHILD'S LANGUAGE IS SHARED. `pickDefault()` reads the `incl_lang` key that every
//    Inclusionist game writes, so a child who chose Spanish in another game gets Spanish here. A
//    private catalogue reads `navigator.language` instead and silently ignores her.
//  · TWO CATALOGUES MEANS TWO WRITERS OF `<html lang>` and a guaranteed drift — engine strings in
//    one language, game strings in another, on the same screen.
//
// ⚠️ `registerDict` deliberately does NOT re-apply the DOM, and it says why: `applyDom` needs a
// ROOT, and reaching the global document from underneath the caller is a defect the engine has
// already paid for once. So registration happens BEFORE `createGame()` calls `initI18n`, and the
// static markup is translated by that call. What JavaScript builds afterwards is rebuilt by
// whoever listens to `onChange` — which the chess consumer does not do, and which is why its HUD
// keeps the old language after a switch.

import { getLocale, registerDict, t as engineT, bcp47 as engineBcp47 } from '@the-inclusionist/engine/core/i18n.js';
import type { Speakable } from '@the-inclusionist/engine/core/contract.js';
import type { Catalog, LocaleCode } from './types.ts';
import type { Direction, Move } from '../puzzle/types.ts';
import pt from './pt.ts';
import en from './en.ts';
import es from './es.ts';

const CATALOGS: Readonly<Record<LocaleCode, Catalog>> = { pt, en, es };

export interface I18n {
  /** The engine's `t`, so engine strings and game strings resolve through one chain. */
  t(key: string, params?: Readonly<Record<string, string | number>>): string;
  locale(): LocaleCode;
  bcp47(): string;
  /** "peça 7" / "tile 7" / "ficha 7", with the gender the frames need. */
  describeTile(tile: number): Speakable;
  describeBlank(): Speakable;
  describeObjective(): Speakable;
  /** "peça 7 para a esquerda" — the phrase every announcement about a single tile is built from. */
  describeMove(move: Move): string;
  /**
   * The same, for a whole press: "peça 7 para a esquerda" or "três peças para a esquerda".
   *
   * One tile reads better without a number, and more than one has to carry it — "peças para a
   * esquerda" would be the same sentence for a press that moves two and a press that moves four.
   */
  describePush(push: readonly Move[]): string;
  direction(d: Direction): string;
  /**
   * Run `fn` whenever the language changes. Returns the unsubscribe.
   *
   * The engine dispatches `i18n:change` on the window after it has swapped the dictionary and
   * re-applied the static markup. Anything this game BUILT — the tile labels, the HUD — is not
   * static markup and has to rebuild itself here.
   */
  onChange(fn: () => void): () => void;
}

/**
 * Register the three catalogues and hand back the accessors.
 *
 * ⚠️ CALL THIS BEFORE `createGame()`. `createGame` runs `initI18n`, which translates the static
 * markup; keys registered after that point are correct in `t()` and stale in the DOM.
 */
export function createI18n(win: Window | null = typeof window === 'undefined' ? null : window): I18n {
  for (const code of Object.keys(CATALOGS) as LocaleCode[]) {
    registerDict(code, CATALOGS[code].strings);
  }

  const locale = (): LocaleCode => {
    const code = getLocale();
    return code === 'en' || code === 'es' ? code : 'pt';
  };
  const catalog = (): Catalog => CATALOGS[locale()];

  const named = (tile: number): Speakable => {
    const c = catalog();
    return {
      text: c.tileNamePattern.replace('{noun}', c.tile.text).replace('{number}', String(tile)),
      gender: c.tile.gender,
      plural: c.tile.plural,
    };
  };

  return {
    t: engineT,
    locale,
    bcp47: () => engineBcp47(locale()),
    describeTile: named,
    describeBlank: () => ({ ...catalog().blank }),
    describeObjective: () => ({ ...catalog().objective }),
    direction: (d: Direction) => engineT(`dir.${d}`),
    describeMove: (move: Move) =>
      engineT('a11y.move', { tile: named(move.tile).text, dir: engineT(`dir.${move.direction}`) }),
    describePush(push: readonly Move[]) {
      const first = push[0];
      if (!first) return '';
      const dir = engineT(`dir.${first.direction}`);
      return push.length === 1
        ? engineT('a11y.move', { tile: named(first.tile).text, dir })
        : engineT('a11y.moveMany', { count: push.length, dir });
    },
    onChange(fn) {
      if (!win) return () => { /* no window: nothing dispatches, nothing to unsubscribe */ };
      const handler = (): void => fn();
      win.addEventListener('i18n:change', handler);
      return () => win.removeEventListener('i18n:change', handler);
    },
  };
}

/** The catalogues themselves, for the test that pins the three key sets against each other. */
export const catalogs = CATALOGS;

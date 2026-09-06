// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/title-screen — the first thing anyone sees, and it is ONE control.
//
// ========================= "CLICK ANYWHERE" IS A BUTTON THAT FILLS THE SCREEN =========================
// The obvious build is a click handler on the region. It works for a mouse and for nobody else: a
// `div` that reacts to a click has no role, no accessible name, no keyboard path and no focus ring,
// so a screen reader announces nothing to press and a keyboard cannot press it (WCAG 2.1.1, 4.1.2).
//
// So the whole screen IS a `<button>`. Clicking anywhere works because "anywhere" is inside it;
// Enter and Space work because the platform gives them to every button; the accessible name is the
// title and the word Start together, which is exactly the sentence a listener needs; and the focus
// ring comes free and honours forced-colors.
//
// ========================= THE PULSE, AND THE TWO CRITERIA IT HAS TO CLEAR =========================
//  · WCAG 2.3.1 (Three Flashes). A 1.6-second opacity fade is not a flash by any reading — the
//    threshold is three per second, and this is well under one.
//  · WCAG 2.2.2 (Pause, Stop, Hide) is the one that actually needs an argument, and it has two.
//    First: the moving content ends the moment the user acts, and the ONLY action this screen
//    offers is the one that ends it — the whole screen is the stop button. Second, and the reason
//    the first is not leaned on alone: the pulse honours reduced motion, from the system preference
//    AND from the switch the game already owns, so someone who has said "no movement" once anywhere
//    never sees it. Both live in CSS as a `data-motion` attribute, not a media query, because a
//    media query would reach the system preference and not the switch.
//
// ========================= THE TYPEFACE STOPS HERE =========================
// Press Start 2P is a pixel face: fixed, decorative, and the opposite of what ADR-0012's roster is
// for. On a NAME, seen once, that is the right instrument — it is a logo. It must not reach the
// board's digits, which stay in whatever face the child chose, at whatever size she chose. The rule
// lives in the stylesheet as a single `.screen--title` scope, and `title-screen.browser` pins it.

import type { I18n } from '../i18n/index.ts';

/**
 * The game's name, and it is NOT translated.
 *
 * Pillar 3 wants zero hardcoded strings and this is the exception the rule already makes: a name is
 * not prose. "15-Puzzle" is what the thing is called in every locale, the way `PixiJS` is. What IS
 * translated is the word beside it and the button's accessible name.
 */
export const TITLE_MARK = '15-Puzzle!';

/**
 * The author's name. Not translated, and not a copyright line.
 *
 * ⚠️ IT DOES NOT CONTRADICT THE MISSING COPYRIGHT NOTICE, and the distinction is the whole reason
 * this comment exists: Lei nº 9.609/1998 art. 4º moves the PATRIMONIAL right to the employer, which
 * is why `LICENSE` names no holder and no source file carries one — `agpl-source-offer` pins that
 * absence. Lei nº 9.610/1998 art. 24, II is a different right: the MORAL right to be named as the
 * author, which is inalienable and is not the employer's to take. The Município owns the software;
 * the authorship is stated here. Both are true at once and docs/LICENSES.md says so.
 */
export const AUTHOR = 'prof. José Rocha';

export interface TitleScreenDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** Whether motion is reduced — the system preference OR the game's own switch. Read live. */
  reducedMotion(): boolean;
  /** Called once, when the player starts. */
  onStart(): void;
}

export interface TitleScreen {
  readonly root: HTMLElement;
  /** Show it and put focus on it. */
  show(): void;
  /** Hide it and take it out of the tab order — see `hidden` below. */
  hide(): void;
  visible(): boolean;
  /** Re-apply the language and the motion setting. */
  refresh(): void;
  destroy(): void;
}

export function createTitleScreen(deps: TitleScreenDeps): TitleScreen {
  const { doc, i18n } = deps;

  const root = doc.createElement('div');
  root.className = 'screen screen--title';

  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'title-press';

  const mark = doc.createElement('span');
  mark.className = 'title-mark';
  mark.textContent = TITLE_MARK;

  const credit = doc.createElement('span');
  credit.className = 'title-credit';

  const start = doc.createElement('span');
  start.className = 'title-start';

  // ⚠️ INSIDE the button, and that is deliberate on two counts. A credit outside it would be a hole
  // in "click anywhere"; a credit a screen reader never reaches would be a credit only sighted
  // people get. So it goes in, and into the accessible name — with the ACTION last, because that is
  // what a listener is waiting for and the point at which they stop listening.
  button.append(mark, credit, start);
  root.appendChild(button);

  const onClick = (): void => { deps.onStart(); };
  button.addEventListener('click', onClick);

  function refresh(): void {
    // The frame translates and the name crosses as a parameter — the house rule for content that is
    // not prose. "by"/"por" is the frame; "prof. José Rocha" is not translated, because a name is
    // the same name in every language.
    credit.textContent = i18n.t('title.by', { name: AUTHOR });
    start.textContent = i18n.t('title.start');
    // The name a reader hears: the game, who made it, then what pressing does. The visible text
    // says the same three things in the same order, so there is no second version of it to drift.
    button.setAttribute('aria-label', `${TITLE_MARK}. ${credit.textContent}. ${i18n.t('title.start')}`);
    // An attribute and not a media query: a media query reaches the system preference and cannot
    // see the game's own switch, and the two have to agree.
    root.dataset.motion = deps.reducedMotion() ? 'reduced' : 'full';
  }

  refresh();

  return {
    root,
    visible: () => !root.hidden,

    show() {
      root.hidden = false;
      refresh();
      button.focus();
    },

    // `hidden` rather than `display: none` in a class: it removes the subtree from the accessibility
    // tree AND from the tab order in one property, which is the pair that matters. A screen hidden
    // only by CSS is still Tab-reachable, and that is the same defect the board's `inert` closes.
    hide() { root.hidden = true; },

    refresh,

    destroy() {
      button.removeEventListener('click', onClick);
      root.remove();
    },
  };
}

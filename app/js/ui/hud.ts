// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud — the panel beside the board, and the licence offer at the bottom of it.
//
// ========================= WHY THIS IS DOM AND NOT CANVAS =========================
// The same argument the chess consumer reached the hard way, and it is worth restating because the
// obvious answer is wrong: at 320x180 a HUD line is about seven pixels tall. In a framebuffer that
// is illegible without a bitmap font, it cannot be resized by anyone who needs it larger, and a
// screen reader cannot see it at all. In the DOM it is text — it scales with `--ui-fs`, it honours
// the reader's own font size, every control gets a 44 CSS px target from `--tap` without being
// asked, and it is simply readable.
//
// ========================= WHAT ADR-0049 ALLOWS, AND WHAT IT DOES NOT =========================
// The move counter is fine, and the record says so almost directly: it is THE ROUND'S counter, the
// one number that resets. Two constraints come with it and both are cheap to violate:
//   · NO ANIMATION WHEN IT RISES. No pop, no colour flash, no tick sound. There is none here.
//   · NOTHING RANKS. No best score, no personal record, no par to be measured against, nothing
//     persisted across rounds. The count is a work log, not a result.
//
// And the hint is NOT gated, counted or penalised. There is no wrong move in a sliding puzzle —
// every move is reversible in one keypress — so a lock would have to invent a penalty in order to
// have something to protect, which is the pattern the record is written against. What 49.e actually
// forbids is delivering the answer INSTEAD of the reasoning, and that line is kept by the hint
// SHOWING the next moves and never playing them.
//
// ========================= AGPL SECTION 13 =========================
// The link at the bottom is the offer the licence creates, as something a player can act on rather
// than a line in a file nobody opens. Section 13 is the entire reason this project is AGPL and not
// GPL (ADR-0064), and neither the engine nor the chess consumer ships it today. `agpl-source-offer`
// is the gate that keeps it here.

import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { SIZES } from '../render/geometry.ts';
import type { Size } from '../render/geometry.ts';
import type { I18n } from '../i18n/index.ts';
import type { Run } from '../puzzle/run.ts';

/**
 * The repository this game's source lives in. The AGPL section 13 offer points here.
 *
 * ⚠️ It resolves to a PRIVATE repository until the Município authorises publication (ADR-0066 §3).
 * That is a limit of the process and not of the implementation: the offer is in place and becomes
 * effective on the day of the ato. Recorded in docs/LICENSES.md rather than left as a promise.
 */
export const SOURCE_URL = 'https://github.com/the-inclusionist/game-15puzzle';

export interface HudDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  run(): Run;
  onShuffle(): void;
  /**
   * OPEN THE EMPATHY PANEL.
   *
   * ⚠️ A BUTTON HERE AND NOT ONLY IN THE PAUSE CARD, AND IT IS A BRIDGE RATHER THAN A PREFERENCE. The
   * engine's pause card carries an `empatia` item and this game wires it — but measured on 2026-09-11,
   * seven keys pressed for real, NOTHING opens that card in this game: the engine's `_pause` is the
   * gamepad START, and this game declares no preset that maps a key to it. A child at a keyboard would
   * have no way in at all, and these modes are lesson content she is meant to reach.
   *
   * Delete this the day the card has an opener. The pause item stays wired either way.
   */
  onEmpathy(): void;
  onHint(): void;
  onSize(size: Size): void;
  onReducedMotion(on: boolean): void;
  /** The starting states, so the controls open showing what is actually true. */
  readonly initial: { size: Size; reducedMotion: boolean };
}

export interface Hud {
  readonly root: HTMLElement;
  /** Move count and progress. Called after every move; writes text and nothing else. */
  refresh(): void;
  /** Re-label every control. The engine dispatches `i18n:change` and this is the answer to it. */
  relabel(): void;
  destroy(): void;
}

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n } = deps;
  const root = doc.createElement('div');
  root.className = 'hud';

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    return node;
  };

  const movesTitle = el('h2');
  const movesValue = el('p', 'hud-count');
  const progress = el('p');

  const shuffle = el('button');
  shuffle.type = 'button';
  shuffle.addEventListener('click', () => deps.onShuffle());

  const hintButton = el('button');
  hintButton.type = 'button';
  hintButton.addEventListener('click', () => deps.onHint());

  const sizeLabel = el('label');
  const sizeSelect = el('select');
  sizeSelect.id = 'hud-size';
  sizeLabel.htmlFor = sizeSelect.id;
  for (const n of SIZES) {
    const option = doc.createElement('option');
    option.value = String(n);
    sizeSelect.appendChild(option);
  }
  sizeSelect.value = String(deps.initial.size);
  sizeSelect.addEventListener('change', () => deps.onSize(Number(sizeSelect.value) as Size));

  /* ===================== WHAT USED TO BE HERE, AND WHY IT IS NOT =====================
   *
   * A vision `<select>` and a high-contrast checkbox lived at this point. They were removed on the
   * engine 9.0.0 upgrade in favour of the accessibility bar's 🚥 and 🌗 — the Dev's priority, in his
   * words: use the engine's menus, icons and themes, so the project keeps one visual identity.
   *
   * ⚠️ AND KEEPING BOTH WOULD HAVE BEEN WORSE THAN DUPLICATION. These wrote this game's own storage
   * keys while the bar writes the engine's, so the two would disagree the moment a child touched
   * either. This game already carries one such split — the TEA icon against the motion checkbox —
   * and that one is survivable only because an OR can never un-reduce motion. Contrast has no safe
   * direction to fall in.
   *
   * 📌 The select was also ONE field carrying two axes plus the simulations, which is the shape
   * ADR-0104 split and ADR-0011's supersession forbids: a child with colour blindness may need high
   * contrast AT THE SAME TIME, and one value cannot hold both. `setPlayerTheme` and
   * `setPlayerCorrection` are two fields because they are two questions.
   */

  const motionRow = el('span', 'hud-check');
  const motionBox = el('input');
  motionBox.type = 'checkbox';
  motionBox.id = 'hud-motion';
  motionBox.checked = deps.initial.reducedMotion;
  const motionText = el('label');
  motionText.htmlFor = motionBox.id;
  motionBox.addEventListener('change', () => deps.onReducedMotion(motionBox.checked));
  motionRow.append(motionBox, motionText);

  const empathy = el('button', 'hud-btn');
  empathy.type = 'button';
  empathy.id = 'hud-empathy';
  empathy.addEventListener('click', () => deps.onEmpathy());

  const legal = el('p', 'hud-legal');
  const legalText = doc.createTextNode('');
  const sourceLink = el('a');
  sourceLink.href = SOURCE_URL;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  legal.append(legalText, ' ', sourceLink);

  root.append(
    movesTitle, movesValue, progress,
    shuffle, hintButton,
    sizeLabel, sizeSelect,
    empathy, motionRow,
    el('span', 'hud-spacer'),
    legal,
  );

  function refresh(): void {
    const run = deps.run();
    const need = run.size * run.size - 1;
    // Plain text, replaced. No animation on the rise — ADR-0049, and it is one line to violate.
    movesValue.textContent = String(run.moves());
    progress.textContent = i18n.t('hud.progress', { have: run.tilesHome(), need });
  }

  function relabel(): void {
    movesTitle.textContent = i18n.t('hud.moves');
    shuffle.textContent = i18n.t('hud.shuffle');
    hintButton.textContent = i18n.t('hud.hintShort');
    hintButton.setAttribute('aria-label', i18n.t('hud.hint'));
    sizeLabel.textContent = i18n.t('hud.size');
    for (const option of Array.from(sizeSelect.options)) option.textContent = i18n.t(`size.${option.value}`);
    empathy.textContent = i18n.t('empathy.open');
    empathy.setAttribute('aria-label', i18n.t('empathy.openLong'));
    motionText.textContent = i18n.t('hud.reducedMotion');
    legalText.textContent = i18n.t('legal.licence');
    sourceLink.textContent = i18n.t('legal.source');
    refresh();
  }

  relabel();

  return {
    root,
    refresh,
    relabel,
    destroy() { root.remove(); },
  };
}

/**
 * The CSS filter for a vision mode, or '' for none.
 *
 * ⚠️ APPLIED TO `#game-region`, ONCE, AND THAT IS THE WHOLE POINT. The engine's own path applies the
 * filter to the canvas and — for the nine EMPATHY modes — deliberately CLEARS it on the DOM layer,
 * because there the menus are the instrument for leaving the simulation and a blindness that
 * blanked the pause menu would lock a child inside it.
 *
 * That reasoning does not survive a game whose visible content IS DOM. Left alone, `blind`
 * (`brightness(0)`) would black out the canvas and leave the tile numbers perfectly legible: the
 * simulation inverted, and an adult told they had felt something they had not. Filtering the region
 * — which contains both surfaces — is what makes the mode mean what it says here.
 */
export function visionFilter(key: string): string {
  return VIZ_FILTER[key] ?? '';
}

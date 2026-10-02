// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud — the panel beside the board, now only the licence offer at the bottom.
//
// ========================= WHAT USED TO BE HERE =========================
// A moves counter, a progress line, a shuffle button, a hint button, a size `<select>`, a reduced-
// motion checkbox and a vision select — about 190 lines. All of it is the ENGINE's now (step 11e):
//
//   · the two numbers (moves, progress) are declared as `hud: [...]` on `createGame` and drawn in
//     the engine's own HUD bands (ADR-0168, ADR-0175);
//   · the size list and reduced-motion toggle are declared as `gameOptions: [...]` and drawn by the
//     engine's «Opções do jogo» panel (ADR-0182);
//   · shuffle and hint are `action4` and `action3` of the game's `preset`, reached by the engine's
//     remap, the on-screen pad and the switch-scan (ADR-0111);
//   · the vision select and the contrast checkbox have been owned by the bar's 🚥 and 🌗 since
//     engine 9 (ADR-0104, ADR-0145);
//   · the empathy opener was deleted in step 11d — the engine mounts its own panel.
//
// ========================= WHY THIS FILE DID NOT DISAPPEAR =========================
// AGPL section 13. The licence creates an obligation to offer the source TO WHOEVER INTERACTS with
// the service, and the obligation lives at the edge of the running game. That is what remains:
// the SOURCE link, offered where a player can act on it. Section 13 is the entire reason this
// project is AGPL and not GPL (ADR-0064), and `agpl-source-offer.node.test.ts` is the gate.
//
// ⚠️ IT RESOLVES TO A PRIVATE REPOSITORY UNTIL THE «ATO». A limit of the process and not of the
// implementation; recorded in `docs/LICENSES.md`.
//
// `visionFilter(key)` stays exported — the cartridge uses it to turn a mode key into a CSS filter
// string before handing it to `engine.applyVisionFilter`. It is pure data.

import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import type { I18n } from '../i18n/index.ts';

export const SOURCE_URL = 'https://github.com/the-inclusionist/game-15puzzle';

export interface HudDeps {
  readonly doc: Document;
  readonly i18n: I18n;
}

export interface Hud {
  readonly root: HTMLElement;
  /** Re-label after an `i18n:change`. The licence sentence is the only text here. */
  relabel(): void;
  destroy(): void;
}

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n } = deps;
  const root = doc.createElement('div');
  root.className = 'hud';

  const legal = doc.createElement('p');
  legal.className = 'hud-legal';
  const legalText = doc.createElement('span');
  const sep = doc.createTextNode(' · ');
  const sourceLink = doc.createElement('a');
  sourceLink.href = SOURCE_URL;
  // ⚠️ `noopener noreferrer`: a link that opens a new tab without these hands the opened page a
  // handle on this one — tabnabbing. Pinned by `agpl-source-offer.node.test.ts`.
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.target = '_blank';
  legal.append(legalText, sep, sourceLink);
  root.appendChild(legal);

  function relabel(): void {
    legalText.textContent = i18n.t('legal.licence');
    sourceLink.textContent = i18n.t('legal.source');
  }
  relabel();

  return {
    root,
    relabel,
    destroy: () => root.remove(),
  };
}

/**
 * The CSS filter for a vision mode, or `''` for none.
 *
 * ⚠️ APPLIED TO `#game-region`, ONCE, AND THAT IS THE WHOLE POINT. The engine's own path applies
 * the filter to the canvas and — for the nine EMPATHY modes — deliberately CLEARS it on the DOM
 * layer, because there the menus are the instrument for leaving the simulation and a blindness that
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

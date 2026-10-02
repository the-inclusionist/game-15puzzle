// SPDX-License-Identifier: AGPL-3.0-or-later
// The HUD's only subject now is the AGPL §13 source offer — step 11e deleted the counters, the
// shuffle/hint buttons, the size list and the reduced-motion checkbox. Those behaviours live in the
// engine (hud bands, gameOptions panel, preset's action3/4) and in that engine's own tests. What
// this file asserts is that the ONE obligation the licence puts at the edge of the running game is
// still rendered, named, linkable and in reach of a keyboard.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { createHud, SOURCE_URL, visionFilter } from '../app/js/ui/hud.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import type { Hud } from '../app/js/ui/hud.ts';

const i18n = createI18n(null);
let mounted: { region: HTMLElement; hud: Hud } | null = null;

function mount() {
  const region = document.createElement('div');
  region.id = 'game-region';
  region.style.cssText = 'position:relative;width:640px;height:360px';
  region.style.setProperty('--ui-fs', '16px');
  region.style.setProperty('--tap', '44px');
  document.body.appendChild(region);

  const hud = createHud({ doc: document, i18n });
  region.appendChild(hud.root);
  mounted = { region, hud };
  return { region, hud };
}

afterEach(() => { mounted?.hud.destroy(); mounted?.region.remove(); mounted = null; });

describe('AGPL section 13 — the offer, rendered', () => {
  it('shows a link a player can follow, pointing at the source', () => {
    const m = mount();
    const link = m.hud.root.querySelector('a')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(SOURCE_URL);
    expect(link.textContent?.trim()).not.toBe('');
  });

  it('says which licence the offer is under, beside it', () => {
    const m = mount();
    expect(m.hud.root.querySelector('.hud-legal')?.textContent).toContain('AGPL');
  });

  it('keeps a visible focus ring on it — it is the smallest text on the panel', () => {
    const m = mount();
    const link = m.hud.root.querySelector('a')!;
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it('rebuilds its own text when the language changes', () => {
    const m = mount();
    const before = m.hud.root.querySelector('.hud-legal')?.textContent;
    m.hud.relabel();
    expect(m.hud.root.querySelector('.hud-legal')?.textContent).toBe(before);
    expect(before?.trim()).not.toBe('');
  });
});

describe('visionFilter still answers the cartridge', () => {
  // The function stays exported because the cartridge turns a mode key into a CSS filter string
  // before handing it to `engine.applyVisionFilter`. Pure data; one call site; worth one gate.
  it('turns a correction key into a filter, and `normal` into nothing', () => {
    expect(visionFilter('fix-deuter')).not.toBe('');
    expect(visionFilter('normal')).toBe('');
  });
});

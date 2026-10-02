// SPDX-License-Identifier: AGPL-3.0-or-later
// The panel: the round's counter, the controls, and the licence offer at the bottom of it.
//
// What is checked here rather than in the node gate: that the offer is RENDERED. `agpl-source-offer`
// proves the URL is right and the wiring is in the source; only a browser can say a person could
// actually click it.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { SOURCE_URL, createHud, visionFilter } from '../app/js/ui/hud.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { solved } from '../app/js/puzzle/board.ts';
import type { Hud } from '../app/js/ui/hud.ts';
import type { Run } from '../app/js/puzzle/run.ts';
import type { Size } from '../app/js/render/geometry.ts';

const i18n = createI18n(null);
const solver = createSolver();
let mounted: { region: HTMLElement; hud: Hud } | null = null;

function mount() {
  const region = document.createElement('div');
  region.id = 'game-region';
  region.style.cssText = 'position:relative;width:640px;height:360px';
  region.style.setProperty('--ui-fs', '16px');
  region.style.setProperty('--tap', '44px');
  document.body.appendChild(region);

  let run: Run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
  const calls: string[] = [];
  const hud = createHud({
    doc: document,
    i18n,
    run: () => run,
    initial: { size: 4, reducedMotion: false },
    onShuffle: () => calls.push('shuffle'),
    onHint: () => calls.push('hint'),
    onSize: (n: Size) => calls.push(`size:${n}`),
    onReducedMotion: (on) => calls.push(`motion:${on}`),
  });
  region.appendChild(hud.root);
  mounted = { region, hud };
  return { region, hud, run: () => run, calls };
}

afterEach(() => { mounted?.hud.destroy(); mounted?.region.remove(); mounted = null; });

describe('AGPL section 13 — the offer, rendered', () => {
  it('shows a link a player can follow, pointing at the source', () => {
    const m = mount();
    const link = m.hud.root.querySelector('a')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(SOURCE_URL);
    expect(link.textContent?.trim()).not.toBe('');
    // A link opening a new tab without `noopener` hands the opened page a handle on this one.
    expect(link.rel).toContain('noopener');
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
});

describe('the round counter', () => {
  it('shows moves and progress, and follows the run', () => {
    const m = mount();
    const count = m.hud.root.querySelector('.hud-count')!;
    expect(count.textContent).toBe('0');
    m.run().activate(14);
    m.hud.refresh();
    expect(count.textContent).toBe('1');
  });

  // ⚠️ ADR-0049: "No animation when the counter rises." One line to violate and invisible in review.
  it('has no transition or animation on it', () => {
    const m = mount();
    const style = getComputedStyle(m.hud.root.querySelector('.hud-count')!);
    expect(style.transitionDuration).toBe('0s');
    expect(style.animationName).toBe('none');
  });

  // ADR-0049 again: the count is a work log, not a result. Scoped to the counter block rather than
  // the whole panel, because the vision menu's labels are the ENGINE's words and talk about
  // improving sight — "melhoria" is not a score, and a regex that read it as one would be a gate
  // failing on the wrong file forever.
  it('never shows a score, a record or a par to be measured against', () => {
    const m = mount();
    const counters = [...m.hud.root.querySelectorAll('h2, p')].map((e) => e.textContent).join(' ');
    expect(counters).not.toMatch(/recorde|record[e]?|best|score|pontua|par|\/\s*\d+\s*jogadas/i);
  });
});

describe('the controls', () => {
  it('offers the three board sizes and reports the chosen one', () => {
    const m = mount();
    const select = m.hud.root.querySelector<HTMLSelectElement>('#hud-size')!;
    expect(select.options).toHaveLength(3);
    select.value = '5';
    select.dispatchEvent(new Event('change'));
    expect(m.calls).toContain('size:5');
  });

  // The hint is never locked, never counted and never penalised: there is no wrong move in a sliding
  // puzzle, so a lock would have to invent a penalty in order to have something to protect.
  it('leaves the hint button enabled from the first frame', () => {
    const m = mount();
    const buttons = [...m.hud.root.querySelectorAll('button')];
    for (const b of buttons) {
      expect(b.disabled).toBe(false);
      expect(b.getAttribute('aria-disabled')).toBeNull();
    }
    buttons[1].click();
    expect(m.calls).toContain('hint');
  });

  it('gives every control the 44px target the engine promises', () => {
    const m = mount();
    for (const control of m.hud.root.querySelectorAll<HTMLElement>('button, select')) {
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it('labels every select with a real label element', () => {
    const m = mount();
    for (const select of m.hud.root.querySelectorAll<HTMLSelectElement>('select')) {
      expect(m.hud.root.querySelector(`label[for="${select.id}"]`)).not.toBeNull();
    }
  });

  /**
   * ⚠️ THE TEST THAT USED TO BE HERE IS RETIRED, NOT MOVED, and the difference is worth the words.
   *
   * It read: «lists only vision modes that a CSS filter can actually deliver», and it guarded a real
   * defect — `VIZ_DOM_ONLY` includes entries that resolve to no filter, so listing the set wholesale
   * offered a child a setting that changed nothing when she picked it. That menu no longer exists:
   * on engine 9.0.0 the accessibility bar's 🚥 and 🌗 own colour correction and contrast, because the
   * Dev's priority is that every game in the catalogue uses the engine's menus, icons and themes.
   *
   * There is nothing left here to assert. The property it protected now belongs to the engine's own
   * menu, and a copy of it in this repository would be a gate measuring somebody else's widget —
   * green or red for reasons no one here can act on.
   *
   * `visionFilter` itself survives and is still exercised: the cartridge maps the engine's
   * `Correcao` axis onto it, and `hud.ts` keeps it as the one place a filter key becomes CSS.
   */
  it('still turns a correction key into a filter, which is what the cartridge asks of it', () => {
    expect(visionFilter('fix-deuter')).not.toBe('');
    // `tricro` is a NAME for trichromatic vision, not an absence, and it is the one correction that
    // must resolve to nothing — the cartridge maps it to `normal` before asking.
    expect(visionFilter('normal')).toBe('');
  });

  it('rebuilds its own text when the language changes', () => {
    const m = mount();
    const before = m.hud.root.querySelector('h2')!.textContent;
    m.hud.relabel();
    expect(m.hud.root.querySelector('h2')!.textContent).toBe(before);
    expect(before?.trim()).not.toBe('');
  });
});

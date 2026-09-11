// SPDX-License-Identifier: AGPL-3.0-or-later
// The empathy panel, and the three ways it could fail without failing.
//
// ========================= WHAT THIS IS FOR =========================
// The Dev's correction, on the day the panel was built: «As crianças usam, mas não como adaptação, mas
// para experimentar no jogo questões de acessibilidade e inclusão trabalhados em sala de aula.» These
// modes are lesson content a child reaches for, not a grown-up's demonstration — so the panel is
// gameplay, and gameplay a child cannot leave is worse than gameplay she never found.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { createEmpathyPanel } from '../app/js/ui/empathy-panel.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import type { EmpathyPanel } from '../app/js/ui/empathy-panel.ts';
import type { VisualState } from '@the-inclusionist/engine/render/viz-axes.js';

const i18n = createI18n(window);
let mounted: { host: HTMLElement; panel: EmpathyPanel } | null = null;

function mount(initial: Partial<VisualState> = {}) {
  const host = document.createElement('div');
  host.style.cssText = 'width:400px';
  host.style.setProperty('--ui-fs', '16px');
  document.body.appendChild(host);

  let visual: VisualState = { tema: 'padrao', correcao: 'tricro', simulacao: null, ...initial };
  const picks: (string | null)[] = [];
  const panel = createEmpathyPanel({
    doc: document,
    i18n,
    visual: () => visual,
    onPick: (s) => { picks.push(s); visual = { ...visual, simulacao: s }; },
  });
  host.appendChild(panel.root);
  // OPEN, because that is the only state a child ever sees it in — and because `checkVisibility()`
  // below would otherwise be measuring the panel's own `hidden`, not whether a row survived.
  panel.show();
  mounted = { host, panel };
  return {
    host, panel, picks,
    rows: () => [...panel.root.querySelectorAll<HTMLInputElement>('input[type="radio"]')],
    row: (v: string) => panel.root.querySelector<HTMLInputElement>(`input[value="${v}"]`)!,
  };
}

afterEach(() => { mounted?.panel.destroy(); mounted?.host.remove(); mounted = null; });

describe('the way out is always open', () => {
  /**
   * ⚠️ THE ONE THAT MATTERS MOST. A child inside `lv-tunnel` sees a keyhole and a child inside `blind`
   * sees nothing at all — so the control that ends the simulation cannot be a second thing she has to
   * find in a state designed to make finding things hard. It is the FIRST row of the same list she
   * arrived through, and it is never disabled, under any combination of the two axes.
   */
  it('offers "none" as the first row, enabled in every state', () => {
    for (const state of [
      {},
      { tema: 'hc7' as const },
      { correcao: 'deuter' as const },
      { tema: 'hc45' as const, correcao: 'protan' as const },
      { simulacao: 'blind' as const },
    ]) {
      const m = mount(state);
      expect(m.rows()[0].value, 'the way out is not the first row').toBe('normal');
      expect(m.row('normal').disabled, `disabled with ${JSON.stringify(state)}`).toBe(false);
      m.panel.destroy(); m.host.remove(); mounted = null;
    }
  });

  it('leaves by the same shape it arrived by — a row, not a close button', () => {
    const m = mount({ simulacao: 'lv-tunnel' });
    m.panel.refresh();
    expect(m.row('lv-tunnel').checked).toBe(true);
    m.row('normal').click();
    expect(m.picks).toEqual([null]);
  });
});

describe('a simulation never runs over an adaptation', () => {
  /**
   * ⚠️ ADR-0076, AND THE REFUSAL IS THE FEATURE. High contrast and colour correction already repaint
   * the screen; a simulation on top of either would teach something false about both. The engine
   * answers WHY — 'tema', 'correcao' or 'ambos' — and this asserts the answer REACHES THE CHILD,
   * because a control that refuses in silence is the one that teaches her the path is not for her.
   */
  it('disables the simulations and says why, instead of hiding them', () => {
    const m = mount({ tema: 'hc7' });
    const sim = m.row('lv-blur');
    expect(sim.disabled).toBe(true);
    // Still THERE: a row that vanishes teaches that the thing is not for her.
    expect(sim.checkVisibility()).toBe(true);
    const why = sim.closest('.ctrl-row')!.querySelector<HTMLElement>('.empathy-why')!;
    expect(why.hidden).toBe(false);
    expect(why.textContent?.trim()).not.toBe('');
  });

  it('says a different thing when both axes are on', () => {
    const one = mount({ tema: 'hc7' });
    const whyOne = one.row('lv-blur').closest('.ctrl-row')!.querySelector('.empathy-why')!.textContent;
    one.panel.destroy(); one.host.remove(); mounted = null;

    const both = mount({ tema: 'hc7', correcao: 'protan' });
    const whyBoth = both.row('lv-blur').closest('.ctrl-row')!.querySelector('.empathy-why')!.textContent;
    expect(whyBoth).not.toBe(whyOne);
  });

  it('offers them all when neither axis is on', () => {
    const m = mount();
    for (const input of m.rows()) expect(input.disabled, input.value).toBe(false);
  });
});

describe('every mode offered actually delivers something', () => {
  /**
   * 🔴 THE GATE THAT CAUGHT A MODE PAINTING NOTHING, and the failure had no symptom at all.
   *
   * The low-vision overlays are CSS, and `radial-gradient(circle 9% at …)` is INVALID — a `circle`
   * radius must be a length, so a percentage makes the browser drop the whole `background`
   * declaration. `lv-diabetic` still appeared in the list, still announced itself, still applied its
   * blur, and painted not one spot. Measured: zero gradients in the computed style.
   *
   * ⚠️ AND THAT IS THE SHAPE OF EVERY FAILURE THIS PANEL CAN HAVE. A simulation that under-delivers
   * does not throw and does not look broken — it teaches a child that tunnel vision is a slight blur.
   * The Dev's correction is what makes that intolerable rather than thin: these are lesson content.
   *
   * The assertion is on the COMPUTED style, because that is the only place an invalid declaration
   * shows up as absent; the source text would read perfectly.
   */
  it('paints a shape for every mode whose character is spatial', () => {
    const host = document.createElement('div');
    host.id = 'world';
    host.style.cssText = 'position:relative;width:320px;height:180px';
    const overlay = document.createElement('div');
    overlay.id = 'lv-overlay';
    host.appendChild(overlay);
    document.body.appendChild(host);

    // The three the engine delivers with a texture rather than a filter — `lvOverlayTex` in its own
    // `viewports` context, which this game answers with a painted element instead.
    const expected = { tunnel: 1, macular: 1, diabetic: 5 };
    for (const [lv, count] of Object.entries(expected)) {
      overlay.dataset.lv = lv;
      const image = getComputedStyle(overlay).backgroundImage;
      expect((image.match(/radial-gradient/g) ?? []).length, `${lv} painted nothing`).toBe(count);
    }

    // And no attribute means no overlay at all — `blind` and the colour simulations are pure filter.
    delete overlay.dataset.lv;
    expect(getComputedStyle(overlay).display).toBe('none');
    host.remove();
  });
});

describe('the list is the engine`s, not a copy of it', () => {
  // ⚠️ DERIVED FROM `VIZ_MODES`, so a mode added upstream arrives on its own and a hand-written list
  // cannot drift away from the catalogue. The count is asserted loosely for that reason: what is
  // pinned is that the simulations are all here, not that there are exactly nine for ever.
  it('carries every simulation the catalogue offers, plus the way out', async () => {
    const { VIZ_MODES, VIZ_FILTER } = await import('@the-inclusionist/engine/render/viz-modes.js');
    // ⚠️ EITHER PIECE COUNTS. A low-vision mode is a filter AND an overlay; `lv-macular` has no
    // filter at all and is delivered entirely by the painted shape, so a test that asked only for
    // `VIZ_FILTER` would assert that the mode this game fixed is correctly missing.
    const expected = VIZ_MODES.filter((mode) => mode.sim && (VIZ_FILTER[mode.key] || mode.lv))
      .map((mode) => mode.key);
    const m = mount();
    expect(m.rows().map((r) => r.value)).toEqual(['normal', ...expected]);
    expect(expected.length).toBeGreaterThan(5);
  });

  it('names and describes every row from the engine`s own dictionary', () => {
    const m = mount();
    for (const input of m.rows()) {
      const row = input.closest('.ctrl-row')!;
      expect(row.querySelector('strong')?.textContent?.trim(), input.value).not.toBe('');
      expect(row.querySelector('.opt-hint')?.textContent?.trim(), input.value).not.toBe('');
    }
  });

  // One radio group, one name, one legend: nine radios are one control to a screen reader only if
  // something says what the group is asking.
  it('is one named group and not nine loose switches', () => {
    const m = mount();
    expect(new Set(m.rows().map((r) => r.name)).size).toBe(1);
    expect(m.panel.root.querySelector('legend')?.textContent?.trim()).not.toBe('');
    expect(m.panel.root.getAttribute('aria-labelledby')).toBe('empathy-title');
  });
});

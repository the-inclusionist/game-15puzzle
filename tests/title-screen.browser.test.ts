// SPDX-License-Identifier: AGPL-3.0-or-later
// The title screen is one control that fills the screen, and these are the properties that make
// "click anywhere" something other than a mouse-only trap.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { AUTHOR, TITLE_MARK, createTitleScreen } from '../app/js/ui/title-screen.ts';
import { createTileGrid } from '../app/js/ui/tile-grid.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { solved } from '../app/js/puzzle/board.ts';
import { boardGeometry } from '../app/js/render/geometry.ts';
import type { TitleScreen } from '../app/js/ui/title-screen.ts';

const i18n = createI18n(window);
const solver = createSolver();
let mounted: { region: HTMLElement; screen: TitleScreen } | null = null;

function mount(reduced = false) {
  const region = document.createElement('div');
  region.id = 'game-region';
  region.style.cssText = 'position:relative;width:640px;height:360px';
  region.style.setProperty('--ui-fs', '16px');
  document.body.appendChild(region);

  let reducedMotion = reduced;
  const started: number[] = [];
  const screen = createTitleScreen({
    doc: document,
    i18n,
    reducedMotion: () => reducedMotion,
    onStart: () => started.push(1),
  });
  region.appendChild(screen.root);
  mounted = { region, screen };
  return {
    region, screen, started,
    button: () => screen.root.querySelector('button')!,
    setReduced(on: boolean) { reducedMotion = on; screen.refresh(); },
  };
}

afterEach(() => { mounted?.screen.destroy(); mounted?.region.remove(); mounted = null; });

describe('"click anywhere" is a button', () => {
  // ⚠️ THE WHOLE POINT. A div with a click handler works for a mouse and for nobody else: no role,
  // no accessible name, no keyboard path, no focus ring. WCAG 2.1.1 and 4.1.2.
  it('is a real button covering the whole screen', () => {
    const m = mount();
    const button = m.button();
    expect(button.tagName).toBe('BUTTON');
    const box = button.getBoundingClientRect();
    const region = m.region.getBoundingClientRect();
    expect(box.width).toBeCloseTo(region.width, 0);
    expect(box.height).toBeCloseTo(region.height, 0);
  });

  it('is named by the game, its author, and what pressing does — in that order', () => {
    const m = mount();
    const name = m.button().getAttribute('aria-label') ?? '';
    expect(name).toContain(TITLE_MARK);
    expect(name).toContain(AUTHOR);
    expect(name).toContain(i18n.t('title.start'));
    // The ACTION last: it is what a listener is waiting for, and where they stop listening.
    expect(name.indexOf(AUTHOR)).toBeLessThan(name.indexOf(i18n.t('title.start')));
  });

  it('shows the same words it announces, so there is no second version to drift', () => {
    const m = mount();
    expect(m.screen.root.querySelector('.title-mark')?.textContent).toBe(TITLE_MARK);
    expect(m.screen.root.querySelector('.title-start')?.textContent).toBe(i18n.t('title.start'));
  });

  it('takes a click, and Enter and Space through the platform', () => {
    const m = mount();
    m.screen.show();
    m.button().click();
    expect(m.started).toHaveLength(1);
    // Enter and Space are the button's own behaviour: the platform turns them into clicks, and
    // re-implementing them would be a second door into the same room.
    expect(m.button().type).toBe('button');
  });

  it('takes focus when it is shown, so a keyboard needs no hunting', () => {
    const m = mount();
    m.screen.show();
    expect(document.activeElement).toBe(m.button());
  });

  it('leaves the tab order entirely when hidden', () => {
    const m = mount();
    m.screen.show();
    m.screen.hide();
    expect(m.screen.root.hidden).toBe(true);
    // `hidden` and not a CSS class: it removes the subtree from the accessibility tree AND the tab
    // order at once. A screen hidden only by CSS is still Tab-reachable.
    //
    // Asserted as NOT RENDERED rather than as "focus moved": `focus()` on an unrendered element is a
    // no-op, and where the focus went instead is the browser's business and not this property.
    expect(m.button().checkVisibility()).toBe(false);
    expect(m.button().offsetParent).toBeNull();
  });
});

describe('the pulse', () => {
  it('breathes when motion is allowed', () => {
    const m = mount(false);
    m.screen.show();
    const style = getComputedStyle(m.screen.root.querySelector('.title-start')!);
    expect(style.animationName).toBe('title-breathe');
    // Well under the three-per-second of WCAG 2.3.1, and a fade rather than a blink.
    expect(parseFloat(style.animationDuration)).toBeGreaterThanOrEqual(1);
  });

  // ⚠️ WCAG 2.2.2. The switch and the system preference must reach the SAME place, which is why this
  // is a data attribute and not a `prefers-reduced-motion` media query — a media query can see the
  // system and cannot see the game's own switch.
  it('stops when the game says motion is reduced', () => {
    const m = mount(true);
    m.screen.show();
    expect(m.screen.root.dataset.motion).toBe('reduced');
    expect(getComputedStyle(m.screen.root.querySelector('.title-start')!).animationName).toBe('none');
  });

  it('follows the switch being flipped while it is on screen', () => {
    const m = mount(false);
    m.screen.show();
    m.setReduced(true);
    expect(getComputedStyle(m.screen.root.querySelector('.title-start')!).animationName).toBe('none');
    m.setReduced(false);
    expect(getComputedStyle(m.screen.root.querySelector('.title-start')!).animationName).toBe('title-breathe');
  });
});

describe('the typeface stops at this screen', () => {
  it('sets Press Start 2P on the title', () => {
    const m = mount();
    expect(getComputedStyle(m.button()).fontFamily).toContain('Press Start 2P');
  });

  // ⚠️ THE LINE THAT MATTERS. A pixel face on the board's digits would override the face a child
  // chose for herself, which is the one thing the engine's typography settings exist for. The title
  // is a logo; the board is her text.
  it('never reaches the board', () => {
    const m = mount();
    let run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const grid = createTileGrid({
      doc: document, i18n, run: () => run, geometry: () => boardGeometry(4), onActivate: () => {},
    });
    m.region.appendChild(grid.root);
    const cell = grid.root.querySelector<HTMLElement>('[role="gridcell"]')!;
    expect(getComputedStyle(cell).fontFamily).not.toContain('Press Start 2P');
    grid.destroy();
  });
});

describe('the credit', () => {
  it('shows the author under the mark', () => {
    const m = mount();
    const credit = m.screen.root.querySelector('.title-credit');
    expect(credit?.textContent).toContain(AUTHOR);
    // Under the mark and above the action, in DOM order, which is also reading order.
    const spans = [...m.button().children].map((c) => c.className);
    expect(spans).toEqual(['title-mark', 'title-credit', 'title-start']);
  });

  // ⚠️ IT IS NOT A COPYRIGHT NOTICE. Lei 9.609 art. 4º puts the patrimonial right with the
  // Município — `agpl-source-offer` pins that no source file claims a holder — while Lei 9.610
  // art. 24, II gives the author an inalienable right to be NAMED. Both hold at once, and this is
  // the check that stops the credit drifting into the other thing.
  it('names the author without claiming copyright', () => {
    const m = mount();
    const text = m.screen.root.textContent ?? '';
    expect(text).not.toMatch(/copyright|©|todos os direitos|all rights/i);
  });

  it('reaches a screen reader as well as an eye — it is inside the named control', () => {
    const m = mount();
    expect(m.button().contains(m.screen.root.querySelector('.title-credit'))).toBe(true);
  });

  it('translates the frame and leaves the name alone', () => {
    const m = mount();
    const credit = m.screen.root.querySelector('.title-credit')?.textContent ?? '';
    expect(credit).toContain(AUTHOR);
    expect(credit).not.toContain('{name}');
  });

  it('fits inside the screen at the k=2 floor, where the region is narrowest', () => {
    const m = mount();
    m.screen.show();
    const credit = m.screen.root.querySelector<HTMLElement>('.title-credit')!;
    const region = m.region.getBoundingClientRect();
    expect(credit.getBoundingClientRect().width).toBeLessThanOrEqual(region.width);
    expect(credit.scrollWidth).toBeLessThanOrEqual(Math.ceil(credit.clientWidth) + 1);
  });
});

describe('the language', () => {
  it('translates the word beside the mark, and leaves the mark alone', () => {
    const m = mount();
    // A name is not prose: "15-Puzzle" is what the thing is called in every locale.
    expect(m.screen.root.querySelector('.title-mark')?.textContent).toBe('15-Puzzle!');
    expect(m.screen.root.querySelector('.title-start')?.textContent).not.toBe('');
  });
});

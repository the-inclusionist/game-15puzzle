// SPDX-License-Identifier: AGPL-3.0-or-later
// The cartridge contract, as four properties instead of four promises.
//
// ========================= THESE ARE ADR-0139's OWN GATES =========================
// The record ships with no `confirmed-by` and names what would confirm it:
//
//   1. «A cartridge that is imported and never instantiated must do nothing observable — no DOM, no
//      listener, no registration.»
//   2. «`grep` for `createGame` inside a cartridge's own source returns nothing.» — that one is in
//      `cartridge-rules.node.test.ts`, where the file is read from DISK. It lived here briefly, over
//      a `fetch('/app/js/cartridge.ts')`, and that is a gate with a hole: a dev server that answers a
//      source request with the SPA's index.html turns `not.toMatch(/createGame/)` into a sentence
//      about HTML, which passes for ever.
//   3. «Two cartridges mounted in sequence leave exactly one accessibility bar in the document.»
//   4. «`teardown()` followed by emptying `region` leaves no node the cartridge created.»
//
// They were written for `game-whackwhack`, which ADR-0068 §6 puts through the contract first. The Dev
// decided on 2026-09-11 not to wait, so they are written here instead — and the third is adapted,
// because with one cartridge the sequence that matters is mount → teardown → mount, which is the same
// question asked of the only game there is.
//
// ⚠️ AND THE ENGINE HERE IS A STUB, WHICH IS THE POINT RATHER THAN A SHORTCUT. The whole of the
// conversion is that a cartridge no longer builds its own composition root; the only way to assert
// that is to hand it one it did not make and watch it use nothing else.

import { afterEach, describe, expect, it } from 'vitest';
import '../app/css/style.css';
import { createCartridge } from '../app/js/cartridge.ts';
import { createRng } from '../app/js/puzzle/rng.ts';
import type { GameInstance } from '../app/js/cartridge.ts';

interface Scene { name: string; enter?: () => void; exit?: () => void }

/** Everything `EngineLike` promises and nothing more, so a cartridge reaching further fails loudly. */
function stubEngine() {
  const stack: Scene[] = [];
  const filters: (string | null)[] = [];
  return {
    problems: [] as readonly string[],
    keyboard: { actionOf: () => null },
    cenas: {
      push(s: Scene) { stack.push(s); s.enter?.(); },
      replace(s: Scene) { stack.pop()?.exit?.(); stack.push(s); s.enter?.(); },
      pop() { const s = stack.pop(); s?.exit?.(); return s; },
      top: () => stack[stack.length - 1] ?? null,
    },
    nav: { attach() { /* the shell's job, not the cartridge's */ }, sharedDialogOpen: () => null },
    applyVisionFilter(f: string | null) { filters.push(f); },
    _stack: stack,
    _filters: filters,
  };
}

let mounted: { region: HTMLElement; instance: GameInstance | null } | null = null;

function mount() {
  const region = document.createElement('div');
  region.id = 'game-region';
  region.style.cssText = 'position:relative;width:640px;height:360px';
  region.style.setProperty('--ui-fs', '16px');
  // The host's bar, exactly where the shell puts it — inside the region, because the engine
  // publishes `--tap` there and nowhere else.
  const bar = document.createElement('div');
  bar.id = 'a11y-bar';
  bar.innerHTML = '<button class="pi-btn" data-pi="blind"></button>';
  region.appendChild(bar);
  document.body.appendChild(region);

  const engine = stubEngine();
  const cartridge = createCartridge();
  const instance = cartridge.create({
    engine: engine as never,
    region,
    rng: createRng,
    params: new URLSearchParams('seed=42'),
  });
  mounted = { region, instance };
  return { region, bar, engine, cartridge, instance };
}

afterEach(() => {
  try { mounted?.instance?.teardown(); } catch { /* a test may have torn down already */ }
  mounted?.region.remove();
  mounted = null;
});

describe('importing is not running', () => {
  /**
   * ⚠️ GATE 1, AND IT IS THE ONE THAT MAKES A CATALOGUE POSSIBLE AT ALL. A module that boots on
   * import cannot be one of six: the platform lists games it has not opened, and a listed game that
   * has already appended a canvas, taken the keyboard or registered a dictionary has changed the page
   * for a child who never chose it.
   *
   * Asserted as a DELTA rather than as "the body is empty", because vitest's own harness lives in
   * this document and a count would measure the runner.
   */
  it('adds nothing to the document until something instantiates it', () => {
    const before = document.body.childElementCount;
    const listeners = window.addEventListener;
    let added = 0;
    window.addEventListener = function (this: Window, ...args: Parameters<typeof listeners>) {
      added++; return listeners.apply(this, args);
    } as typeof listeners;
    try {
      const cartridge = createCartridge();
      expect(cartridge.slug).toBe('game-15puzzle');
      expect(document.body.childElementCount).toBe(before);
      expect(added, 'the factory took a listener on the window').toBe(0);
    } finally {
      window.addEventListener = listeners;
    }
  });

});

describe('the instance owns what it made, and gives back what it borrowed', () => {
  it('builds its world and its column inside the region it was given', () => {
    const { region } = mount();
    expect(region.querySelector('#world')).not.toBeNull();
    expect(region.querySelector('#side')).not.toBeNull();
    expect(region.querySelector('canvas')).not.toBeNull();
    expect(region.querySelector('[role="grid"]')).not.toBeNull();
    // ⚠️ THE PANEL IS OUTSIDE THE WORLD, and it is the only thing that actually works: a CSS filter
    // rasterises its whole subtree and a descendant cannot opt out, so the control that turns a
    // blindness simulation OFF must not be inside the element the simulation lands on.
    expect(region.querySelector('#world')!.contains(region.querySelector('.hud'))).toBe(false);
  });

  /**
   * ⚠️ GATE 4. Teardown is the boundary, and it has to be a fact rather than a promise: a cartridge
   * that leaves a node behind poisons the next game mounted on the same region.
   *
   * The host's bar is asserted SEPARATELY and in the opposite direction — it must survive, because it
   * belongs to the page and the child's profile is PAGE lifetime (ADR-0038). The cartridge borrows it
   * into its own column while mounted and puts it back; if it did not, tearing down would take the
   * accessibility bar with it and the next game would have none.
   */
  it('leaves the region holding exactly what the host put there', () => {
    const { region, bar, instance } = mount();
    expect(region.childElementCount).toBeGreaterThan(1);
    instance.teardown();
    mounted!.instance = null;

    expect([...region.children].map((c) => c.id)).toEqual(['a11y-bar']);
    expect(bar.isConnected, 'the borrowed bar was destroyed with the cartridge').toBe(true);
    expect(bar.querySelectorAll('.pi-btn')).toHaveLength(1);
    // The look was written onto the HOST's element, so it is the instance's to undo — otherwise the
    // next cartridge inherits this one's palette through CSS variables nobody set.
    expect(region.dataset.contrast).toBeUndefined();
    expect(region.style.getPropertyValue('--tile-ink')).toBe('');
  });

  it('empties the scene stack through exit(), not around it', () => {
    const { engine, instance } = mount();
    expect(engine._stack).toHaveLength(1);
    instance.teardown();
    mounted!.instance = null;
    expect(engine._stack).toHaveLength(0);
  });

  /**
   * GATE 3, adapted: with one cartridge the sequence that asks the same question is
   * mount → teardown → mount. What it is really checking is that nothing accumulated — one bar, one
   * canvas, one grid — because the failure mode of a leak is a SECOND of everything, and a second
   * accessibility bar is two sets of controls disagreeing about the same child's settings.
   */
  it('can be mounted again after a teardown, with nothing left over', () => {
    const first = mount();
    first.instance.teardown();
    mounted!.instance = null;

    const engine = stubEngine();
    const again = createCartridge().create({
      engine: engine as never,
      region: first.region,
      rng: createRng,
      params: new URLSearchParams('seed=42'),
    });
    mounted!.instance = again;

    expect(first.region.querySelectorAll('#a11y-bar')).toHaveLength(1);
    expect(first.region.querySelectorAll('canvas')).toHaveLength(1);
    expect(first.region.querySelectorAll('[role="grid"]')).toHaveLength(1);
    expect(first.region.querySelectorAll('.hud')).toHaveLength(1);
  });
});

describe('the seed comes from the shell', () => {
  // ⚠️ NOT FROM `location`. Two instances handed the same `params` must produce the same board, which
  // is what makes a teacher able to give one puzzle to a whole class — and what stops another
  // cartridge's `reseed` from moving this one's draws (ADR-0141).
  it('is reproducible from the params the shell handed in', () => {
    const read = (r: HTMLElement): string =>
      [...r.querySelectorAll('[role="gridcell"] .tile-num')].map((e) => e.textContent).join(',');

    const a = mount();
    const first = read(a.region);
    a.instance.teardown();
    mounted!.instance = null;
    a.region.remove();

    const b = mount();
    expect(read(b.region)).toBe(first);
    expect(first).not.toBe('');
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// The announcements, and the timing that makes them either heard or lost.
//
// ========================= WHY THIS IS A BROWSER TEST AND NOT A NODE ONE =========================
// `srSay` clears the region, waits a frame, then writes — the clear-then-write is what forces a
// reader to re-announce a repeated string. So every assertion here has to await a frame, or it is
// flaky by construction, and a node environment has no frames to await.
//
// It is also the one thing the running preview could NOT verify. A hidden browser pane never fires
// `requestAnimationFrame`, so in the live app the regions stay empty until the tab is looked at.
// That is the engine's timing, not this game's, and it is exactly why `window.__puzzle.step(dt)`
// exists for the visual checks — but the announcement itself needs a page that is actually running,
// which is this one.
//
// ========================= AND THE COUNT MATTERS AS MUCH AS THE TEXT =========================
// `#sr-status` is `aria-live="polite"`, which QUEUES rather than interrupts. One utterance per
// completed move is right; two — the move and then the counter — puts the reader permanently a move
// behind the board and keeps it there. So "how many" is a gate here, not a detail.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// ⚠️ `srAlert`/`srSay` AS MODULE FUNCTIONS WERE REMOVED IN ENGINE 11. The engine now exports
// `createAnnouncer({ doc, raf })` which returns an `{ say, alert, … }` object; the production path
// goes through `engine.alert`/`engine.say`. For this test we build a local announcer against the
// browser document and ask it the same questions.
import { createAnnouncer } from '@the-inclusionist/engine/core/a11y-sr.js';
const { say: srSay, alert: srAlert } = createAnnouncer({ doc: document, raf: requestAnimationFrame });
import { createI18n } from '../app/js/i18n/index.ts';
import { createPuzzleDeclaration } from '../app/js/declaration/puzzle-declaration.ts';
import { createRun } from '../app/js/puzzle/run.ts';
import { createSolver } from '../app/js/puzzle/solver.ts';
import { legalMoves, solved } from '../app/js/puzzle/board.ts';

const i18n = createI18n(null);
const solver = createSolver();

const frame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

let status: HTMLElement;
let alert: HTMLElement;

beforeEach(() => {
  status = document.createElement('div');
  status.id = 'sr-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  alert = document.createElement('div');
  alert.id = 'sr-alert';
  alert.setAttribute('role', 'alert');
  alert.setAttribute('aria-live', 'assertive');
  document.body.append(status, alert);
});

afterEach(() => { status.remove(); alert.remove(); });

describe('the two channels', () => {
  it('writes a status politely, one frame later', async () => {
    srSay('peça 7 para a esquerda');
    expect(status.textContent).toBe('');      // deliberately not yet: the clear comes first
    await frame();
    expect(status.textContent).toBe('peça 7 para a esquerda');
  });

  it('re-announces the same string, which is what the clear-then-write is for', async () => {
    srSay('mesma frase'); await frame();
    srSay('mesma frase');
    expect(status.textContent).toBe('');      // cleared, so the reader hears it again
    await frame();
    expect(status.textContent).toBe('mesma frase');
  });

  it('keeps the interrupting channel separate from the polite one', async () => {
    srAlert('Resolvido em 76 jogadas');
    await frame();
    expect(alert.textContent).toBe('Resolvido em 76 jogadas');
    expect(status.textContent).toBe('');
  });
});

describe('what a move says', () => {
  it('says the tile, the direction and the progress in ONE utterance', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = run.activate(14);
    expect(result.kind).toBe('moved');
    if (result.kind !== 'moved') return;

    srSay(i18n.t('a11y.moved', {
      tile: i18n.describeTile(result.push[0].tile).text,
      dir: i18n.direction(result.push[0].direction),
      have: run.tilesHome(),
      need: 15,
    }));
    await frame();

    const said = status.textContent ?? '';
    expect(said).toContain('15');                       // the tile
    expect(said).toContain('para a direita');           // the direction it travelled
    expect(said).toContain('de 15');                    // the progress, in the same breath
    // ⚠️ ONE sentence. Splitting the count off would queue a second utterance per move.
    expect(said.split('.').filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
  });

  // ⚠️ ONE UTTERANCE FOR A PRESS THAT MOVED THREE TILES. `#sr-status` is `aria-live="polite"`, which
  // QUEUES rather than interrupts — so three sentences for one press would put a listener a press
  // behind the board and keep her there for the rest of the game.
  it('says a three-tile press as ONE sentence, with the count', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = run.activate(12);
    expect(result.kind).toBe('moved');
    if (result.kind !== 'moved') return;
    expect(result.push).toHaveLength(3);

    srSay(i18n.t('a11y.movedMany', {
      count: result.push.length,
      dir: i18n.direction(result.push[0].direction),
      have: run.tilesHome(),
      need: 15,
    }));
    await frame();

    const said = status.textContent ?? '';
    expect(said).toContain('3');
    expect(said).toContain('para a direita');
    expect(said).toContain('de 15');
    // One clause about the move, one about the progress. Never one per tile.
    expect(said.split('.').filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
  });

  it('names how many rather than naming each tile', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const result = run.activate(12);
    if (result.kind !== 'moved') return;
    srSay(i18n.describePush(result.push));
    await frame();
    const said = status.textContent ?? '';
    expect(said).toContain('3');
    // The individual tile numbers would be three facts where the player needs one.
    for (const move of result.push) expect(said).not.toContain(`peça ${move.tile}`);
  });

  it('explains a refusal instead of falling silent', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(run.activate(0).kind).toBe('blocked');
    srSay(i18n.t('a11y.blocked'));
    await frame();
    expect(status.textContent?.trim()).not.toBe('');
  });

  it('names the empty square rather than saying nothing about it', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(run.activate(15).kind).toBe('blank');
    srSay(i18n.t('a11y.blankCell'));
    await frame();
    expect(status.textContent).toContain('vazio');
  });
});

describe('what the hint says', () => {
  it('reads the three moves as one sentence, and only reveals them', async () => {
    const run = createRun({ size: 4, seed: 5, solver, board: solved(4).slice() });
    // Three real moves off the solved board, so the hint has something to say. Taken from
    // `legalMoves` rather than written by hand: three indices picked by eye gave two moves and one
    // refusal, and the assertion below counts them.
    for (let i = 0; i < 3; i++) run.activate(legalMoves(run.board())[0].from);
    const before = run.board();
    const presses = run.hint(3);
    expect(presses.length).toBeGreaterThan(0);

    srSay(i18n.t('a11y.hint', { moves: presses.map((p) => i18n.describePush(p)).join(', ') }));
    await frame();

    const said = status.textContent ?? '';
    // A press of one names its tile; a press of several names how many. Either way it is ONE clause.
    for (const press of presses) {
      if (press.length === 1) expect(said).toContain(String(press[0].tile));
      else expect(said).toContain(String(press.length));
    }
    // ⚠️ IT SHOWS AND DOES NOT PLAY. Requerimento 49.e is the line between delivering the answer
    // instead of the reasoning and revealing it alongside the attempt.
    expect(run.board()).toEqual(before);
    expect(run.moves()).toBe(3);
  });

  it('says so plainly when there is nothing left to hint', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    expect(run.hint()).toEqual([]);
    srSay(i18n.t('a11y.hintNone'));
    await frame();
    expect(status.textContent?.trim()).not.toBe('');
  });
});

describe('the declaration answers in the interface language', () => {
  it('names a tile the way the current locale names it', async () => {
    const run = createRun({ size: 4, seed: 1, solver, board: solved(4) });
    const declaration = createPuzzleDeclaration({ run: () => run, i18n, worldSelector: '#game-region' });
    const name = declaration.nameAt({ x: 0, y: 0 });
    expect(name?.text).toContain('1');
    srSay(name!.text);
    await frame();
    expect(status.textContent).toBe(name!.text);
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// declaration/puzzle-declaration — a sliding puzzle, said in the engine's seven fields.
//
// ========================= THIS IS THE ACCESSIBILITY LAYER =========================
// It looks like plumbing and it is not. The engine's whole bargain (ADR-0027) is that a game which
// declares these seven things gets the screen reader, Libras, the blind-navigation sonar, the
// colour-vision filters and the cane FOR FREE, for any genre. Everything a child who cannot see the
// board will ever learn about it passes through this file.
//
// ========================= THE ROLE MAPPING, AND WHY IT IS NOT ARBITRARY =========================
// `Role` was written for a platformer. It survives a sliding puzzle only if the question is
// answered from the PLAYER's point of view rather than the drawing's:
//
//   goal       THE BLANK. Every legal move in this game ends there. One field, and the sonar
//              becomes a beacon on the only square where anything can happen.
//   structure  a tile already home. Scenery that blocks you, exactly as a wall does — and the
//              solving method literally treats closed rows as walls it must not disturb.
//   key        a tile out of place that CAN slide right now. It satisfies the `gate`, and the gate
//              is the blank.
//   gate       a tile out of place that cannot slide yet. "Barred until a condition", and the
//              condition is the blank arriving. This is real information: a sighted player reads it
//              off proximity in a glance, and without this field a blind player cannot get it at all.
//
// `free`, `hazard`, `climb` and `water` are NEVER returned. Nothing here hurts, nothing is climbed,
// nothing is swum, and there is no square that is both crossable and meaningless. Saying so is
// better than forcing one of them onto a square to avoid an unused branch.
//
// ⚠️ ONE DIVERGENCE FROM THE CHESS CONSUMER, DELIBERATE. It returns `null` from `nameAt` for an
// empty square, because emptiness there is absence. Here emptiness is the game's ONLY moving part,
// and a reader that said nothing about it would hide the most important fact on the board. `nameAt`
// names the blank and returns `null` only for a spot that is not on the grid at all.
//
// ⚠️ AND `topology` IS A GETTER, WHICH THE CONTRACT DID NOT ANTICIPATE. It is declared as a readonly
// VALUE while the other five fields are functions, so a game whose board resizes has no declared way
// to say so. A getter satisfies the type and answers live. Recorded because a future engine
// consumer that CACHED topology would go stale against a resized board — that is the engine's to
// fix (an ADR there, not here: ADR-0068 §5), and this comment is the trail to it.

import type {
  Focus, GameDeclaration, Heading, Objective, Role, Speakable, Spot,
} from '@the-inclusionist/engine/core/contract.js';
import { homeOf, legalMoves, moveOf } from '../puzzle/board.ts';
import { inBounds, indexOf, spotOf } from '../puzzle/types.ts';
import type { Direction } from '../puzzle/types.ts';
import type { Run } from '../puzzle/run.ts';
import type { I18n } from '../i18n/index.ts';

/** Which way a tile would travel, in the engine's compass. Not decoration — see `focusOf`. */
const HEADING: Readonly<Record<Direction, Heading>> = {
  up: 'n', down: 's', left: 'w', right: 'e',
};

export interface DeclarationDeps {
  /** The CURRENT run. A getter, because changing board size discards the run object entirely. */
  run(): Run;
  readonly i18n: I18n;
}

export function createPuzzleDeclaration(deps: DeclarationDeps): GameDeclaration {
  const size = (): number => deps.run().size;

  return {
    get topology() {
      return { kind: 'grid', cols: size(), rows: size() } as const;
    },

    // Where the "no timer" decision LIVES: not merely absent, DECLARED. WCAG 2.2.1 (Timing
    // Adjustable) is inapplicable because of this line, and scanning may take as long as it likes.
    tick: 'player',

    roleAt(at: Spot): Role {
      const n = size();
      // Off the grid is scenery, not open space. The sonar and the cane sweep with whatever spot
      // they are on, and answering 'free' for a square that is not there would invite a child to
      // walk off the board.
      if (!inBounds(at, n)) return 'structure';
      const board = deps.run().board();
      const i = indexOf(at, n);
      const tile = board[i];
      if (tile === 0) return 'goal';
      if (homeOf(tile) === i) return 'structure';
      return moveOf(board, i) ? 'key' : 'gate';
    },

    nameAt(at: Spot): Speakable | null {
      const n = size();
      if (!inBounds(at, n)) return null;
      const tile = deps.run().board()[indexOf(at, n)];
      return tile === 0 ? deps.i18n.describeBlank() : deps.i18n.describeTile(tile);
    },

    focusOf(playerIndex: number): Focus | null {
      // One child. A second index is not "no focus yet" — it is a player who does not exist.
      if (playerIndex !== 0) return null;
      const run = deps.run();
      const i = run.cursor();
      const move = moveOf(run.board(), i);
      // `heading` is the direction the tile under the cursor WOULD travel, which is exactly what
      // the cane wants to know about the thing it is touching. 'none' when it cannot travel.
      return { id: 'cursor', at: spotOf(i, run.size), heading: move ? HEADING[move.direction] : 'none' };
    },

    objectiveOf(playerIndex: number): Objective {
      const run = deps.run();
      return {
        name: deps.i18n.describeObjective(),
        have: playerIndex === 0 ? run.tilesHome() : 0,
        need: run.size * run.size - 1,     // the blank has no home, so it is never part of the count
      };
    },

    /**
     * The tiles that can slide right now — not the blank.
     *
     * The sonar picks the NEAREST target and names it, so handing it the movable tiles makes it
     * name the one the player would actually press. Handing it the blank instead would give one
     * beacon and no choice, which is a poorer sentence for the same work.
     *
     * Empty when solved, and empty is an answer rather than a fault — the contract says so.
     */
    targetsOf(playerIndex: number): readonly Spot[] {
      const run = deps.run();
      if (playerIndex !== 0 || run.solved()) return [];
      return legalMoves(run.board()).map((m) => spotOf(m.from, run.size));
    },
  };
}

/**
 * What a cell says when the reader lands on it: position, then what is there, then what it can do.
 *
 * Position FIRST because it is what orients someone who cannot see the board, and the affordance
 * LAST because a listener interrupts as soon as they have what they came for. That ordering is the
 * engine's own finding in `ui/item-announcement.ts`, which put the index last for the same reason.
 *
 * It lives beside the declaration rather than in the grid because it is the same seven fields said
 * as a sentence — `roleAt` and `nameAt` are what it reads, and nothing else.
 */
export function describeCell(deps: DeclarationDeps, index: number): string {
  const run = deps.run();
  const n = run.size;
  const { x, y } = spotOf(index, n);
  const where = deps.i18n.t('cell.at', { row: y + 1, col: x + 1 });
  const board = run.board();
  const tile = board[index];
  if (tile === 0) return `${where}, ${deps.i18n.t('cell.blank')}`;

  const name = deps.i18n.describeTile(tile).text;
  const settled = deps.i18n.t(homeOf(tile) === index ? 'cell.home' : 'cell.away');
  const move = moveOf(board, index);
  const affordance = move
    ? `, ${deps.i18n.t('cell.movable', { dir: deps.i18n.direction(move.direction) })}`
    : '';
  return `${where}, ${name}, ${settled}${affordance}`;
}

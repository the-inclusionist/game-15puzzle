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
//   key        a tile out of place that CAN slide right now — which, since a click pushes a whole
//              line, is every tile in the blank's row and column. It satisfies the `gate`, and the
//              gate is the blank.
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
// ⚠️ `topology` WAS A GETTER HERE, AND THE ENGINE FIXED THE CONTRACT INSTEAD. It used to be declared
// as a readonly VALUE while its siblings were functions, so a game whose board resizes had no
// declared way to say so; a getter satisfied the type, and a getter that satisfies an interface is a
// TypeScript coincidence rather than a contract — nothing told the next author it had to keep
// answering live. ADR-0084 in the engine made it `topology()`, citing this game as the evidence, so
// the workaround is gone and the field is simply a function like the rest.
//
// ⚠️ AND `world()` IS NEW AND MANDATORY, and it is the other half of the same story. This game's
// visible content is DOM over a canvas, so the engine's empathy modes — which used to spare the DOM
// layer — inverted here: `blind` blacked the canvas and left the numbers perfectly legible. The
// engine's answer is that the GAME says which element is the world, and the engine applies
// world-scoped effects there and only there. Mandatory rather than defaulted, and the record's
// reason for that is worth keeping: blindfold chess exists, so a pure-DOM game is not one where
// empathy makes no sense — it is one where it asks more of whoever writes it.

import type {
  Focus, GameDeclaration, Heading, Objective, Role, Speakable, Spot, Topology, WorldScope,
} from '@the-inclusionist/engine/core/contract.js';
import { homeOf, pushOf, pushableFrom } from '../puzzle/board.ts';
import { inBounds, indexOf, spotOf } from '../puzzle/types.ts';
import type { Direction } from '../puzzle/types.ts';
import type { Run } from '../puzzle/run.ts';
import type { I18n } from '../i18n/index.ts';

/** Which way a tile would travel, in the engine's compass. Not decoration — see `focusOf`. */
const HEADING: Readonly<Record<Direction, Heading>> = {
  up: 'n', down: 's', left: 'w', right: 'e',
};

/**
 * What a SENTENCE about a cell needs, which is less than a declaration needs.
 *
 * Narrower on purpose: `describeCell` reads the board and the language and has no business knowing
 * where the world element is, so a caller that only wants a label should not have to invent one.
 */
export interface CellDeps {
  run(): Run;
  readonly i18n: I18n;
}

export interface DeclarationDeps extends CellDeps {
  /**
   * The selector of the element that IS the game — everything the engine should treat as the world.
   *
   * Injected rather than hardcoded because the host owns its own markup: the same declaration has to
   * be constructible in a test that mounts into a scratch element.
   */
  readonly worldSelector: string;
}

export function createPuzzleDeclaration(deps: DeclarationDeps): GameDeclaration {
  const size = (): number => deps.run().size;

  return {
    topology(): Topology {
      return {
        kind: 'grid',
        size: [size(), size()],
        // ⚠️ THE OTHER DEBT THIS RELEASE CLOSED. `distance` used to be Chebyshev for every grid —
        // king's steps, right for chess and for a platformer — so the sonar under-reported a sliding
        // puzzle by up to half: "two" where the truth was four presses. `move` now carries the
        // metric, and `orthogonal` is L¹. A tile slides along a row or a column and never round a
        // corner, so this is not a preference, it is what the space is.
        move: 'orthogonal',
        // A board is looked at from above: north, south, east, west are the words that mean
        // something here. `clock` is for a side-on platformer, where they do not.
        frame: 'compass',
      };
    },

    /**
     * Both surfaces at once, and that is the point. The board's tiles are drawn into the canvas and
     * their numbers are DOM laid over it, so a world that named only the canvas would let `blind`
     * black the art and leave the numbers readable — a simulation that shows an adult a condition
     * they are not experiencing. The region contains both.
     */
    world(): WorldScope {
      return { kind: 'element', selector: deps.worldSelector };
    },

    /**
     * ONE. Nothing in this game is ever held together with anything else.
     *
     * The unit of play is a PRESS: one tile, one finger, one key. Arrows move the cursor and Enter
     * slides — never at the same time — and on a touch screen the whole interaction is a tap. There
     * is no run-plus-walk-plus-jump here, so there is no chord to be unable to make.
     *
     * ⚠️ AND Ctrl+Home DOES NOT MAKE IT TWO. This field asks what the game REQUIRES, not what it
     * accepts: Home and End work alone, the arrows reach every cell, and the modifier only widens a
     * jump that is already available without it. Counting a convenience as a requirement would
     * report a barrier that is not there, which is the same kind of lie as missing one.
     *
     * FUNCTION and not a value, like `topology` — a game with phases changes what it demands between
     * them. This one does not, and answers the same number every time on purpose.
     */
    holdsAtOnce(): number {
      return 1;
    },

    /**
     * FALSE. Nothing in this game is ever held down.
     *
     * ⚠️ AND `holdsAtOnce` ABOVE DOES NOT ANSWER THIS, which is the finding that made the engine add
     * a second field: that one counts SIMULTANEOUS POSITIONS and refuses zero, so a game that holds
     * nothing still declares one. "One at a time" and "one HELD" are the same number and different
     * facts, and everything downstream was reading the number that answers the other question.
     *
     * Here every input is a discrete press: an arrow steps the cursor one cell, Enter slides once.
     * Holding an arrow does not glide the cursor and holding Enter does not repeat a slide, so
     * latching — the control offered to a player who cannot keep a key down — would be a switch that
     * changes nothing. Offering it would be worse than not having it: a child with a motor
     * difficulty would spend the one affordance she was looking for on a control that does nothing.
     */
    holdsKeys(): boolean {
      return false;
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
      return pushOf(board, i).length > 0 ? 'key' : 'gate';
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
      // `heading` is the direction the tile under the cursor WOULD travel, which is exactly what the
      // cane wants to know about the thing it is touching. Every tile in a push travels the same
      // way, so the first move answers for all of them. 'none' when it cannot travel.
      const direction = pushOf(run.board(), i)[0]?.direction;
      return { id: 'cursor', at: spotOf(i, run.size), heading: direction ? HEADING[direction] : 'none' };
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
     * The tiles that can slide right now — the blank's whole row and column, minus the blank.
     *
     * The sonar picks the NEAREST target and names it, so handing it the movable tiles makes it name
     * one the player could actually press. Handing it the blank instead would give one beacon and no
     * choice, which is a poorer sentence for the same work.
     *
     * ⚠️ THE PUSH WIDENED THIS, and that is the accessibility half of the rules change. It was the
     * two-to-four tiles beside the blank; it is now up to `2(size - 1)` — eight on a 5x5. A sighted
     * player reads that off the board in a glance; without this field a blind player could not get
     * it at all.
     *
     * Empty when solved, and empty is an answer rather than a fault — the contract says so.
     */
    targetsOf(playerIndex: number): readonly Spot[] {
      const run = deps.run();
      if (playerIndex !== 0 || run.solved()) return [];
      return pushableFrom(run.board()).map((i) => spotOf(i, run.size));
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
export function describeCell(deps: CellDeps, index: number): string {
  const run = deps.run();
  const n = run.size;
  const { x, y } = spotOf(index, n);
  const where = deps.i18n.t('cell.at', { row: y + 1, col: x + 1 });
  const board = run.board();
  const tile = board[index];
  if (tile === 0) return `${where}, ${deps.i18n.t('cell.blank')}`;

  const name = deps.i18n.describeTile(tile).text;
  const settled = deps.i18n.t(homeOf(tile) === index ? 'cell.home' : 'cell.away');
  // How many tiles this cell would move, and which way. One is the common case and reads best
  // without a number; more than one has to say how many, because "can slide left" would be the same
  // sentence for a press that moves one tile and a press that moves four.
  const push = pushOf(board, index);
  const affordance = push.length === 0 ? '' : `, ${deps.i18n.t(
    push.length === 1 ? 'cell.movable' : 'cell.movableMany',
    { dir: deps.i18n.direction(push[0].direction), count: push.length },
  )}`;
  return `${where}, ${name}, ${settled}${affordance}`;
}

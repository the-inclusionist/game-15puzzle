// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/en — English. Same key set as pt, which a node test pins: a missing key here degrades to
// Portuguese rather than to nothing, and degrading silently is how a locale stays half-finished.

import type { Catalog } from './types.ts';

const en: Catalog = {
  tile: { text: 'tile', gender: 'n', plural: false },
  blank: { text: 'empty space', gender: 'n', plural: false },
  objective: { text: 'tiles in place', gender: 'n', plural: true },
  tileNamePattern: '{noun} {number}',

  strings: {
    'app.title': 'Sliding puzzle',
    'app.keys': 'Arrows move · Enter slides the tile · K sonar · D hint',
    'title.start': 'Start',
    'title.by': 'by {name}',

    'cell.at': 'row {row}, column {col}',
    'cell.home': 'in place',
    'cell.away': 'out of place',
    'cell.movable': 'can slide {dir}',
    'cell.movableMany': 'can slide {count} tiles {dir}',
    'cell.blank': 'empty space',

    'dir.up': 'up',
    'dir.down': 'down',
    'dir.left': 'left',
    'dir.right': 'right',

    'a11y.boardLabel': 'Sliding puzzle, {size} by {size}',
    'a11y.gridHint': 'Arrows move, Enter slides the tile',
    'a11y.moved': '{tile} {dir}. {have} of {need} in place',
    'a11y.movedMany': '{count} tiles {dir}. {have} of {need} in place',
    'a11y.blocked': 'That tile cannot slide right now',
    'a11y.blankCell': 'Empty space. Nothing slides from here',
    'a11y.shuffled': 'Shuffled. {size} by {size}, {need} tiles',
    'a11y.sizeChanged': 'Board {size} by {size}. New game',
    'a11y.hint': 'Next moves: {moves}',
    'a11y.hintNone': 'Already solved',
    'a11y.move': '{tile} {dir}',
    'a11y.moveMany': '{count} tiles {dir}',
    'status.solved': 'Solved in {moves} moves',
    'status.crashed': 'The game stopped. Reload the page',

    'hud.size': 'Board size',
    'hud.shuffle': 'Shuffle',
    'hud.hint': 'Show the next moves',
    'empathy.open': 'Try it out',
    'empathy.openLong': 'Try out how other people see',
    'empathy.title': 'How other people see',
    'empathy.intro': 'Pick a way of seeing and play like that. Nothing changes for good: come back to "None" whenever you want.',
    'empathy.legend': 'Way of seeing',
    'empathy.none': 'None',
    'empathy.noneHint': 'Play the usual way.',
    'empathy.close': 'Close',
    'empathy.blocked.tema': 'Unavailable while high contrast is on.',
    'empathy.blocked.correcao': 'Unavailable while colour correction is on.',
    'empathy.blocked.ambos': 'Unavailable while high contrast and colour correction are on.',
    'hud.hintShort': 'Hint',
    'hud.highContrast': 'High contrast',
    'hud.vision': 'Colour vision',
    'hud.reducedMotion': 'Reduced motion',
    'size.3': '3 by 3, 8 tiles',
    'size.4': '4 by 4, 15 tiles',
    'size.5': '5 by 5, 24 tiles',


    // ---- ADR-0153 accommodation (hints) ---------------------------------------
    'accom.hints.label': 'Hints',
    'accom.hints.hint': 'Shows the next three tiles to move.',

    // ---- ADR-0074 preset words -----------------------------------------------
    'preset.up.label': 'Up',
    'preset.down.label': 'Down',
    'preset.left.label': 'Left',
    'preset.right.label': 'Right',
    'preset.action1.label': 'Slide',
    'preset.action1.hint': 'Slides the tile under the cursor into the empty square.',


    // ---- Engine HUD numbers --------------------------------------------------
    'hud.moves': 'Moves',
    'hud.progress': 'Tiles home',

    // ---- action3 (Hint) and action4 (Shuffle) --------------------------------
    'preset.action3.label': 'Hint',
    'preset.action3.hint': 'Lights up the next tiles to move.',
    'preset.action4.label': 'Shuffle',
    'preset.action4.hint': 'Starts a new round on a scrambled board.',

    // ---- gameOptions ---------------------------------------------------------
    'game-options.size.label': 'Board size',
    'game-options.size.hint': 'More tiles teach you to solve in bigger steps.',
    'game-options.motion.label': 'Reduced motion',
    'game-options.motion.hint': 'Turns the slide animation off. Tiles teleport.',

    // ---- howToPlay slides ----------------------------------------------------
    'howto.slide1': 'Slide a tile into the empty square next to it.',
    'howto.slide2': 'Click a distant tile in the same row or column to push several at once.',
    'howto.slide3': 'Ask for a hint any time. It shows the next tiles — it does not play them for you.',

    'legal.licence': 'Free software under AGPL-3.0-or-later.',
    'legal.source': 'Source code',
  },
};

export default en;

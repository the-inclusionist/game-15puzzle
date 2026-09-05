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

    'cell.at': 'row {row}, column {col}',
    'cell.home': 'in place',
    'cell.away': 'out of place',
    'cell.movable': 'can slide {dir}',
    'cell.blank': 'empty space',

    'dir.up': 'up',
    'dir.down': 'down',
    'dir.left': 'left',
    'dir.right': 'right',

    'a11y.boardLabel': 'Sliding puzzle, {size} by {size}',
    'a11y.gridHint': 'Arrows move, Enter slides the tile',
    'a11y.moved': '{tile} {dir}. {have} of {need} in place',
    'a11y.blocked': 'That tile cannot slide right now',
    'a11y.blankCell': 'Empty space. Nothing slides from here',
    'a11y.shuffled': 'Shuffled. {size} by {size}, {need} tiles',
    'a11y.sizeChanged': 'Board {size} by {size}. New game',
    'a11y.hint': 'Next moves: {moves}',
    'a11y.hintNone': 'Already solved',
    'a11y.move': '{tile} {dir}',
    'status.solved': 'Solved in {moves} moves',
    'status.crashed': 'The game stopped. Reload the page',

    'hud.moves': 'Moves',
    'hud.progress': '{have} of {need} in place',
    'hud.size': 'Board size',
    'hud.shuffle': 'Shuffle',
    'hud.hint': 'Show the next moves',
    'hud.hintShort': 'Hint',
    'hud.highContrast': 'High contrast',
    'hud.vision': 'Colour vision',
    'hud.reducedMotion': 'Reduced motion',
    'size.3': '3 by 3, 8 tiles',
    'size.4': '4 by 4, 15 tiles',
    'size.5': '5 by 5, 24 tiles',

    'legal.licence': 'Free software under AGPL-3.0-or-later.',
    'legal.source': 'Source code',
  },
};

export default en;

// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/es — Spanish. Same key set as pt; the nouns carry gender because the frames agree with them,
// exactly as in Portuguese and unlike English.

import type { Catalog } from './types.ts';

const es: Catalog = {
  tile: { text: 'ficha', gender: 'f', plural: false },
  blank: { text: 'espacio vacío', gender: 'm', plural: false },
  objective: { text: 'fichas en su lugar', gender: 'f', plural: true },
  tileNamePattern: '{noun} {number}',

  strings: {
    'app.title': 'Rompecabezas deslizante',
    'app.keys': 'Flechas navegan · Enter desliza la ficha · K sonar · D pista',

    'cell.at': 'fila {row}, columna {col}',
    'cell.home': 'en su lugar',
    'cell.away': 'fuera de lugar',
    'cell.movable': 'puede deslizarse {dir}',
    'cell.movableMany': 'puede deslizar {count} fichas {dir}',
    'cell.blank': 'espacio vacío',

    'dir.up': 'hacia arriba',
    'dir.down': 'hacia abajo',
    'dir.left': 'hacia la izquierda',
    'dir.right': 'hacia la derecha',

    'a11y.boardLabel': 'Rompecabezas deslizante, {size} por {size}',
    'a11y.gridHint': 'Flechas navegan, Enter desliza la ficha',
    'a11y.moved': '{tile} {dir}. {have} de {need} en su lugar',
    'a11y.movedMany': '{count} fichas {dir}. {have} de {need} en su lugar',
    'a11y.blocked': 'Esta ficha no puede deslizarse ahora',
    'a11y.blankCell': 'Espacio vacío. Nada se desliza desde aquí',
    'a11y.shuffled': 'Mezclado. {size} por {size}, {need} fichas',
    'a11y.sizeChanged': 'Tablero {size} por {size}. Juego nuevo',
    'a11y.hint': 'Próximas jugadas: {moves}',
    'a11y.hintNone': 'Ya está resuelto',
    'a11y.move': '{tile} {dir}',
    'a11y.moveMany': '{count} fichas {dir}',
    'status.solved': 'Resuelto en {moves} jugadas',
    'status.crashed': 'El juego se detuvo. Recargue la página',

    'hud.moves': 'Jugadas',
    'hud.progress': '{have} de {need} en su lugar',
    'hud.size': 'Tamaño del tablero',
    'hud.shuffle': 'Mezclar',
    'hud.hint': 'Mostrar las próximas jugadas',
    'hud.hintShort': 'Pista',
    'hud.highContrast': 'Alto contraste',
    'hud.vision': 'Visión de colores',
    'hud.reducedMotion': 'Movimiento reducido',
    'size.3': '3 por 3, 8 fichas',
    'size.4': '4 por 4, 15 fichas',
    'size.5': '5 por 5, 24 fichas',

    'legal.licence': 'Software libre bajo AGPL-3.0-or-later.',
    'legal.source': 'Código fuente',
  },
};

export default es;

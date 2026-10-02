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
    'title.start': 'Comenzar',
    'title.by': 'por {name}',

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

    'hud.size': 'Tamaño del tablero',
    'hud.shuffle': 'Mezclar',
    'hud.hint': 'Mostrar las próximas jugadas',
    'empathy.open': 'Experimentar',
    'empathy.openLong': 'Experimentar cómo ven otras personas',
    'empathy.title': 'Cómo ven otras personas',
    'empathy.intro': 'Elige una manera de ver y juega así. Nada cambia para siempre: vuelve a «Ninguna» cuando quieras.',
    'empathy.legend': 'Manera de ver',
    'empathy.none': 'Ninguna',
    'empathy.noneHint': 'Jugar como siempre.',
    'empathy.close': 'Cerrar',
    'empathy.blocked.tema': 'No disponible mientras el alto contraste esté activado.',
    'empathy.blocked.correcao': 'No disponible mientras la corrección de color esté activada.',
    'empathy.blocked.ambos': 'No disponible mientras el alto contraste y la corrección de color estén activados.',
    'hud.hintShort': 'Pista',
    'hud.highContrast': 'Alto contraste',
    'hud.vision': 'Visión de colores',
    'hud.reducedMotion': 'Movimiento reducido',
    'size.3': '3 por 3, 8 fichas',
    'size.4': '4 por 4, 15 fichas',
    'size.5': '5 por 5, 24 fichas',


    // ---- ADR-0153 acomodación (pistas) ---------------------------------------
    'accom.hints.label': 'Pistas',
    'accom.hints.hint': 'Muestra las próximas tres piezas que mover.',

    // ---- ADR-0074 vocabulario del preset --------------------------------------
    'preset.up.label': 'Arriba',
    'preset.down.label': 'Abajo',
    'preset.left.label': 'Izquierda',
    'preset.right.label': 'Derecha',
    'preset.action1.label': 'Deslizar',
    'preset.action1.hint': 'Desliza la pieza bajo el cursor al hueco.',


    // ---- Números del HUD de la engine ----------------------------------------
    'hud.moves': 'Movimientos',
    'hud.progress': 'Piezas en su sitio',

    // ---- action3 (Pista) y action4 (Mezclar) ---------------------------------
    'preset.action3.label': 'Pista',
    'preset.action3.hint': 'Ilumina las próximas piezas que mover.',
    'preset.action4.label': 'Mezclar',
    'preset.action4.hint': 'Empieza una partida nueva con un tablero mezclado.',

    // ---- gameOptions ---------------------------------------------------------
    'game-options.size.label': 'Tamaño del tablero',
    'game-options.size.hint': 'Más piezas enseñan a resolver en pasos mayores.',
    'game-options.motion.label': 'Movimiento reducido',
    'game-options.motion.hint': 'Apaga la animación del deslizamiento. Las piezas se teletransportan.',

    // ---- howToPlay -----------------------------------------------------------
    'howto.slide1': 'Desliza una pieza al hueco contiguo.',
    'howto.slide2': 'Pulsa una pieza lejana en la misma fila o columna para empujar varias a la vez.',
    'howto.slide3': 'Pide una pista cuando quieras. Muestra las próximas piezas; no las juega por ti.',

    'legal.licence': 'Software libre bajo AGPL-3.0-or-later.',
    'legal.source': 'Código fuente',
  },
};

export default es;

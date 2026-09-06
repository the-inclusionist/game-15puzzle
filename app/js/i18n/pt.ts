// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/pt — Portuguese (Brazil). The base locale: every other catalogue falls back to this one,
// key by key, through the engine's five-step resolution chain.
//
// A sliding puzzle is not a language subject, so EVERYTHING here translates — the numbers included.
// The frontier rule in the engine's CLAUDE.md reserves "the content crosses untranslated" for
// activities where the language IS the subject matter, and it says in as many words that
// mathematics is not one of them.

import type { Catalog } from './types.ts';

const pt: Catalog = {
  tile: { text: 'peça', gender: 'f', plural: false },
  blank: { text: 'espaço vazio', gender: 'm', plural: false },
  objective: { text: 'peças no lugar', gender: 'f', plural: true },
  tileNamePattern: '{noun} {number}',

  strings: {
    'app.title': 'Quebra-cabeça deslizante',
    'app.keys': 'Setas navegam · Enter desliza a peça · K sonar · D dica',

    // ---- what a cell says when the reader lands on it -------------------------------------
    // Position first, because it is what orients someone who cannot see the board; then what is
    // there; then what it can do. A listener interrupts as soon as they have what they came for.
    'cell.at': 'linha {row}, coluna {col}',
    'cell.home': 'no lugar',
    'cell.away': 'fora do lugar',
    'cell.movable': 'pode deslizar {dir}',
    'cell.movableMany': 'pode deslizar {count} peças {dir}',
    'cell.blank': 'espaço vazio',

    'dir.up': 'para cima',
    'dir.down': 'para baixo',
    'dir.left': 'para a esquerda',
    'dir.right': 'para a direita',

    // ---- announcements --------------------------------------------------------------------
    'a11y.boardLabel': 'Quebra-cabeça deslizante, {size} por {size}',
    'a11y.gridHint': 'Setas navegam, Enter desliza a peça',
    'a11y.moved': '{tile} {dir}. {have} de {need} no lugar',
    'a11y.movedMany': '{count} peças {dir}. {have} de {need} no lugar',
    'a11y.blocked': 'Esta peça não pode deslizar agora',
    'a11y.blankCell': 'Espaço vazio. Nada desliza daqui',
    'a11y.shuffled': 'Embaralhado. {size} por {size}, {need} peças',
    'a11y.sizeChanged': 'Tabuleiro {size} por {size}. Jogo novo',
    'a11y.hint': 'Próximas jogadas: {moves}',
    'a11y.hintNone': 'Já está resolvido',
    'a11y.move': '{tile} {dir}',
    'a11y.moveMany': '{count} peças {dir}',
    'status.solved': 'Resolvido em {moves} jogadas',
    'status.crashed': 'O jogo parou. Recarregue a página',

    // ---- the panel ------------------------------------------------------------------------
    'hud.moves': 'Jogadas',
    'hud.progress': '{have} de {need} no lugar',
    'hud.size': 'Tamanho do tabuleiro',
    'hud.shuffle': 'Embaralhar',
    'hud.hint': 'Mostrar as próximas jogadas',
    'hud.hintShort': 'Dica',
    'hud.highContrast': 'Alto contraste',
    'hud.vision': 'Visão de cores',
    'hud.reducedMotion': 'Movimento reduzido',
    'size.3': '3 por 3, 8 peças',
    'size.4': '4 por 4, 15 peças',
    'size.5': '5 por 5, 24 peças',

    // ---- AGPL section 13 ------------------------------------------------------------------
    // The obligation the licence creates, as something a player can act on. See docs/LICENSES.md.
    'legal.licence': 'Software livre sob AGPL-3.0-or-later.',
    'legal.source': 'Código-fonte',
  },
};

export default pt;

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
    'title.start': 'Iniciar',
    'title.by': 'por {name}',

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
    'hud.size': 'Tamanho do tabuleiro',
    'hud.shuffle': 'Embaralhar',
    'hud.hint': 'Mostrar as próximas jogadas',
    'empathy.open': 'Experimentar',
    'empathy.openLong': 'Experimentar como outras pessoas enxergam',
    'empathy.title': 'Como outras pessoas enxergam',
    'empathy.intro': 'Escolha um jeito de enxergar e jogue assim. Nada muda para sempre: volte em «Nenhuma» quando quiser.',
    'empathy.legend': 'Jeito de enxergar',
    'empathy.none': 'Nenhuma',
    'empathy.noneHint': 'Jogar do jeito de sempre.',
    'empathy.close': 'Fechar',
    'empathy.blocked.tema': 'Indisponível enquanto o alto contraste estiver ligado.',
    'empathy.blocked.correcao': 'Indisponível enquanto a correção de cor estiver ligada.',
    'empathy.blocked.ambos': 'Indisponível enquanto o alto contraste e a correção de cor estiverem ligados.',
    'hud.hintShort': 'Dica',
    'hud.highContrast': 'Alto contraste',
    'hud.vision': 'Visão de cores',
    'hud.reducedMotion': 'Movimento reduzido',
    'size.3': '3 por 3, 8 peças',
    'size.4': '4 por 4, 15 peças',
    'size.5': '5 por 5, 24 peças',


    // ---- ADR-0153 accommodation (hints), engine-drawn row --------------------
    'accom.hints.label': 'Dicas',
    'accom.hints.hint': 'Mostra as próximas três peças a mover.',

    // ---- ADR-0074 preset words for the five positions this game uses ---------
    'preset.up.label': 'Para cima',
    'preset.down.label': 'Para baixo',
    'preset.left.label': 'Para a esquerda',
    'preset.right.label': 'Para a direita',
    'preset.action1.label': 'Deslizar',
    'preset.action1.hint': 'Desliza a peça sob o cursor para o espaço vazio.',


    // ---- Engine HUD numbers (ADR-0168/0175) ----------------------------------
    'hud.moves': 'Movimentos',
    'hud.progress': 'Peças no lugar',

    // ---- action3 (Dica) and action4 (Embaralhar), engine-driven ---------------
    'preset.action3.label': 'Dica',
    'preset.action3.hint': 'Ilumina as próximas peças a mover.',
    'preset.action4.label': 'Embaralhar',
    'preset.action4.hint': 'Começa uma partida nova em um tabuleiro embaralhado.',

    // ---- gameOptions, engine-drawn rows (ADR-0182) ---------------------------
    'game-options.size.label': 'Tamanho do tabuleiro',
    'game-options.size.hint': 'Mais peças ensinam a resolver em passos maiores.',
    'game-options.motion.label': 'Movimento reduzido',
    'game-options.motion.hint': 'Desliga a animação do deslize. As peças teleportam.',

    // ---- howToPlay slides (ADR-0195) -----------------------------------------
    'howto.slide1': 'Deslize uma peça para o espaço vazio ao lado dela.',
    'howto.slide2': 'Clique em uma peça distante na mesma linha ou coluna para empurrar várias de uma vez.',
    'howto.slide3': 'Peça dica a qualquer altura. Ela mostra as próximas peças; não as joga por você.',

    // ---- AGPL section 13 ------------------------------------------------------------------
    // The obligation the licence creates, as something a player can act on. See docs/LICENSES.md.
    'legal.licence': 'Software livre sob AGPL-3.0-or-later.',
    'legal.source': 'Código-fonte',
  },
};

export default pt;

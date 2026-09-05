// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/types — the shape of a catalogue.
//
// ========================= WHY A NOUN CARRIES GENDER =========================
// Not grammatical fussiness. In pt-BR the FRAME agrees with the CONTENT: "a peça 7 está no lugar"
// and "o espaço vazio está no lugar" are the same engine sentence with the same parameter, and one
// of them is wrong if the frame does not know what it is talking about. English needs none of this
// and Spanish needs all of it, which is exactly why it lives in the catalogue rather than in code.
//
// The engine's `Speakable` (core/contract.ts) carries the same three fields for the same reason,
// and its own note is the sharper one: without a name there is no screen reader AND NO LIBRAS,
// because vlibrasSay translates TEXT. One datum, two outputs.

export type Gender = 'm' | 'f' | 'n';

/** The three locales this game ships. pt is the base; the others fall back to it, key by key. */
export type LocaleCode = 'pt' | 'en' | 'es';

export interface Noun {
  readonly text: string;
  readonly gender: Gender;
  readonly plural: boolean;
}

export interface Catalog {
  /**
   * The three nouns the game has to inflect around. Everything else is a flat string, because every
   * other sentence here is written to sidestep agreement — "{tile} {dir}" gives "peça 7 para a
   * esquerda" and never "peça 7 deslizada", which would need to agree and would be one more thing
   * to get wrong in three languages.
   */
  readonly tile: Noun;
  readonly blank: Noun;
  readonly objective: Noun;
  /**
   * How a tile is named. DATA, not a hardcoded order: a language that puts the number first is a
   * catalogue edit rather than a code change, and none of the three here happens to need it.
   */
  readonly tileNamePattern: string;
  readonly strings: Readonly<Record<string, string>>;
}

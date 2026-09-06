// SPDX-License-Identifier: AGPL-3.0-or-later
// render/palette — the colours, and the reason each pair of them is far enough apart.
//
// ========================= COLOUR IS NEVER THE ONLY CARRIER =========================
// WCAG 1.4.1, and here it bites in a specific place: a settled tile has to be distinguishable from
// an unsettled one. Two hues would do it for most people and for nobody with a colour-vision
// difference, and the engine's own simulation modes would show that immediately.
//
// So the difference is carried TWICE, and the second carrier is a shape:
//   · VALUE — a settled tile is darker than an unsettled one. Value survives every colour-vision
//     filter the engine applies, because those filters remap hue and leave luminance nearly alone.
//   · A SECOND BEVEL — a settled tile is drawn with an inset line the others do not have. That one
//     survives a monochrome screen, a printout, and forced-colors mode.
//
// ========================= AND THE RATIOS ARE MEASURED, NOT ESTIMATED =========================
// `palette.node.test.ts` computes every ratio below from these hex values and fails on any that
// falls short. Estimating contrast by eye is how a palette passes review and fails axe.
//
//   digit on tile   >= 4.5:1   WCAG 1.4.3 — it is text, and it is the game's only text
//   tile on well    >= 3.0:1   WCAG 1.4.11 — a tile is a graphical object you have to find
//   settled vs not  >= 1.5:1   not a WCAG floor; the value step has to be VISIBLE, and this is
//                              the smallest step that reads as one at 320x180

export interface Palette {
  readonly name: 'normal' | 'high';
  readonly backdrop: string;
  /** The tray's bevel: light on top and left, dark on bottom and right, so it reads as recessed. */
  readonly trayHi: string;
  readonly trayLo: string;
  /** The checkerboard the upstream had. It is what shows through where the blank is. */
  readonly wellA: string;
  readonly wellB: string;
  /** A tile still looking for its place. */
  readonly tileAway: string;
  /** A tile that has found it. Darker, and drawn with the extra inset line. */
  readonly tileHome: string;
  readonly tileHi: string;
  readonly tileLo: string;
  /** The digit. One ink for both tile states — which is why both must clear 4.5:1 against it. */
  readonly ink: string;
  /** Focus ring, hint marker, and the outline on a tile that can slide. */
  readonly accent: string;
}

export const NORMAL: Palette = {
  name: 'normal',
  backdrop: '#10141c',
  trayHi: '#39435a',
  trayLo: '#0b0e14',
  wellA: '#232b39',
  wellB: '#1b2230',
  tileAway: '#e8e3d3',
  tileHome: '#a29d8e',
  tileHi: '#fdf9ec',
  tileLo: '#6f6b60',
  ink: '#16181c',
  accent: '#ffd97d',
};

/**
 * ⚠️ NOT simply "more contrast". High contrast inverts the tile states — a settled tile becomes
 * black-on-white's opposite — so the value step is the largest it can be while both states keep
 * 21:1 against their own ink. The well stays black and the tray line white, which is what makes a
 * tile findable at all when everything is either #000 or #fff.
 *
 * The extra inset line on a settled tile is what still distinguishes the two under forced-colors,
 * where the browser overrides these values entirely and nothing in this table applies.
 */
export const HIGH: Palette = {
  name: 'high',
  backdrop: '#000000',
  trayHi: '#ffffff',
  trayLo: '#ffffff',
  wellA: '#000000',
  wellB: '#000000',
  tileAway: '#ffffff',
  // ⚠️ NOT a bright yellow, which is the obvious high-contrast choice and the wrong one here. A
  // saturated yellow sits at a relative luminance near 0.8 — a ratio of 1.27 against white, which
  // the eye reads as "both are the light one". This amber lands near 0.38: 8.6:1 against the black
  // ink and the black well, and 2.4:1 against an unsettled tile, so the VALUE step survives.
  tileHome: '#d99b00',
  tileHi: '#ffffff',
  tileLo: '#ffffff',
  ink: '#000000',
  accent: '#00e5ff',
};

export const PALETTES = { normal: NORMAL, high: HIGH } as const;
export type PaletteName = keyof typeof PALETTES;

/** sRGB relative luminance, WCAG 2.x definition. Exported because the test measures with it. */
export function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const channel = (i: number): number => {
    const v = parseInt(n.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour an element of `colour` at `alpha` actually shows against `behind`.
 *
 * ⚠️ A FADED ELEMENT IS NOT THE COLOUR IT DECLARES, and that is a whole class of contrast bug that
 * review-by-eye cannot see: the eye watches the bright instant of a pulse and axe samples the dim
 * one. Browsers composite in sRGB rather than in linear light, so this mixes the 0..255 channels
 * directly — which is what makes the result match what the accessibility checker measures.
 */
export function composite(colour: string, alpha: number, behind: string): string {
  const channels = (hex: string): number[] => {
    const n = hex.replace('#', '');
    return [0, 1, 2].map((i) => parseInt(n.slice(i * 2, i * 2 + 2), 16));
  };
  const [fr, fg, fb] = channels(colour);
  const [br, bg, bb] = channels(behind);
  const mix = (f: number, b: number): string =>
    Math.round(f * alpha + b * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${mix(fr, br)}${mix(fg, bg)}${mix(fb, bb)}`;
}

/**
 * The dimmest point of the title screen's pulse, as a fraction.
 *
 * ⚠️ WRITTEN TWICE ON PURPOSE — here and in `@keyframes title-breathe`. CSS cannot import this, so
 * the test asserts the stylesheet still says the same number. Two copies that are checked against
 * each other beat one copy nobody can reach from the place that has to reason about it.
 */
export const TITLE_PULSE_FLOOR = 0.6;

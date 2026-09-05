// SPDX-License-Identifier: AGPL-3.0-or-later
// puzzle/rng — a seeded generator, as a FACTORY.
//
// ========================= WHY THIS IS NOT THE ENGINE'S =========================
// The engine has `core/rng.ts` and this game may not use it. It is `let _seed` at module scope,
// and it is SHARED: `render/fx.ts` draws from the same stream for every dust particle. So a
// "deterministic shuffle from seed S" driven by it is deterministic only on a page where nothing
// else draws — and the whole point of the engine is that the platformer might be on that page.
//
// ADR-0038 already says what the shape should be: "a module that holds state exports a createX()
// factory". `core/rng.ts` is one of the modules that record staged for conversion and has not been
// converted. When it is, this file should be DELETED and the import moved. That is the trigger,
// written down so it is not left behind.
//
// ========================= AND THE ARITHMETIC IS DELIBERATELY DIFFERENT =========================
// The engine computes `_seed * 1103515245 + 12345`. With `_seed` up to 2^31 that product reaches
// about 2.4e18, past the 2^53 where a JavaScript double stops being able to hold an integer
// exactly — so the low bits, which are the ones `& 0x7fffffff` keeps, are rounded away before the
// mask ever runs. The result is still perfectly REPRODUCIBLE (float arithmetic is deterministic),
// which is why nobody has noticed and why nothing downstream is wrong today. It is simply a worse
// generator than it was written to be.
//
// `Math.imul` does the same multiply in exact 32-bit arithmetic. Matching the engine's sequence
// byte for byte would mean importing that defect for the sake of a resemblance nothing reads.
// ADR-0049 asks for determinism, not for the platformer's particular stream.

export interface Rng {
  /** The next value in [0, 1). */
  next(): number;
  /** A whole number in [lo, hi], both ends included. */
  int(lo: number, hi: number): number;
}

export function createRng(seed: number): Rng {
  // `>>> 0` makes any input a 32-bit unsigned; `|| 1` keeps a zero seed from parking the LCG on a
  // fixed point, which for this multiplier is exactly what a zero state would do.
  let s = (seed >>> 0) || 1;

  const next = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    // The top bits of an LCG are the well-behaved ones; the bottom bit alternates with period 2.
    // Dropping the low 8 keeps 24 bits, which is more than a board of 25 cells will ever ask for.
    return (s >>> 8) / 0x1000000;
  };

  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
  };
}

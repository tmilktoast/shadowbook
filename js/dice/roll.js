// Generic, game-agnostic dice engine. SRA 2.0-specific pool/hit-counting
// logic builds on top of this in ./sra.js once the rules are settled.

export function randInt(min, max) {
  // inclusive of both min and max
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * A standard NdX roll (num dice of sides, e.g. 3d6).
 * Returns a structured result rather than just a total, so callers can
 * decide how to display or score the individual rolls.
 */
export function rollBasic({ num = 1, sides = 6 } = {}) {
  const rolls = Array.from({ length: num }, () => randInt(1, sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { num, sides, rolls, sum };
}

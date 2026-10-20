// Shadowrun: Anarchy 2.0 dice pool scoring. The basic Test: roll a pool of
// d6s (Attribute + Skill, +2 if specialized); 5s and 6s are hits.
//
// Risk Dice (core rulebook, "On every Test, the player may replace some of
// their dice with Risk Dice"): the player freely picks how many of the
// pool's dice are Risk Dice (0 up to the full pool — the book's own "How
// Many Risk Dice?" table is explicitly "indicative only", never a formula,
// so it's not modeled here, just shown as a reference in the UI). Risk
// Dice hits count double; a 1 on a Risk Die is a glitch, and Risk
// Reduction (RR) cancels up to RR 1s before the glitch tier is read off:
// 0 -> no effect, 1 -> minor glitch, 2 -> critical glitch, 3+ -> disaster.

import { rollBasic } from "./roll.js";

export const HIT_VALUES = [5, 6];
export const SPECIALIZATION_BONUS = 2;

export function isHit(value) {
  return HIT_VALUES.includes(value);
}

/** Rolls a pool of d6s and counts hits (5s and 6s). */
export function rollDicePool(pool) {
  const { rolls } = rollBasic({ num: pool, sides: 6 });
  const hits = rolls.filter(isHit).length;
  return { rolls, hits };
}

export function getGlitchTier(effectiveOnes) {
  if (effectiveOnes <= 0) return "No effect";
  if (effectiveOnes === 1) return "Minor glitch";
  if (effectiveOnes === 2) return "Critical glitch";
  return "Disaster";
}

/**
 * Rolls a Test's pool, some of it as Risk Dice.
 * @param {Object} options
 * @param {number} options.pool - total dice (Attribute + Skill + spec bonus)
 * @param {number} [options.riskDice] - how many of the pool are Risk Dice
 * @param {number} [options.rr] - Risk Reduction, cancels up to this many
 *   1s rolled on Risk Dice
 */
export function rollRiskPool({ pool, riskDice = 0, rr = 0 }) {
  const riskCount = Math.max(0, Math.min(pool, riskDice));
  const normalCount = pool - riskCount;

  const { rolls: normalRolls } = rollBasic({ num: normalCount, sides: 6 });
  const { rolls: riskRolls } = rollBasic({ num: riskCount, sides: 6 });

  const normalHits = normalRolls.filter(isHit).length;
  const riskHits = riskRolls.filter(isHit).length * 2; // Risk Dice hits count twice
  const totalHits = normalHits + riskHits;

  const onesRolled = riskRolls.filter((v) => v === 1).length;
  const onesCancelled = Math.min(onesRolled, Math.max(0, rr));
  const effectiveOnes = onesRolled - onesCancelled;

  return {
    normalRolls,
    riskRolls,
    normalHits,
    riskHits,
    totalHits,
    onesRolled,
    onesCancelled,
    effectiveOnes,
    glitchTier: getGlitchTier(effectiveOnes),
  };
}

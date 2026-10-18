// Essence: starts at 6 and drops with each cyberware/bioware implant.
// Not an attribute — it isn't bought, and its only role is the
// cumulative penalties below. It's derived from the character's implant
// Amps rather than stored, so it can't drift out of sync with them.

import ESSENCE from "./data/essence.json";
import { essenceLoss } from "./amps.js";

export const STARTING_ESSENCE = ESSENCE.start;

export function getEssence(character) {
  return STARTING_ESSENCE - essenceLoss(character);
}

// Every penalty that applies at the given Essence, mildest first.
export function getEssenceEffects(essence) {
  return ESSENCE.thresholds.filter((t) => essence <= t.atOrBelow);
}

// Wound thresholds (core book, "Wound Thresholds"): the final DV needed to
// cause each wound tier. Not stored on the character — computed, same as
// Essence — from the resisting Attribute plus Protection (armor):
//
//   DV >  Attribute + Protection + 6  -> incapacitated
//   DV >  Attribute + Protection + 3  -> serious wound
//   DV >  Attribute + Protection      -> light wound
//   DV <= Attribute + Protection      -> no damage
//
// Physical damage resists with Strength (+ Armor); mental damage resists
// with Willpower (+ any specific mental protection, rare, not modeled yet).

const SERIOUS_OFFSET = 3;
const INCAP_OFFSET = 6;

function thresholdsFor(attributeRating, protection = 0) {
  const light = attributeRating + protection;
  return { light, serious: light + SERIOUS_OFFSET, incap: light + INCAP_OFFSET };
}

export function getPhysicalThresholds(character, protection = 0) {
  return thresholdsFor(character.attributes.strength, protection);
}

export function getMentalThresholds(character, protection = 0) {
  return thresholdsFor(character.attributes.willpower, protection);
}

// The sheet's usual rows: no armor, main armor, secondary armor, mental.
// Skips an armor row entirely when that slot is empty.
export function getWoundTable(character) {
  const { main, secondary } = character.armor ?? {};
  return [
    { label: "No armor", ...getPhysicalThresholds(character, 0) },
    main && {
      label: `Main armor (${main.name} ${main.rating})`,
      ...getPhysicalThresholds(character, main.rating),
    },
    secondary && {
      label: `Secondary armor (${secondary.name} ${secondary.rating})`,
      ...getPhysicalThresholds(character, secondary.rating),
    },
    { label: "Mental", ...getMentalThresholds(character, 0) },
  ].filter(Boolean);
}

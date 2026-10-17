// The character data model for a single Shadowrun Anarchy 2.0 character.
//
// createCharacter() returns a fresh, blank character rather than this file
// exporting one shared object — the Character Database will eventually
// hold many of these, so each one needs to be independent.
//
// Attributes match the Anarchy 2.0 character sheet (reference/): Strength,
// Agility, Willpower, Logic, Charisma, and Edge. Essence is tracked
// separately below, same as on the sheet, since it cancels magic/healing
// hits rather than being spent like the others.
export function createCharacter() {
  return {
    streetname: "",
    metatype: "",
    attributes: {
      strength: 0,
      agility: 0,
      willpower: 0,
      logic: 0,
      charisma: 0,
      edge: 0,
    },
    essence: 6,
    nuyen: 0,
    skills: [], // shape TBD once skill rules (Rating, +Attribute, DP, RR) are settled
    specializations: [], // shape TBD

    // Keywords, Dispositions, and Cues are each just a list of short text
    // entries on the sheet — see the pregen examples in reference/. Keywords
    // in particular look like they follow a pattern (origin, location,
    // archetype, specialty, lifestyle in Noonchi's sheet), but that's from
    // one example; worth revisiting once more of the rules are read.
    keywords: [],
    dispositions: [],
    cues: [],
  };
}

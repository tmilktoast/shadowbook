// "Normie" names — for people outside shadowrunner culture, who go by an
// ordinary given name + surname rather than a streetname (see
// ./streetname.js for that side of it). Pulls from small, curated
// per-culture lists in ./data/cultures/ rather than a huge census dataset.

import { randInt } from "../dice/roll.js";
import american from "./data/cultures/american.json";
import hispanic from "./data/cultures/hispanic.json";
import french from "./data/cultures/french.json";
import japanese from "./data/cultures/japanese.json";
import chinese from "./data/cultures/chinese.json";
import korean from "./data/cultures/korean.json";
import pueblo from "./data/cultures/pueblo.json";
import salishShidhe from "./data/cultures/salish-shidhe.json";
import sioux from "./data/cultures/sioux.json";
import ute from "./data/cultures/ute.json";

export const CULTURES = {
  american,
  hispanic,
  french,
  japanese,
  chinese,
  korean,
  pueblo,
  "salish-shidhe": salishShidhe,
  sioux,
  ute,
};

// "American" isn't really one list — real American names come from every
// background. Rather than pretend otherwise, picking an "american" name
// draws its given name and surname *independently* from this weighted mix
// of other cultures, so the two can come from different origins (an
// English first name with a Hispanic surname, say) the way a lot of real
// blended-heritage American names do. Weights are a rough approximation
// for flavor, not demographic data — European-descended names (the base
// american.json pool) are the largest share, Hispanic a solid second.
const AMERICAN_BLEND = [
  { culture: "american", weight: 60 },
  { culture: "hispanic", weight: 30 },
  { culture: "french", weight: 10 },
];

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

function weightedPick(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = randInt(1, total);
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.culture;
  }
  return entries[entries.length - 1].culture;
}

/** Whether a culture has actual name data yet, vs. being a stub — see
 * each stub's _note for why (unreliable sources, or names that belong to
 * real living communities rather than a generic pool to draw from). */
export function isCultureReady(culture) {
  const data = CULTURES[culture];
  return Boolean(data?.firstNames.male.length || data?.firstNames.female.length);
}

/**
 * @param {Object} options
 * @param {keyof CULTURES} [options.culture] - defaults to "american"
 * @param {'male'|'female'} [options.gender] - random if omitted
 */
export function generateConventionalName({ culture = "american", gender } = {}) {
  const data = CULTURES[culture];
  if (!data) throw new Error(`Unknown culture: ${culture}`);
  if (!isCultureReady(culture)) {
    throw new Error(`No name data yet for culture: ${culture}`);
  }

  const genderChoice = gender || (Math.random() < 0.5 ? "female" : "male");

  const givenCulture = culture === "american" ? weightedPick(AMERICAN_BLEND) : culture;
  const surnameCulture = culture === "american" ? weightedPick(AMERICAN_BLEND) : culture;

  const givenName = pick(CULTURES[givenCulture].firstNames[genderChoice]);
  const surnamePool = CULTURES[surnameCulture].lastNames;
  // Some cultures (pueblo, for now) only have given names — see the
  // _note in that file for why.
  const surname = surnamePool.length ? pick(surnamePool) : "";

  return {
    fullName: surname ? `${givenName} ${surname}` : givenName,
    givenName,
    surname,
    gender: genderChoice,
    culture,
  };
}

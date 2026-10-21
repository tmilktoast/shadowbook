// Critters from the core rulebook's "Hell Is Other People" chapter (pp.
// 256+): animals, paracritters, HMHVV-infected, dragons, and conjured
// Spirits. Same loading convention as templates.js (and literally the
// same createTemplate()/resolveVariant() shape — see template.js's doc
// comment on why Critters reuse it as-is rather than getting their own
// factory).

import { createTemplate } from "./template.js";
import { markOfficial } from "../officialContent.js";
import barghest from "./data/critters/barghest.json";
import hellHound from "./data/critters/hell-hound.json";
import shiawaseCyberTiger from "./data/critters/shiawase-cyber-tiger.json";
import basilisk from "./data/critters/basilisk.json";
import cockatrice from "./data/critters/cockatrice.json";
import ghoul from "./data/critters/ghoul.json";
import devilRat from "./data/critters/devil-rat.json";
import vampire from "./data/critters/vampire.json";
import guardDog from "./data/critters/guard-dog.json";
import youngDragon from "./data/critters/young-dragon.json";
import watcher from "./data/critters/watcher.json";
import spiritOfKin from "./data/critters/spirit-of-kin.json";
import spiritOfBeasts from "./data/critters/spirit-of-beasts.json";
import spiritOfPlants from "./data/critters/spirit-of-plants.json";
import spiritOfAir from "./data/critters/spirit-of-air.json";
import spiritOfEarth from "./data/critters/spirit-of-earth.json";
import spiritOfFire from "./data/critters/spirit-of-fire.json";
import spiritOfWater from "./data/critters/spirit-of-water.json";

function buildCritter(data) {
  return markOfficial({ ...createTemplate(), ...data });
}

export const CRITTERS = [
  barghest,
  hellHound,
  shiawaseCyberTiger,
  basilisk,
  cockatrice,
  ghoul,
  devilRat,
  vampire,
  guardDog,
  youngDragon,
  watcher,
  spiritOfKin,
  spiritOfBeasts,
  spiritOfPlants,
  spiritOfAir,
  spiritOfEarth,
  spiritOfFire,
  spiritOfWater,
].map(buildCritter);

export function getCritter(id) {
  return CRITTERS.find((critter) => critter.id === id);
}

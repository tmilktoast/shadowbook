// Official pregens from the core rulebook (p. 88+), built on top of
// createCharacter() and tagged official via markOfficial() — same
// convention as the catalog. Each data file in ./data/pregens/ is mostly
// plain JSON; Amps with a catalogId are resolved through catalog.js's
// createAmpFromCatalog() at load time rather than duplicating the
// catalog's effects by hand.

import { createCharacter } from "./character.js";
import { getCatalogEntry, createAmpFromCatalog } from "./catalog.js";
import { markOfficial } from "../officialContent.js";
import hercules from "./data/pregens/hercules.json";

function buildAmp(ampData) {
  if (!ampData.catalogId) return { ...ampData };
  const entry = getCatalogEntry(ampData.catalogId);
  const amp = createAmpFromCatalog(entry);
  if (ampData.nameOverride) amp.name = ampData.nameOverride;
  return amp;
}

function buildPregen(data) {
  const character = createCharacter();
  Object.assign(character, {
    ...data,
    amps: data.amps.map(buildAmp),
  });
  return markOfficial(character);
}

export const PREGENS = [hercules].map(buildPregen);

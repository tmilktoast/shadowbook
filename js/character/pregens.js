// Official pregens from the core rulebook (p. 88+), built on top of
// createCharacter() and tagged official via markOfficial() — same
// convention as the catalog. Each data file in ./data/pregens/ is mostly
// plain JSON; Amps with a catalogId are resolved through catalog.js's
// createAmpFromCatalog() at load time rather than duplicating the
// catalog's effects by hand.

import { createCharacter } from "./character.js";
import { getCatalogEntry, createAmpFromCatalog } from "./catalog.js";
import { markOfficial } from "../officialContent.js";
import { getKindOverride } from "./characterKindOverrides.js";
import hercules from "./data/pregens/hercules.json";
import wildJane from "./data/pregens/wild-jane.json";
import trash from "./data/pregens/trash.json";
import gambit from "./data/pregens/gambit.json";
import charon from "./data/pregens/charon.json";
import luna from "./data/pregens/luna.json";
import casper from "./data/pregens/casper.json";
import echo from "./data/pregens/echo.json";
import drakk from "./data/pregens/drakk.json";
import whiteRabbit from "./data/pregens/white-rabbit.json";
import mictlan from "./data/pregens/mictlan.json";
import capitan from "./data/pregens/capitan.json";

function buildAmp(ampData) {
  if (!ampData.catalogId) return { ...ampData };
  const entry = getCatalogEntry(ampData.catalogId);
  // `choices` resolves a catalog entry's player-filled targets (a
  // target: null effect, or a mentor spirit's `choose` block) — see
  // createAmpFromCatalog()'s own doc comment.
  const amp = createAmpFromCatalog(entry, ampData.choices);
  if (ampData.nameOverride) amp.name = ampData.nameOverride;
  return amp;
}

function buildPregen(data) {
  const character = createCharacter();
  Object.assign(character, {
    ...data,
    pregen: true,
    amps: data.amps.map(buildAmp),
  });
  character.kind = getKindOverride(character.id) ?? character.kind;
  return markOfficial(character);
}

export const PREGENS = [
  hercules,
  wildJane,
  trash,
  gambit,
  charon,
  luna,
  casper,
  echo,
  drakk,
  whiteRabbit,
  mictlan,
  capitan,
].map(buildPregen);

export function getPregen(id) {
  return PREGENS.find((character) => character.id === id);
}

// The five Anarchy 2.0 metatypes and their racial qualities.
//
// Qualities live in their own file and metatypes refer to them by id,
// since several metatypes share one (elves and orks both have low-light
// vision) — each quality is defined once, not copied per metatype.

import METATYPES from "./data/metatypes.json";
import QUALITIES from "./data/qualities.json";

export { METATYPES, QUALITIES };

export function getMetatype(id) {
  return METATYPES[id];
}

// Resolves a metatype's racial quality ids into the full quality entries
// (with their id attached), e.g. for listing them on a character sheet.
export function getRacialQualities(metatypeId) {
  const metatype = getMetatype(metatypeId);
  if (!metatype) return [];
  return metatype.racialQualities.map((id) => ({ id, ...QUALITIES[id] }));
}

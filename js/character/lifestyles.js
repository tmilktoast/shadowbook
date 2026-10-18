// Anarchy 2.0 lifestyles — a predefined list, so characters store a
// lifestyle id rather than free text. The fifth Keyword on the sheet
// ("Low lifestyle") is generated from it.

import data from "./data/lifestyles.json";

// Drop "_"-prefixed metadata keys (like _note) so only real lifestyles
// are exposed, e.g. for populating a dropdown.
export const LIFESTYLES = Object.fromEntries(
  Object.entries(data).filter(([id]) => !id.startsWith("_")),
);

export function getLifestyle(id) {
  return LIFESTYLES[id];
}

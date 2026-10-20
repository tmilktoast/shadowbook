// Marks data sourced from the Anarchy 2.0 rulebook (Amps, metatypes,
// qualities, skills, lifestyles...), as opposed to homebrew or
// user-generated content (a custom Amp built in the Amp Creator, a
// generated NPC, a player's own character). If this repo ever goes
// public, a build/filter step can strip everything tagged
// `official: true` in one sweep instead of hunting through each data
// file by hand. Content a player creates themselves should never pass
// through these — it isn't Catalyst's material, nothing to strip.
export function markOfficial(entry) {
  return { ...entry, official: true };
}

export function markAllOfficial(entries) {
  return entries.map(markOfficial);
}

// Same, for the id-keyed objects most game data is stored as (METATYPES,
// SKILLS, AMP_TYPES, ...) rather than arrays like the catalog.
export function markAllOfficialById(entriesById) {
  return Object.fromEntries(
    Object.entries(entriesById).map(([id, entry]) => [id, markOfficial(entry)]),
  );
}

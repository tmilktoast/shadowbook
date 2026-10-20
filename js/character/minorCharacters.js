// Minor/fodder NPCs — built by hand or by the NPC Generator — persisted to
// localStorage, same approach as customAmps.js (entries need individual
// deletion, so each gets an id). Deliberately a thin pointer rather than a
// baked-in copy of a Template's stats:
//   { id, name, gender, metatype, templateId }
// `metatype` is a METATYPES (./metatypes.js) key, `templateId` a
// TEMPLATES (./templates.js) key. Resolving the actual stat block is
// always done live via resolveVariant()/getTemplate() at render time, so
// if a Template's numbers improve later, every NPC built from it does too
// — see template.js's own doc comment for why this is a separate, lighter
// model from the full Character (character.js).

const KEY = "shadowbook-minor-characters";

export function loadMinorCharacters() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function persist(npcs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(npcs));
  } catch {
    // Won't persist (e.g. private browsing with storage blocked).
  }
}

export function saveMinorCharacter(npc) {
  const npcs = loadMinorCharacters();
  npcs.unshift({ ...npc, id: crypto.randomUUID() });
  persist(npcs);
}

export function deleteMinorCharacter(id) {
  persist(loadMinorCharacters().filter((npc) => npc.id !== id));
}

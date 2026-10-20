// A user's PC/NPC pick for a Major Character (character.kind), persisted
// to localStorage keyed by character id — same approach as
// dice/history.js. The sheet itself isn't editable yet (that's a much
// bigger project), but this one tag is, via a <select> on the card.

const KEY = "shadowbook-character-kind-overrides";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function getKindOverride(characterId) {
  return load()[characterId];
}

export function setKindOverride(characterId, kind) {
  const overrides = load();
  overrides[characterId] = kind;
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // Won't persist (e.g. private browsing with storage blocked).
  }
}

// Anarchy 2.0 levels of play — the budget and limits a new character is
// built under. Runner is the book's default.

import data from "./data/levelsOfPlay.json";
import { markAllOfficialById } from "../officialContent.js";

// Drop "_"-prefixed metadata keys (like _note), same as LIFESTYLES.
export const LEVELS_OF_PLAY = markAllOfficialById(
  Object.fromEntries(Object.entries(data).filter(([id]) => !id.startsWith("_"))),
);

export const DEFAULT_LEVEL_OF_PLAY = "runner";

export function getLevelOfPlay(id) {
  return LEVELS_OF_PLAY[id];
}

// Anarchy 2.0 "Typical Operations" (core book p. 113) — the main
// categories of job a mission can be built around. The Job Generator
// will pick from these (and mix a few together, per the book's own
// note that real missions are rarely a single pure type).

import data from "./data/operationTypes.json";
import { markAllOfficialById } from "../officialContent.js";

// Drop "_"-prefixed metadata keys (like _note) so only real operation
// types are exposed, e.g. for populating a dropdown.
export const OPERATION_TYPES = markAllOfficialById(
  Object.fromEntries(Object.entries(data).filter(([id]) => !id.startsWith("_"))),
);

export function getOperationType(id) {
  return OPERATION_TYPES[id];
}

// The core book's ready-made Shadow Amps (cyberware, adept powers,
// contacts, foci, weapons, drones...), as templates for the Amp system
// in ./amps.js. Each entry records the book's rating and price; its
// `effects` rebuild that rating from the effects table.
//
// Some entries leave a choice to the player: an effect with
// `target: null` and a `choice` hint (e.g. Improved Ability's Skill), or
// a `choose` block (mentor spirits: RR on 2 of 3 listed options).
// createAmpFromCatalog() fills those in.

import cyberware from "./data/catalog/cyberware.json";
import bioware from "./data/catalog/bioware.json";
import adeptPowers from "./data/catalog/adeptPowers.json";
import contacts from "./data/catalog/contacts.json";
import qualities from "./data/catalog/qualities.json";
import foci from "./data/catalog/foci.json";
import weapons from "./data/catalog/weapons.json";
import armor from "./data/catalog/armor.json";
import gear from "./data/catalog/gear.json";
import drugs from "./data/catalog/drugs.json";
import cyberdecks from "./data/catalog/cyberdecks.json";
import rccs from "./data/catalog/rccs.json";
import vehicles from "./data/catalog/vehicles.json";
import { markAllOfficial } from "../officialContent.js";

// Grouped for browsing; labels are for UI headings.
export const CATALOG_SECTIONS = Object.fromEntries(
  Object.entries({
    cyberware: { label: "Cyberware", entries: cyberware.entries },
    bioware: { label: "Bioware", entries: bioware.entries },
    adeptPowers: { label: "Adept Powers", entries: adeptPowers.entries },
    qualities: { label: "Qualities & Mentor Spirits", entries: qualities.entries },
    contacts: { label: "Contacts", entries: contacts.entries },
    foci: { label: "Foci", entries: foci.entries },
    weapons: { label: "Weapons", entries: weapons.entries },
    armor: { label: "Armor", entries: armor.entries },
    gear: { label: "Gear", entries: gear.entries },
    drugs: { label: "Drugs", entries: drugs.entries },
    cyberdecks: { label: "Cyberdecks", entries: cyberdecks.entries },
    rccs: { label: "Rigger Command Consoles", entries: rccs.entries },
    vehicles: { label: "Vehicles & Drones", entries: vehicles.entries },
  }).map(([key, section]) => [
    key,
    { ...section, entries: markAllOfficial(section.entries) },
  ]),
);

export const CATALOG = Object.values(CATALOG_SECTIONS).flatMap((s) => s.entries);

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

export function getCatalogEntry(id) {
  return BY_ID.get(id);
}

// Builds an Amp for character.amps from a catalog entry. `choices` is a
// list of targets, used in order: first for effects with `target: null`,
// then for the entry's `choose` block (e.g. two mentor spirit options).
export function createAmpFromCatalog(entry, choices = []) {
  const picks = [...choices];
  const effects = entry.effects.map(({ choice, ...e }) =>
    e.target === null ? { ...e, target: picks.shift() ?? null } : { ...e },
  );
  if (entry.choose) {
    for (let i = 0; i < entry.choose.count; i++) {
      effects.push({ effect: entry.choose.effect, target: picks.shift() ?? null });
    }
  }
  const amp = {
    type: entry.type,
    name: entry.name,
    description: entry.description,
    effects,
    catalogId: entry.id,
  };
  if (entry.vehicleType) amp.vehicleType = entry.vehicleType;
  if (entry.itemCost) amp.itemCost = entry.itemCost;
  return amp;
}

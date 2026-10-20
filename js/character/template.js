// NPC Templates (core book pp. 243+, "Hell Is Other People"): quick,
// non-buildable stock stat blocks for "fodder" and minor NPCs — Ganger,
// Elite Ganger, Security Guard, and so on. These live in the Character
// Database's Templates tab as reusable reference material, distinct from:
//   - the full Character model (character.js), for the Major Characters
//     tab — Player Characters and any major NPC with a backstory and a
//     real role in the campaign;
//   - the Minor Characters tab's actual NPC instances, which don't exist
//     as their own data model yet — a GM will eventually create them by
//     hand or with an NPC Generator, likely starting from a Template.
//
// Still tagged `official: true` like the rest of the book-sourced data
// (officialContent.js), but note these specifically are just numbers —
// Skill ranks, Attribute values, DVs, thresholds. Game stats/mechanics
// aren't the kind of expression copyright protects the way the book's
// prose and art are, so unlike those, Templates aren't something that
// would need stripping if this repo ever goes public. `official` here
// is about correct sourcing/attribution, not a copyright flag.
//
// These are printed, static stats, not something built up with a nuyen
// budget: per the book's own "Reading the Rules" intro, they skip Edge,
// Essence, and Keywords/Dispositions/Cues entirely. A Skill also tracks
// two numbers that don't reduce to one another:
//   - averageHits: the book's own precomputed average number of hits,
//     for resolving a Test without rolling.
//   - rank + attribute + rr: the actual dice-pool breakdown, for a GM
//     who wants to roll for real.
// These usually move together but not always — an optional Shadow Amp
// can bump averageHits by more than its rr/rank change alone would
// suggest (the book's own numbers, not a derived formula) — so both are
// stored as given rather than one computed from the other.
//
// Many fields vary by metatype, and some separately vary again if an
// optional Shadow Amp is chosen. Both repeat the same shape, a
// "VariantValue":
//   {
//     base: number | [light, serious, incap],
//     variants: { <metatypeId>: value },       // only non-base metatypes; default {}
//     ampVariant: { amp: "<amp name>", base, variants } | null,
//   }
// `variants`/`ampVariant` are omitted in data when unused rather than
// spelled out empty — see resolveVariant() for reading them back.

export function createTemplate() {
  return {
    // Same convention as Character (officialContent.js): official stock
    // Templates cite the book page; a GM's own custom one leaves this false.
    official: false,
    source: null,

    id: "",
    label: "", // e.g. "Ganger", "Elite Ganger / Crime Syndicate Enforcer"

    attributes: {
      strength: null, // VariantValue, e.g. { base: 3, variants: { ork: 4, troll: 5 } }
      agility: null,
      willpower: null,
      logic: null,
      charisma: null,
    },

    // Ordered, not keyed by id — presentation order matters, and a few
    // entries don't correspond to a real SKILLS id (see "Reading the
    // Rules": some specializations are listed purely because they're
    // often tested with a different Attribute, not because the Template
    // actually has that specialization).
    skills: [
      // {
      //   id: "athletics",      // a SKILLS (skills.js) key, or null for a one-off
      //   label: "Athletics",
      //   rank: VariantValue,
      //   attribute: "strength", // a key into ATTRIBUTES (attributes.js)
      //   rr: VariantValue,
      //   averageHits: VariantValue,
      //   specializations: [
      //     { label: "Ranged defense", rank, attribute, rr, averageHits },
      //   ],
      //   note: "...", // optional: a rule this shape has no field for,
      //                // e.g. one of the book's "CHOOSE 1 SKILL AND
      //                // SPECIALIZATION" alternatives (Corporate
      //                // Employee/Executive) — each alternative is its
      //                // own entry in this array, flagged via `note`
      //                // rather than invented as a new top-level field.
      // },
    ],

    // Awakened templates only. Flavor text, not mechanically tracked —
    // these are fast, narrative stats, not full spellcasting rules.
    spells: [], // ["Armor (Manipulation, +1 Armor every 3 hits)."]

    weapons: [
      // { name: "Unarmed", dv: VariantValue, range: "OK/–/–/–", note: "..." }
      // `note` is an optional free-text annotation for a rule the
      // {name,dv,range} shape has no room for (e.g. a stun weapon's "one
      // action lost if damage is dealt").
    ],

    // "CHOOSE N WEAPON(S)": a handful of Templates (Soldier,
    // Elite Security/Police Officer) let the GM pick one weapon from a
    // short list instead of having it fixed — same shape/spirit as
    // chooseAmps below, just for `weapons` entries instead of Amps.
    // Most Templates don't have this and leave it at its default.
    chooseWeapons: { count: 0, options: [] },

    equipment: [], // ["Commlink", "Gang leathers (Armor 1)"]

    woundThresholds: {
      physical: null, // VariantValue, base/variants/ampVariant are [light, serious, incap]
      mental: null,
    },

    // Amps always granted before any optional picks (e.g. the Awakened
    // quality on a spellcasting template, so it can cast at all).
    requiredAmps: [], // [{ name, kind, summary }]

    // "Choose N Shadow Amp(s)": how many, and the pool to pick from.
    // `summary` (the book's own short text) is always authoritative for
    // this Template. `catalogId`, when present, is only a "see also"
    // pointer into the main Amp catalog (catalog.js) for more detail —
    // never assume its effects are identical. The book isn't always
    // consistent between chapters: e.g. the Ganger template's "Muscle
    // replacement: Close combat DV +1" doesn't match the catalog's own
    // Muscle replacement ("RR 1 on Athletics", p. 158) despite sharing a
    // name, so that one is deliberately left unlinked rather than
    // implying an equivalence the book itself doesn't have.
    // options: same shape as requiredAmps. `note` is optional free text for
    // when the book's "choose" structure doesn't fit {count, options}
    // cleanly (e.g. Go-Ganger / Rigger Ganger's two alternate sub-builds,
    // sharing one options list annotated by which build each belongs to).
    chooseAmps: { count: 0, options: [] },
  };
}

// Reads a VariantValue for a given metatype, optionally with one of the
// Template's optional Amps "equipped" (by name, case-insensitive).
// Returns the base value if the field, metatype, or Amp doesn't apply.
export function resolveVariant(field, { metatype, amp } = {}) {
  if (!field) return undefined;
  let value = field.base;
  if (metatype && field.variants?.[metatype] !== undefined) {
    value = field.variants[metatype];
  }
  if (amp && field.ampVariant && field.ampVariant.amp.toLowerCase() === amp.toLowerCase()) {
    value = field.ampVariant.base;
    if (metatype && field.ampVariant.variants?.[metatype] !== undefined) {
      value = field.ampVariant.variants[metatype];
    }
  }
  return value;
}

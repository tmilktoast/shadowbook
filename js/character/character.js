// The character data model for a single Shadowrun Anarchy 2.0 character.
//
// createCharacter() returns a fresh, blank character rather than this file
// exporting one shared object — the Character Database will eventually
// hold many of these, so each one needs to be independent.
//
// The five rated Attributes are defined in ./attributes.js. Edge and
// Essence look like attributes on the sheet but aren't bought: Edge is a
// per-adventure pool (starting value from the metatype) and Essence is
// derived from implant Amps (./essence.js).

import { getLifestyle } from "./lifestyles.js";
import { DEFAULT_LEVEL_OF_PLAY, getLevelOfPlay } from "./levelsOfPlay.js";
import { totalAttributeCost, validateAttributes } from "./attributes.js";
import { totalSkillCost, validateSkills } from "./skills.js";
import { totalAmpCost, validateAmps } from "./amps.js";

// How many of each the sheet has room for (core book p. 51).
export const DISPOSITION_COUNT = 4;
export const CUE_COUNT = 4;

export function createCharacter() {
  return {
    // Whether this is sourced from the book at all (tagged via
    // markOfficial(), see officialContent.js) vs. a character built in
    // the app. source cites where it's from, e.g. { book: "SRA2", page: 88 }.
    official: false,
    source: null,

    // Narrower than `official`: specifically one of the book's own
    // ready-made pregen characters (Hercules and friends, pregens.js),
    // as opposed to a major NPC built from scratch — official or not —
    // that just happens to share the Prime Characters tab with pregens.
    // Gets its own badge on the card/list row so the two don't blur
    // together. Set by pregens.js, not per character.json file.
    pregen: false,

    // "pc" or "npc" — the Prime Characters tab holds both (a Player
    // Character, or a major NPC with a backstory and a real role in the
    // campaign). The full sheet isn't editable yet (a much bigger
    // undertaking), but this one tag is: it's a <select> on the card
    // itself, persisted per character id via
    // characterKindOverrides.js/localStorage rather than editing the
    // source data, same spirit as dice/history.js. Pregens default "pc"
    // since that's what they are in the book.
    kind: "pc",

    // Stable id for linking straight to this character's sheet (the
    // Character Database list links to "?character=<id>"). Official
    // pregens set this explicitly in their data file; a slug of
    // streetname would work too but could collide between characters.
    id: "",

    streetname: "",
    // A URL/path to an image (e.g. "/portraits/hercules.png" served from
    // public/, or a data: URI for a user-uploaded one) — null shows a
    // placeholder. Never the book's own art for official pregens; that's
    // copyrighted artwork, not paraphrasable text like the rest of
    // `official` content, so it's left for the user to supply.
    portrait: null,
    metatype: "", // a key into METATYPES (./metatypes.js), "" until chosen
    levelOfPlay: DEFAULT_LEVEL_OF_PLAY, // a key into LEVELS_OF_PLAY (./levelsOfPlay.js)

    // All start at 0 and are bought up with nuyen; each must end between
    // 1 and the metatype's max — see validateAttributes().
    attributes: {
      strength: 0,
      agility: 0,
      willpower: 0,
      logic: 0,
      charisma: 0,
    },
    nuyen: 0, // cash on hand in play, separate from the creation budget
    // Only Skills the character has, keyed by id from SKILLS (./skills.js):
    // { "ranged-weapons": { rating: 5, specializations: ["pistols"] } }
    skills: {},
    // Knowledge Skills have no rating — just a list of fields known:
    // "Firearms", "Japanese", "Corporate politics".
    knowledgeSkills: [],

    // Awakened characters only. Free-text, one line per spell (name +
    // paraphrased effect), same flavor-text-not-mechanics treatment as
    // template.js's `spells` field — Sorcery/Conjuring (skills.js)
    // already cover the dice side; this is just what the character
    // actually knows. Empty for non-Awakened characters.
    spells: [],

    // Shadow Amps (./amps.js) — cyberware, magic, decks, vehicles,
    // contacts... Racial qualities aren't stored here; they come from the
    // metatype (getRacialQualityAmps()).
    amps: [],

    // Weapons and armor are printed directly on the sheet rather than
    // routed through the Amp system — they're the character's baseline
    // kit, not a purchased upgrade. Unlocked weapon Amps (smartguns, RR...)
    // still live in `amps`; this is just what they're bolted onto.
    // { name, type: "Weapon", dv, range } — range as printed, e.g. "OK/OK/Dis./–"
    weapons: [],
    // Each slot is null or { name, rating } — feeds getWoundTable() (./wounds.js).
    armor: { main: null, secondary: null },
    equipment: [], // free-text items: "Fake SIN", "Commlink"

    // The five recommended Keywords (core book p. 51). They also define
    // what the character knows. Lifestyle comes from the predefined list
    // in ./lifestyles.js, so it's stored as an id — see getKeywords() for
    // the sheet text.
    keywords: {
      // The "metatype/social status" Keyword: free text, independent of the
      // metatype field above. "dwarf corp", "Boston bourgeoisie", or just "Elf".
      socialStatus: "",
      origin: "", // home turf, scoped to the campaign: "Seattle / Downtown", "Austin, CAS"
      role: "", // what they do and how: "Face Adept", "Combat decker"
      extra: "", // open-ended, often a secondary/former job: "Former CIA Agent (UCAS)"
    },
    lifestyle: "low", // a key into LIFESTYLES (./lifestyles.js); Low is the book's default

    // Dispositions and Cues (core book p. 51) are freeform text, up to
    // DISPOSITION_COUNT / CUE_COUNT of each. Both drive Edge: playing to
    // one for an Advantage costs 1 Edge, and taking a detrimental action
    // because of one earns 1 Edge. They aren't paired one-to-one.
    dispositions: [], // personality traits: "Idealist", "Wary of Aztechnology"
    cues: [], // typical sayings: "A goal without a plan is just a fraggin' wish."
  };
}

// The five Keywords as they appear on the sheet, skipping any not filled
// in yet. The rules text lists lifestyle 4th, but every official pregen
// sheet prints it last, so this follows the sheets.
export function getKeywords(character) {
  const { socialStatus, origin, role, extra } = character.keywords;
  const lifestyle = getLifestyle(character.lifestyle);
  return [
    socialStatus,
    origin,
    role,
    extra,
    lifestyle ? `${lifestyle.label} lifestyle` : "",
  ].filter(Boolean);
}

// Nuyen spent building the character, by category. Gear will join this
// once it exists.
export function getBuildCost(character) {
  const attributes = totalAttributeCost(character);
  const skills = totalSkillCost(character);
  const amps = totalAmpCost(character);
  return { attributes, skills, amps, total: attributes + skills + amps };
}

// Every rules problem with the character, from all the sections plus the
// overall creation budget. Empty means it's a legal build.
export function validateCharacter(character) {
  const problems = [
    ...validateAttributes(character),
    ...validateSkills(character),
    ...validateAmps(character),
  ];
  const level = getLevelOfPlay(character.levelOfPlay);
  if (level && character.metatype) {
    const { total } = getBuildCost(character);
    if (total > level.nuyen) {
      problems.push(
        `Build costs ${total.toLocaleString()}¥, over the ${level.label} budget of ${level.nuyen.toLocaleString()}¥.`,
      );
    }
  }
  return problems;
}

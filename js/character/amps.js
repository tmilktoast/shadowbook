// Shadow Amps (core book pp. 58-63): cyberware, magic, vehicles, Matrix
// gear, contacts, and more, all built the same way — pick an Amp type
// (its base rating), add effects (each adds its cost), and the total is
// the Amp's rating. Each rating point costs 5,000¥.
//
// An Amp on a character looks like:
//   {
//     type: "cyberware",
//     name: "Cybernetic Eyes",
//     description: "Visual interface, camera, low-light vision.",
//     effects: [
//       { effect: "rr-specialization", target: "ranged-weapons/pistols" },
//       { effect: "narrative" },
//       { effect: "negative", cost: -1, note: "Glows in the dark" },
//     ],
//     vehicleType: "medium-drone", // vehicle Amps only
//     itemCost: 2500,             // price of an underlying item, if any
//     catalogId: "...",           // set when built from ./catalog.js
//   }
// Each entry in `effects` is one purchase; repeat an entry to buy an
// effect again (up to its max). Targets: a skill id, an attribute id, or
// "skillId/specializationId" for a specialization.

import typeData from "./data/ampTypes.json";
import effectData from "./data/ampEffects.json";
import vehicleData from "./data/vehicleTypes.json";
import { SKILLS } from "./skills.js";
import { ATTRIBUTES } from "./attributes.js";
import { getRacialQualities } from "./metatypes.js";
import { getLevelOfPlay } from "./levelsOfPlay.js";

// Drop "_"-prefixed metadata keys (like _note), same as LIFESTYLES.
const withoutMeta = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([id]) => !id.startsWith("_")));

export const AMP_TYPES = withoutMeta(typeData);
export const AMP_EFFECTS = withoutMeta(effectData);
export const VEHICLE_TYPES = withoutMeta(vehicleData);

export const NUYEN_PER_AMP_RATING = 5000;
export const MAX_RR_PER_TEST = 3; // RR from all sources is capped at 3 for one Test

// The cost of one effect purchase. Negative effects carry their own cost.
function effectCost(entry) {
  return entry.cost ?? AMP_EFFECTS[entry.effect]?.cost ?? 0;
}

// An Amp's rating. `firstQuality` marks the character's first (non-racial)
// Quality, which has a lower base rating.
export function ampRating(amp, { firstQuality = false } = {}) {
  const type = AMP_TYPES[amp.type];
  if (!type) return 0;
  const base = firstQuality ? type.firstBaseRating : type.baseRating;
  return base + amp.effects.reduce((sum, entry) => sum + effectCost(entry), 0);
}

// Each of the character's Amps with its rating, working out which
// Quality counts as the first.
export function getAmpRatings(character) {
  let seenQuality = false;
  return character.amps.map((amp) => {
    const firstQuality = amp.type === "quality" && !seenQuality;
    if (amp.type === "quality") seenQuality = true;
    return { amp, rating: ampRating(amp, { firstQuality }) };
  });
}

// Nuyen for all Amps. Equipment Amps (and implanted weapons) also carry
// the price of the underlying item in `itemCost` — e.g. 2,500¥ for a
// standard weapon — since it has to be bought before it's upgraded.
export function totalAmpCost(character) {
  return getAmpRatings(character).reduce(
    (sum, { amp, rating }) =>
      sum + rating * NUYEN_PER_AMP_RATING + (amp.itemCost ?? 0),
    0,
  );
}

// Essence lost to implants (cyberware and bioware, one implant per Amp).
export function essenceLoss(character) {
  return character.amps.reduce(
    (sum, amp) => sum + (AMP_TYPES[amp.type]?.essenceCost ?? 0),
    0,
  );
}

// Racial qualities as free Quality Amps — they come with the metatype,
// aren't stored on the character, and don't count as the first Quality.
export function getRacialQualityAmps(character) {
  return getRacialQualities(character.metatype).map((q) => ({
    type: "quality",
    name: q.label,
    description: "",
    effects: [],
    racial: true,
  }));
}

// True if the character has an Awakened Amp with the given ability
// ("sorcery", "conjuring", "adept", "astral-perception"...).
// Astral projection includes astral perception.
export function hasAwakenedAbility(character, ability) {
  return character.amps.some(
    (amp) =>
      amp.type === "awakened" &&
      amp.effects.some(
        (e) =>
          e.effect === ability ||
          (ability === "astral-perception" && e.effect === "astral-projection"),
      ),
  );
}

export function hasCyberdeck(character) {
  return character.amps.some((amp) => amp.type === "cyberdeck");
}

function countEffect(amp, effectId) {
  return amp.effects.filter((e) => e.effect === effectId).length;
}

// A vehicle/drone Amp's stats: its base type plus stat effects.
export function getVehicleStats(amp) {
  const base = VEHICLE_TYPES[amp.vehicleType];
  if (!base) return undefined;
  const flying = countEffect(amp, "flying") > 0;
  return {
    pilot: base.pilot + countEffect(amp, "pilot"),
    body: base.body,
    handling: base.handling + countEffect(amp, "handling"),
    speed:
      (flying ? (base.flyingSpeed ?? base.speed * 2) : base.speed) +
      countEffect(amp, "speed"),
    armor: base.armor + countEffect(amp, "vehicle-armor"),
  };
}

// A cyberdeck Amp's Firewall and Attack.
export function getCyberdeckStats(amp) {
  const base = AMP_TYPES.cyberdeck.stats;
  return {
    firewall: base.firewall + countEffect(amp, "firewall"),
    attack: base.attack + countEffect(amp, "attack"),
  };
}

// Total Risk Reduction per target across all Amps:
// { skill: { id: n }, attribute: { id: n }, specialization: { "skill/spec": n } }
export function getRiskReduction(character) {
  const rr = { skill: {}, attribute: {}, specialization: {} };
  const kinds = {
    "rr-skill": "skill",
    "rr-attribute": "attribute",
    "rr-specialization": "specialization",
  };
  for (const amp of character.amps) {
    for (const { effect, target } of amp.effects) {
      const kind = kinds[effect];
      if (kind) rr[kind][target] = (rr[kind][target] ?? 0) + 1;
    }
  }
  return rr;
}

function isValidTarget(kind, target) {
  if (typeof target !== "string") return false;
  if (kind === "skill") return target in SKILLS;
  if (kind === "attribute") return target in ATTRIBUTES;
  // Specializations may be custom, so only the skill part must be known.
  const [skillId, spec] = target.split("/");
  return skillId in SKILLS && Boolean(spec);
}

// Checks one Amp's effects against the rules. `label` prefixes messages.
function validateAmp(amp, problems) {
  const type = AMP_TYPES[amp.type];
  const label = amp.name || "Unnamed Amp";
  if (!type) {
    problems.push(`${label}: unknown Amp type "${amp.type}".`);
    return;
  }

  const vehicle = VEHICLE_TYPES[amp.vehicleType];
  if (amp.type === "vehicle" && !vehicle) {
    problems.push(`${label}: choose a vehicle or drone type.`);
  }

  for (const entry of amp.effects) {
    const def = AMP_EFFECTS[entry.effect];
    if (!def) {
      problems.push(`${label}: unknown effect "${entry.effect}".`);
      continue;
    }
    if (!def.types.includes(amp.type)) {
      problems.push(`${label}: ${type.label} Amps can't take "${def.label}".`);
    }
    if (def.vehicleKinds && vehicle && !def.vehicleKinds.includes(vehicle.kind)) {
      problems.push(`${label}: "${def.label}" is only for ${def.vehicleKinds.join("/")}s.`);
    }
    if (def.target && !isValidTarget(def.target, entry.target)) {
      problems.push(`${label}: "${def.label}" needs a valid ${def.target} target.`);
    }
    if (def.costRange) {
      const [min, max] = def.costRange;
      if (!(entry.cost >= min && entry.cost <= max)) {
        problems.push(`${label}: "${def.label}" cost must be ${min} to ${max}.`);
      }
    }
  }

  // Per-effect limits: max purchases, prerequisites, exclusions, stat caps.
  for (const id of new Set(amp.effects.map((e) => e.effect))) {
    const def = AMP_EFFECTS[id];
    if (!def) continue;
    const count = countEffect(amp, id);
    if (def.max !== undefined && count > def.max) {
      problems.push(`${label}: "${def.label}" can be taken at most ${def.max} time(s).`);
    }
    if (def.requires && countEffect(amp, def.requires) === 0) {
      problems.push(`${label}: "${def.label}" requires "${AMP_EFFECTS[def.requires].label}".`);
    }
    for (const other of def.excludes ?? []) {
      if (countEffect(amp, other) > 0) {
        problems.push(`${label}: "${def.label}" and "${AMP_EFFECTS[other].label}" can't be combined.`);
      }
    }
  }
  if (amp.type === "cyberdeck") {
    const { firewall, attack } = getCyberdeckStats(amp);
    if (firewall > AMP_EFFECTS.firewall.statMax) problems.push(`${label}: Firewall can't exceed ${AMP_EFFECTS.firewall.statMax}.`);
    if (attack > AMP_EFFECTS.attack.statMax) problems.push(`${label}: Attack can't exceed ${AMP_EFFECTS.attack.statMax}.`);
  }
  if (amp.type === "vehicle" && vehicle) {
    const stats = getVehicleStats(amp);
    if (stats.armor > stats.body) problems.push(`${label}: Armor can't exceed Body (${stats.body}).`);
  }
  if (amp.type === "awakened" && amp.effects.length === 0) {
    problems.push(`${label}: an Awakened Amp needs at least one ability.`);
  }
}

// Checks all of a character's Amps, plus the character-wide rules that
// depend on them: Awakened/cyberdeck prerequisites for Skills and adept
// powers, and Risk Reduction caps from the level of play.
// Returns a list of human-readable problems; empty means valid.
export function validateAmps(character) {
  const problems = [];
  for (const amp of character.amps) validateAmp(amp, problems);

  if (character.amps.filter((a) => a.type === "awakened").length > 1) {
    problems.push("A character can have only one Awakened Amp.");
  }
  if (
    character.amps.some((a) => a.type === "adept-power") &&
    !hasAwakenedAbility(character, "adept")
  ) {
    problems.push("Adept Power Amps require the Awakened Amp with the Adept ability.");
  }

  // Skills that need magic or a cyberdeck to be used at all.
  for (const id of Object.keys(character.skills)) {
    const skill = SKILLS[id];
    if (skill?.requires === "awakened" && !hasAwakenedAbility(character, id)) {
      problems.push(`${skill.label} requires the Awakened Amp with the ${skill.label} ability.`);
    }
    if (skill?.requires === "cyberdeck" && !hasCyberdeck(character)) {
      problems.push(`${skill.label} requires a cyberdeck.`);
    }
  }

  // Risk Reduction caps (creation limits, including stacking). A
  // specialization's Test also benefits from RR on its parent Skill, so
  // both count toward the specialization cap.
  const level = getLevelOfPlay(character.levelOfPlay);
  if (level) {
    const { general, specializations } = level.riskReductionMax;
    const rr = getRiskReduction(character);
    for (const [kind, totals] of [["skill", rr.skill], ["attribute", rr.attribute]]) {
      for (const [target, n] of Object.entries(totals)) {
        if (n > general) {
          problems.push(`RR ${n} on ${kind} "${target}" exceeds ${level.label} max of ${general}.`);
        }
      }
    }
    for (const [target, n] of Object.entries(rr.specialization)) {
      const total = n + (rr.skill[target.split("/")[0]] ?? 0);
      if (total > specializations) {
        problems.push(`RR ${total} on specialization "${target}" exceeds ${level.label} max of ${specializations}.`);
      }
    }
  }
  return problems;
}

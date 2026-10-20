// Anarchy 2.0 Skills (core book pp. 53-57) and their creation rules.
//
// A character's skills are stored sparsely, keyed by skill id:
//   { "ranged-weapons": { rating: 5, specializations: ["pistols"] } }
// Specializations are ids from skills.json where one exists, but the book
// allows inventing new ones, so any other string is kept as free text.

import data from "./data/skills.json";
import { getLevelOfPlay } from "./levelsOfPlay.js";
import { markAllOfficialById } from "../officialContent.js";

// Drop "_"-prefixed metadata keys (like _note), same as LIFESTYLES.
export const SKILLS = markAllOfficialById(
  Object.fromEntries(Object.entries(data).filter(([id]) => !id.startsWith("_"))),
);

export const SKILL_MAX = 8; // absolute cap; levels of play cap lower at creation
export const SPECIALIZATION_BONUS = 2; // can take a Skill's dice up to 10

const COST_PER_POINT_LOW = 2500; // ratings 1-5
const COST_PER_POINT_HIGH = 5000; // ratings 6-8
const LOW_RATING_LIMIT = 5;
const SPECIALIZATION_COST = 2500;
const KNOWLEDGE_SKILL_COST = 2500;

export function getSkill(id) {
  return SKILLS[id];
}

// Display label for a specialization: the book's label if it's a known
// id, otherwise the custom text itself.
export function getSpecializationLabel(skillId, spec) {
  return getSkill(skillId)?.specializations[spec]?.label ?? spec;
}

// Nuyen to buy a Skill from 0 up to `rating`.
export function skillCost(rating) {
  let total = 0;
  for (let point = 1; point <= rating; point++) {
    total += point <= LOW_RATING_LIMIT ? COST_PER_POINT_LOW : COST_PER_POINT_HIGH;
  }
  return total;
}

// Total nuyen spent on Skills, specializations, and Knowledge Skills.
export function totalSkillCost(character) {
  let total = character.knowledgeSkills.length * KNOWLEDGE_SKILL_COST;
  for (const { rating, specializations } of Object.values(character.skills)) {
    total += skillCost(rating) + specializations.length * SPECIALIZATION_COST;
  }
  return total;
}

// Dice for a Test: Skill rating + Attribute rating, +2 if a
// specialization applies.
export function dicePool(skillRating, attributeRating, specialized = false) {
  return skillRating + attributeRating + (specialized ? SPECIALIZATION_BONUS : 0);
}

// Checks a character's Skills against the rules and its level of play.
// Returns a list of human-readable problems; empty means valid.
// (Awakened/cyberdeck requirements aren't checked yet — that needs
// Shadow Amps and gear to exist first.)
export function validateSkills(character) {
  const problems = [];
  const level = getLevelOfPlay(character.levelOfPlay);
  const max = level ? level.skillMax : SKILL_MAX;

  for (const [id, { rating, specializations }] of Object.entries(character.skills)) {
    const skill = getSkill(id);
    if (!skill) {
      problems.push(`Unknown skill "${id}".`);
      continue;
    }
    if (rating > max) {
      const where = level ? ` at ${level.label} level` : "";
      problems.push(`${skill.label} can't exceed ${max}${where}.`);
    }
    if (specializations.length > 0 && rating < 1) {
      problems.push(`${skill.label} needs rating 1+ to have specializations.`);
    }
  }
  return problems;
}

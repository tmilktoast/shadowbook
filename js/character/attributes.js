// The five rated Attributes (core book p. 52) and their creation rules.
//
// Edge is deliberately NOT here: it isn't a rating you buy but a pool —
// each adventure starts with getStartingEdge() points (4 for humans, 3
// otherwise), more is earned in play, and none carries over.

import ATTRIBUTES from "./data/attributes.json";
import { getMetatype } from "./metatypes.js";
import { getLevelOfPlay } from "./levelsOfPlay.js";

export { ATTRIBUTES };

// Every metatype's range starts at 1; only the maximum varies.
export const ATTRIBUTE_MIN = 1;

const COST_PER_POINT = 10000;
const COST_OF_MAX_POINT = 20000; // the point that reaches the metatype max

export function getAttributeMax(metatypeId, attribute) {
  return getMetatype(metatypeId)?.attributeMax[attribute];
}

export function getStartingEdge(metatypeId) {
  return getMetatype(metatypeId)?.startingEdge;
}

// Nuyen to buy an Attribute from 0 up to `rating`, given its max.
export function attributeCost(rating, max) {
  let total = 0;
  for (let point = 1; point <= rating; point++) {
    total += point === max ? COST_OF_MAX_POINT : COST_PER_POINT;
  }
  return total;
}

// Total nuyen spent on all five Attributes. Needs a metatype, since the
// max (and so the price of the last point) depends on it.
export function totalAttributeCost(character) {
  return Object.keys(ATTRIBUTES).reduce(
    (sum, attr) =>
      sum +
      attributeCost(
        character.attributes[attr],
        getAttributeMax(character.metatype, attr),
      ),
    0,
  );
}

// Checks a character's Attributes against its metatype and level of play.
// Returns a list of human-readable problems; empty means valid.
export function validateAttributes(character) {
  const metatype = getMetatype(character.metatype);
  if (!metatype) return ["Choose a metatype first."];

  const problems = [];
  let atMax = 0;
  for (const [attr, { label }] of Object.entries(ATTRIBUTES)) {
    const rating = character.attributes[attr];
    const max = metatype.attributeMax[attr];
    if (rating < ATTRIBUTE_MIN) {
      problems.push(`${label} must be at least ${ATTRIBUTE_MIN}.`);
    } else if (rating > max) {
      problems.push(`${label} can't exceed ${max} for a ${metatype.label}.`);
    } else if (rating === max) {
      atMax++;
    }
  }

  const level = getLevelOfPlay(character.levelOfPlay);
  if (level && atMax > level.attributesAtMax) {
    problems.push(
      `${level.label} level allows ${level.attributesAtMax} Attribute(s) at max; this character has ${atMax}.`,
    );
  }
  return problems;
}

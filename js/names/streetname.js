// Shadowrunner streetnames — people living in the shadows go by a handle,
// not a "real" name. Patterns are pulled from the Anarchy 2.0 pregens
// (reference/): some are a single evocative word (Spectrum, Keran, Kuz),
// some are Adjective + Noun pairs (Barry Bullet, Neon Ivy), and some get
// light leetspeak styling (H4yn).

import { randInt } from "../dice/roll.js";
import streetnameData from "./data/streetnames.json";

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

const LEET_MAP = { a: "4", e: "3", i: "1", o: "0" };

/** Swaps one vowel for a digit some of the time, h4yn-style. */
function maybeLeetify(name, chance = 0.2) {
  if (Math.random() > chance) return name;
  const i = [...name].findIndex((c) => LEET_MAP[c.toLowerCase()]);
  if (i < 0) return name;
  return name.slice(0, i) + LEET_MAP[name[i].toLowerCase()] + name.slice(i + 1);
}

export function generateStreetname() {
  const { singleWords, adjectives, nouns } = streetnameData;
  const name =
    Math.random() < 0.5
      ? pick(singleWords)
      : `${pick(adjectives)} ${pick(nouns)}`;

  return maybeLeetify(name);
}

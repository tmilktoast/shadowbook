// Shadowrunner streetnames — people living in the shadows go by a handle,
// not a "real" name. Two different generation methods, either picked
// explicitly or left to chance (generateStreetname() with no argument
// picks a random method per call):
//   - "words": real words, Adjective + Noun or just a Noun (Barry
//     Bullet, Neon Ivy, Echo), sometimes with light leetspeak styling
//     (H4yn) — patterns pulled from the Anarchy 2.0 pregens (reference/).
//   - "phonemes": invented syllable combinations (Zakor, Nyxvex) for a
//     more synthetic/alien-sounding handle than real-word combos give.

import { randInt } from "../dice/roll.js";
import streetnameData from "./data/streetnames.json";
import phonemeData from "./data/phonemes.json";

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

// Common 1337-speak substitutions. Letter-by-letter (not just one swap),
// so a name can come out lightly or heavily styled depending on chance.
const LEET_MAP = {
  a: "@",
  e: "3",
  i: "1",
  o: "0",
  s: "5",
  t: "7",
  g: "9",
  b: "8",
};

// Each eligible letter independently has `chance` odds of being swapped,
// so e.g. "oo" might come out as "00", "0o", or untouched. The outer
// 50/50 below means roughly half of all names skip this step entirely
// ("with or without a number or character in place of letters").
function leetify(name, chance = 0.4) {
  return [...name]
    .map((char) => {
      const sub = LEET_MAP[char.toLowerCase()];
      return sub && Math.random() < chance ? sub : char;
    })
    .join("");
}

function maybeLeetify(name) {
  return Math.random() < 0.5 ? name : leetify(name);
}

// Method 1: real words — half the time just a Noun, half the time
// Adjective + Noun — then maybe leetspeak-styled.
function generateWordStreetname() {
  const { adjectives, nouns } = streetnameData;
  const name = Math.random() < 0.5 ? `${pick(adjectives)} ${pick(nouns)}` : pick(nouns);
  return maybeLeetify(name);
}

// Method 2: invented syllable combinations — mostly 2 syllables, sometimes
// 3, concatenated into one word (no real-word meaning, unlike Method 1).
function generatePhonemeStreetname() {
  const { syllables } = phonemeData;
  const count = Math.random() < 0.7 ? 2 : 3;
  const word = Array.from({ length: count }, () => pick(syllables)).join("");
  return word[0].toUpperCase() + word.slice(1);
}

// Keyed by the value used in the UI's method <select> — label is shown
// there, generate() does the actual work. Exported so main.js can build
// the <option> list from this instead of retyping the method names.
export const STREETNAME_METHODS = {
  words: { label: "Real Words", generate: generateWordStreetname },
  phonemes: { label: "Phonemes", generate: generatePhonemeStreetname },
};

/**
 * @param {keyof STREETNAME_METHODS} [method] - omit (or pass an unknown
 *   value) for a random method each call.
 */
export function generateStreetname(method) {
  const key = STREETNAME_METHODS[method] ? method : pick(Object.keys(STREETNAME_METHODS));
  return STREETNAME_METHODS[key].generate();
}

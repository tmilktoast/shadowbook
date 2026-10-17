// Inline SVG dice faces for the Die Roller. Drawn in code (no image
// assets) so any die size works and colors come from CSS (see the .die
// rules in style.css). Adapted from AlienTools' dice/diceSvg.js, with the
// Alien-RPG-specific face markings (facehuggers, hit/panic glows) removed.

// Pip positions on a 100x100 face, per d6 value.
const PIPS = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};

// Outline shape per die type, roughly how each die looks lying flat.
const SHAPES = {
  4: '<polygon points="50,6 95,88 5,88" />',
  8: '<polygon points="50,4 94,50 50,96 6,50" />',
  10:
    '<polygon points="50,4 95,58 50,96 5,58" />' +
    '<polyline class="facet" points="5,58 50,74 95,58" /><line class="facet" x1="50" y1="74" x2="50" y2="96" />',
  12: '<polygon points="50,5 95,38 78,93 22,93 5,38" />',
  20: '<polygon points="50,4 91,27 91,73 50,96 9,73 9,27" />',
};
const DEFAULT_SHAPE = '<circle cx="50" cy="50" r="45" />';
const D6_SHAPE = '<rect x="5" y="5" width="90" height="90" rx="16" />';

// Where the number sits vertically: low on the d4 triangle, high on the
// d10's top facet; everything else is centered.
const LABEL_Y = { 4: 66, 10: 44 };

function labelText(value, sides) {
  const y = LABEL_Y[sides] ?? 52;
  const text = String(value);
  const size = text.length >= 3 ? 26 : text.length === 2 ? 34 : 40;
  return `<text x="50" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
}

/**
 * SVG markup for one die showing `value`.
 * @param {number} value - the face rolled
 * @param {number} sides - die size; 6 draws pips, others draw a numbered shape
 * @param {string[]} [classes] - extra CSS classes, e.g. 'mini' for a small
 *   history-list version of the same die
 */
export function dieSvg(value, sides, classes = []) {
  let body;
  if (sides === 6) {
    const pips = PIPS[value]
      .map(([cx, cy]) => `<circle class="pip" cx="${cx}" cy="${cy}" r="9" />`)
      .join("");
    body = `<g class="body">${D6_SHAPE}</g>${pips}`;
  } else {
    body = `<g class="body">${SHAPES[sides] ?? DEFAULT_SHAPE}</g>${labelText(value, sides)}`;
  }
  const cls = ["die", ...classes].join(" ");
  return `<svg class="${cls}" viewBox="0 0 100 100" role="img" aria-label="d${sides}: ${value}">${body}</svg>`;
}

/** Wraps a list of dieSvg() strings in a row, with an optional label above it. */
export function diceRow(svgs, label = "") {
  const heading = label ? `<div class="dice-label">${label}</div>` : "";
  return `<div class="dice-group">${heading}<div class="dice-row">${svgs.join("")}</div></div>`;
}

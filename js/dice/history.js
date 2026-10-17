// Roll history, persisted to localStorage. Keeps a short list of past
// rolls (a text summary plus the dice faces rolled, as [value, sides]
// pairs so diceSvg.js can redraw them) so you can glance back at recent
// results without re-rolling. Adapted from AlienTools' dice history.

const HISTORY_KEY = "shadowbook-dice-history";
const HISTORY_LIMIT = 20;

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/** @param {string} text - summary line, e.g. "3d6: [2, 5, 4] = 11" */
export function addHistoryEntry(text, dice = []) {
  const history = loadHistory();
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  history.unshift({ text, dice, time });
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, HISTORY_LIMIT)),
    );
  } catch {
    // History just won't persist (e.g. private browsing with storage blocked).
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

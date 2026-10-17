/* Shadowbook — Shadowrun Anarchy 2.0 companion tools

Planned features:
1. Die roller
2. NPC / contact database
3. Random NPC generator
4. Player character builder
5. Random job generator

Starting with the die roller.
*/

import { rollBasic } from "./dice/roll.js";
import { dieSvg, diceRow } from "./dice/diceSvg.js";
import { loadHistory, addHistoryEntry, clearHistory } from "./dice/history.js";
import { generateStreetname } from "./names/streetname.js";
import {
  generateConventionalName,
  CULTURES,
  isCultureReady,
} from "./names/conventionalName.js";

// --- Tab switching: show whichever #content section matches the clicked
// nav link's href (e.g. "#die-roller" shows <section id="die-roller">). ---
const navLinks = document.querySelectorAll("#sidebar a");
const toolSections = document.querySelectorAll("#content > section");

function showTool(toolId) {
  toolSections.forEach((section) => {
    section.hidden = section.id !== toolId;
  });
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${toolId}`);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showTool(link.getAttribute("href").slice(1));
  });
});

showTool("die-roller");

// --- Die Roller ---
const diceCountInput = document.getElementById("dice-count");
const diceSidesSelect = document.getElementById("dice-sides");
const rollButton = document.getElementById("roll-button");
const rollResults = document.getElementById("roll-results");
const historyList = document.getElementById("dice-history-list");
const historyClearButton = document.getElementById("dice-history-clear");

function renderHistory() {
  historyList.innerHTML = loadHistory()
    .map(
      (entry) => `
        <li class="history-item">
          <span>
            <div class="history-dice">
              ${entry.dice.map(([value, sides]) => dieSvg(value, sides, ["mini"])).join("")}
            </div>
            ${entry.text}
          </span>
          <span class="history-time">${entry.time}</span>
        </li>
      `,
    )
    .join("");
}

rollButton.addEventListener("click", () => {
  const sides = Number(diceSidesSelect.value);
  const num = Math.max(1, Number(diceCountInput.value) || 1);

  const { rolls, sum } = rollBasic({ num, sides });
  const dice = rolls.map((value) => [value, sides]);

  rollResults.innerHTML = `
    ${diceRow(dice.map(([value, s]) => dieSvg(value, s)))}
    <div>Rolled ${num}d${sides}</div>
    <div>Rolls: [${rolls.join(", ")}]</div>
    <div class="accent">Total: ${sum}</div>
  `;

  addHistoryEntry(`${num}d${sides}: [${rolls.join(", ")}] = ${sum}`, dice);
  renderHistory();
});

historyClearButton.addEventListener("click", () => {
  clearHistory();
  renderHistory();
});

renderHistory();

// --- Name Generator ---
const nameTypeSelect = document.getElementById("name-type");
const nameCultureSelect = document.getElementById("name-culture");
const nameGenderSelect = document.getElementById("name-gender");
const nameCountInput = document.getElementById("name-count");
const nameGenerateButton = document.getElementById("name-generate-button");
const nameResults = document.getElementById("name-results");
const conventionalOptions = document.getElementById("conventional-options");

// Culture options come from CULTURES' own `label` field rather than being
// retyped in the HTML, so there's one place that knows what cultures exist.
// Stub cultures with no name data yet (see their _note) show up but can't
// be picked, so the roadmap is visible without being functionally broken.
Object.entries(CULTURES).forEach(([key, data]) => {
  const option = document.createElement("option");
  option.value = key;
  const ready = isCultureReady(key);
  option.textContent = ready ? data.label : `${data.label} (coming soon)`;
  option.disabled = !ready;
  nameCultureSelect.appendChild(option);
});

function updateNameTypeVisibility() {
  conventionalOptions.hidden = nameTypeSelect.value !== "conventional";
}
nameTypeSelect.addEventListener("change", updateNameTypeVisibility);
updateNameTypeVisibility();

nameGenerateButton.addEventListener("click", () => {
  const count = Math.min(50, Math.max(1, Number(nameCountInput.value) || 1));

  const names = Array.from({ length: count }, () => {
    if (nameTypeSelect.value === "streetname") return generateStreetname();
    return generateConventionalName({
      culture: nameCultureSelect.value,
      gender: nameGenderSelect.value || undefined,
    }).fullName;
  });

  nameResults.innerHTML = names
    .map(
      (name) => `
        <li class="history-item">
          <span>${name}</span>
          <button type="button" class="btn-secondary copy-btn" data-name="${name}">
            Copy
          </button>
        </li>
      `,
    )
    .join("");
});

// One listener on the list handles every copy button, including ones
// generated after this runs — no need to re-attach a listener per button.
nameResults.addEventListener("click", (event) => {
  const button = event.target.closest(".copy-btn");
  if (!button) return;

  navigator.clipboard.writeText(button.dataset.name).then(() => {
    const original = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  });
});

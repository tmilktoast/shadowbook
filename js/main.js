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
import { rollRiskPool, isHit, SPECIALIZATION_BONUS } from "./dice/sra.js";
import { generateStreetname } from "./names/streetname.js";
import {
  generateConventionalName,
  CULTURES,
  isCultureReady,
} from "./names/conventionalName.js";
import { CATALOG_SECTIONS } from "./character/catalog.js";
import {
  AMP_TYPES,
  AMP_EFFECTS,
  VEHICLE_TYPES,
  NUYEN_PER_AMP_RATING,
  ampRating,
  validateAmp,
  getVehicleStats,
  vehiclePointsSpent,
  getRiskReduction,
  getAmpRatings,
} from "./character/amps.js";
import { SKILLS, getSpecializationLabel, dicePool } from "./character/skills.js";
import { ATTRIBUTES, getStartingEdge } from "./character/attributes.js";
import {
  loadCustomAmps,
  saveCustomAmp,
  updateCustomAmp,
  deleteCustomAmp,
  getCustomAmp,
} from "./character/customAmps.js";
import { getMetatype } from "./character/metatypes.js";
import { getEssence } from "./character/essence.js";
import { getKeywords } from "./character/character.js";
import { getWoundTable } from "./character/wounds.js";
import { PREGENS } from "./character/pregens.js";

// --- Generic tab switching: clicking a trigger shows the panel whose id
// matches that trigger's target, hides the rest. Used for the main
// sidebar nav, and for any section with its own internal sub-tabs (e.g.
// Shadow Amps' Catalog / Create Custom). Returns a show(id) function so
// the caller can also set the initial tab. ---
function setupTabs(triggers, panels, getTargetId) {
  function show(targetId) {
    panels.forEach((panel) => {
      panel.hidden = panel.id !== targetId;
    });
    triggers.forEach((trigger) => {
      trigger.classList.toggle("active", getTargetId(trigger) === targetId);
    });
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      show(getTargetId(trigger));
    });
  });

  return show;
}

const navLinks = document.querySelectorAll("#sidebar a");
const toolSections = document.querySelectorAll("#content > section");
const showTool = setupTabs(navLinks, toolSections, (link) =>
  link.getAttribute("href").slice(1),
);
showTool("die-roller");

const ampSubtabLinks = document.querySelectorAll("#shadow-amps .subtab-link");
const ampSubtabPanels = document.querySelectorAll("#shadow-amps .subtab-panel");
const showAmpSubtab = setupTabs(
  ampSubtabLinks,
  ampSubtabPanels,
  (btn) => btn.dataset.subtab,
);
showAmpSubtab("amp-catalog");

// --- Die Roller ---
const rollModeSelect = document.getElementById("roll-mode");
const genericRollControls = document.getElementById("generic-roll-controls");
const poolRollControls = document.getElementById("pool-roll-controls");
const diceCountInput = document.getElementById("dice-count");
const diceSidesSelect = document.getElementById("dice-sides");
const poolAttributeDiceInput = document.getElementById("pool-attribute-dice");
const poolSkillDiceInput = document.getElementById("pool-skill-dice");
const poolSpecializedCheckbox = document.getElementById("pool-specialized");
const poolRiskDiceInput = document.getElementById("pool-risk-dice");
const poolRRInput = document.getElementById("pool-rr");
const riskDiceReference = document.getElementById("risk-dice-reference");
const rollButton = document.getElementById("roll-button");
const rollResults = document.getElementById("roll-results");
const historyList = document.getElementById("dice-history-list");
const historyClearButton = document.getElementById("dice-history-clear");

rollModeSelect.addEventListener("change", () => {
  const isPool = rollModeSelect.value === "pool";
  genericRollControls.hidden = isPool;
  poolRollControls.hidden = !isPool;
  riskDiceReference.hidden = !isPool;
});

function renderHistory() {
  historyList.innerHTML = loadHistory()
    .map(
      (entry) => `
        <li class="history-item">
          <span>
            <div class="history-dice">
              ${entry.dice.map(([value, sides, classes = []]) => dieSvg(value, sides, [...classes, "mini"])).join("")}
            </div>
            ${entry.text}
          </span>
          <span class="history-time">${entry.time}</span>
        </li>
      `,
    )
    .join("");
}

function rollGeneric() {
  const sides = Number(diceSidesSelect.value);
  const num = Math.max(1, Number(diceCountInput.value) || 1);

  const { rolls, sum } = rollBasic({ num, sides });
  const dice = rolls.map((value) => [value, sides, []]);

  rollResults.innerHTML = `
    ${diceRow(dice.map(([value, s, classes]) => dieSvg(value, s, classes)))}
    <div>Rolled ${num}d${sides}</div>
    <div>Rolls: [${rolls.join(", ")}]</div>
    <div class="accent">Total: ${sum}</div>
  `;

  addHistoryEntry(`${num}d${sides}: [${rolls.join(", ")}] = ${sum}`, dice);
}

// "1 one, 1 cancelled by RR -> Minor glitch" / "No 1s on Risk Dice."
function glitchSummary({ onesRolled, onesCancelled, glitchTier }) {
  if (onesRolled === 0) return "No 1s on Risk Dice.";
  const cancelled = onesCancelled > 0 ? `, ${onesCancelled} cancelled by RR` : "";
  return `${onesRolled} one${onesRolled === 1 ? "" : "s"} on Risk Dice${cancelled} → ${glitchTier}`;
}

function glitchClass(effectiveOnes) {
  if (effectiveOnes >= 3) return "glitch-disaster";
  if (effectiveOnes === 2) return "glitch-critical";
  if (effectiveOnes === 1) return "glitch-minor";
  return "";
}

function rollPool() {
  const attributeDice = Math.max(0, Number(poolAttributeDiceInput.value) || 0);
  const skillDice = Math.max(0, Number(poolSkillDiceInput.value) || 0);
  const specialized = poolSpecializedCheckbox.checked;
  const specBonus = specialized ? SPECIALIZATION_BONUS : 0;
  const pool = attributeDice + skillDice + specBonus;

  const riskDice = Math.max(0, Number(poolRiskDiceInput.value) || 0);
  const rr = Math.max(0, Math.min(3, Number(poolRRInput.value) || 0));

  const result = rollRiskPool({ pool, riskDice, rr });

  const dice = [
    ...result.normalRolls.map((value) => [value, 6, isHit(value) ? ["hit"] : []]),
    ...result.riskRolls.map((value) => {
      const classes = ["risk"];
      if (isHit(value)) classes.push("hit");
      return [value, 6, classes];
    }),
  ];

  const specNote = specialized ? ` + ${SPECIALIZATION_BONUS} (specialized)` : "";
  const label = `${attributeDice} (Attribute) + ${skillDice} (Skill)${specNote}`;
  const riskNote = result.riskRolls.length ? ` (${result.riskRolls.length} risk)` : "";
  const riskRollsText = result.riskRolls.length
    ? ` + risk [${result.riskRolls.join(", ")}]`
    : "";

  rollResults.innerHTML = `
    ${diceRow(dice.map(([value, s, classes]) => dieSvg(value, s, classes)))}
    <div>${label}: ${pool} dice${riskNote}</div>
    <div>Rolls: [${result.normalRolls.join(", ")}]${riskRollsText}</div>
    <div class="accent">${result.totalHits} hit${result.totalHits === 1 ? "" : "s"}</div>
    ${
      result.riskRolls.length
        ? `<div class="${glitchClass(result.effectiveOnes)}">${glitchSummary(result)}</div>`
        : ""
    }
  `;

  const historyGlitch = result.riskRolls.length ? `, ${result.glitchTier}` : "";
  addHistoryEntry(
    `${label}: ${pool}d6${riskNote} = ${result.totalHits} hit${result.totalHits === 1 ? "" : "s"}${historyGlitch}`,
    dice,
  );
}

rollButton.addEventListener("click", () => {
  if (rollModeSelect.value === "pool") rollPool();
  else rollGeneric();
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

// --- Shadow Amps: Catalog ---
const nuyenFormatter = new Intl.NumberFormat("en-US");
function formatNuyen(amount) {
  return `${nuyenFormatter.format(amount)}¥`;
}

// "heavy pistol" -> "Heavy Pistol"
function titleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Shared by the Catalog list and the Create Custom tab's saved-Amps list —
// both show the same kind of card, just with different meta/footer content.
function renderAmpCard({ name, price, metaItems, description, footer = "" }) {
  return `
    <li class="catalog-entry">
      <div class="catalog-entry-header">
        <span class="catalog-entry-name">${name}</span>
        <span class="catalog-entry-price">${price}</span>
      </div>
      <div class="catalog-entry-meta">
        ${metaItems.filter(Boolean).join("")}
      </div>
      ${description ? `<p class="catalog-entry-description">${description}</p>` : ""}
      ${footer}
    </li>
  `;
}

function sourceBadge(entry) {
  return entry.official
    ? `<span>Source: <span class="source-badge">SRA2</span> ${entry.page}</span>`
    : `<span>Source: <span class="source-badge source-badge-custom">Custom</span></span>`;
}

// Edit/Delete buttons for a custom Amp; official catalog entries get none.
function customAmpFooter(entry) {
  if (entry.official) return "";
  return `
    <button type="button" class="btn-secondary edit-custom-amp-btn" data-id="${entry.id}">
      Edit
    </button>
    <button type="button" class="btn-secondary delete-custom-amp-btn" data-id="${entry.id}">
      Delete
    </button>
  `;
}

function renderCatalogEntry(entry) {
  // Only custom Amps built with the free Body/Handling/Speed allocator
  // carry vehicleStats; official catalog entries already describe their
  // fixed stats in their own `description` text, so this leaves those as-is.
  const vehicleStats = entry.vehicleStats ? getVehicleStats(entry) : null;
  const description = [
    vehicleStats &&
      `Pilot ${vehicleStats.pilot}, Body ${vehicleStats.body}, Handling ${vehicleStats.handling}, Speed ${vehicleStats.speed}, Armor ${vehicleStats.armor}`,
    entry.description,
  ]
    .filter(Boolean)
    .join("<br>");

  return renderAmpCard({
    name: entry.name,
    price: formatNuyen(entry.nuyen),
    metaItems: [
      `<span>${entry.sectionLabel}</span>`,
      entry.item ? `<span>${titleCase(entry.item)}</span>` : "",
      `<span>Rating ${entry.rating}</span>`,
      sourceBadge(entry),
    ],
    description,
    footer: customAmpFooter(entry),
  });
}

// A saved custom Amp, normalized to look like a catalog entry (computed
// rating/nuyen) so it can share renderCatalogEntry. sectionLabel shows the
// Amp's real type (e.g. "Vehicle or Drone") — the "Custom" badge from
// sourceBadge() already covers "this isn't official", no need to repeat
// it here too.
function customAmpAsEntry(amp) {
  const rating = ampRating(amp, { firstQuality: amp.firstQuality });
  return {
    ...amp,
    rating,
    nuyen: rating * NUYEN_PER_AMP_RATING,
    sectionLabel: AMP_TYPES[amp.type]?.label ?? amp.type,
  };
}

const ampTypeFilter = document.getElementById("amp-type-filter");
const ampSortSelect = document.getElementById("amp-sort");
const ampCatalogList = document.getElementById("amp-catalog-list");

// Type filter options come from CATALOG_SECTIONS' own labels, same
// single-source-of-truth pattern as the Name Generator's culture select.
const allTypesOption = document.createElement("option");
allTypesOption.value = "";
allTypesOption.textContent = "All Types";
ampTypeFilter.appendChild(allTypesOption);

Object.entries(CATALOG_SECTIONS).forEach(([key, section]) => {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = section.label;
  ampTypeFilter.appendChild(option);
});

const customFilterOption = document.createElement("option");
customFilterOption.value = "custom";
customFilterOption.textContent = "Custom";
ampTypeFilter.appendChild(customFilterOption);

const AMP_SORTERS = {
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => a.rating - b.rating,
  cost: (a, b) => a.nuyen - b.nuyen,
};

function renderAmpCatalog() {
  const sectionKey = ampTypeFilter.value;
  const custom = loadCustomAmps().map(customAmpAsEntry);

  let entries;
  if (sectionKey === "custom") {
    entries = custom;
  } else if (sectionKey) {
    const section = CATALOG_SECTIONS[sectionKey];
    entries = section.entries.map((entry) => ({ ...entry, sectionLabel: section.label }));
  } else {
    const official = Object.values(CATALOG_SECTIONS).flatMap((section) =>
      section.entries.map((entry) => ({ ...entry, sectionLabel: section.label })),
    );
    entries = [...official, ...custom];
  }

  entries.sort(AMP_SORTERS[ampSortSelect.value] ?? AMP_SORTERS.name);

  ampCatalogList.innerHTML = entries.map(renderCatalogEntry).join("");
}

ampTypeFilter.addEventListener("change", renderAmpCatalog);
ampSortSelect.addEventListener("change", renderAmpCatalog);

// One delegated listener handles Edit/Delete for every custom Amp card in
// the catalog view. loadAmpForEditing/deleteCustomAmp are defined below,
// but that's fine — this callback only runs on a later click, by which
// point the whole module (including them) has finished loading.
ampCatalogList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-custom-amp-btn");
  if (editButton) {
    const amp = getCustomAmp(editButton.dataset.id);
    if (amp) loadAmpForEditing(amp);
    return;
  }
  const deleteButton = event.target.closest(".delete-custom-amp-btn");
  if (deleteButton) {
    deleteCustomAmp(deleteButton.dataset.id);
    renderCustomAmpsList();
    renderAmpCatalog();
  }
});

// --- Shadow Amps: Create Custom ---
// Builds one Amp from scratch using the same rules as the book (amps.js's
// ampRating()/validateAmp() — not reimplemented here). Anything built here
// is homebrew, not official, so it's shown as "Source: Custom" and never
// passes through markOfficial().
const ampNameInput = document.getElementById("amp-name");
const ampDescriptionInput = document.getElementById("amp-description");
const ampTypeSelect = document.getElementById("amp-type-select");
const ampVehicleTypeWrap = document.getElementById("amp-vehicle-type-wrap");
const ampVehicleTypeSelect = document.getElementById("amp-vehicle-type");
const ampVehicleStatsWrap = document.getElementById("amp-vehicle-stats-wrap");
const ampVehicleBodyInput = document.getElementById("amp-vehicle-body");
const ampVehicleHandlingInput = document.getElementById("amp-vehicle-handling");
const ampVehicleSpeedInput = document.getElementById("amp-vehicle-speed");
const ampVehiclePointsCounter = document.getElementById(
  "amp-vehicle-points-counter",
);
const ampFirstQualityWrap = document.getElementById("amp-first-quality-wrap");
const ampFirstQualityCheckbox = document.getElementById("amp-first-quality");
const ampEffectSelect = document.getElementById("amp-effect-select");
const ampTargetSkillWrap = document.getElementById("amp-target-skill-wrap");
const ampTargetSkillSelect = document.getElementById("amp-target-skill");
const ampTargetAttributeWrap = document.getElementById(
  "amp-target-attribute-wrap",
);
const ampTargetAttributeSelect = document.getElementById(
  "amp-target-attribute",
);
const ampTargetSpecWrap = document.getElementById(
  "amp-target-specialization-wrap",
);
const ampTargetSpecSkillSelect = document.getElementById(
  "amp-target-spec-skill",
);
const ampTargetSpecTextInput = document.getElementById("amp-target-spec-text");
const ampNegativeCostWrap = document.getElementById("amp-negative-cost-wrap");
const ampNegativeCostInput = document.getElementById("amp-negative-cost");
const ampAddEffectButton = document.getElementById("amp-add-effect");
const ampEffectsList = document.getElementById("amp-effects-list");
const ampSummary = document.getElementById("amp-summary");
const ampValidationList = document.getElementById("amp-validation-list");
const ampSaveButton = document.getElementById("amp-save");
const ampCancelEditButton = document.getElementById("amp-cancel-edit");
const customAmpsList = document.getElementById("custom-amps-list");

const customAmp = { type: "", name: "", description: "", effects: [] };

function populateSelect(select, entriesById, { labelOf = (e) => e.label } = {}) {
  Object.entries(entriesById).forEach(([id, entry]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = labelOf(entry);
    select.appendChild(option);
  });
}

populateSelect(ampTypeSelect, AMP_TYPES);
populateSelect(ampVehicleTypeSelect, VEHICLE_TYPES);
populateSelect(ampTargetSkillSelect, SKILLS);
populateSelect(ampTargetSpecSkillSelect, SKILLS);
populateSelect(ampTargetAttributeSelect, ATTRIBUTES);

customAmp.type = ampTypeSelect.value;
customAmp.vehicleType = ampVehicleTypeSelect.value;
customAmp.vehicleStats = { body: 0, handling: 0, speed: 0 };

function refreshEffectOptions() {
  const vehicleKind = VEHICLE_TYPES[ampVehicleTypeSelect.value]?.kind;

  ampEffectSelect.innerHTML = "";
  Object.entries(AMP_EFFECTS)
    .filter(([, def]) => def.types.includes(ampTypeSelect.value))
    // Some vehicle effects (extra drone, autonomous medkit) only apply to
    // a particular vehicle kind (e.g. drones) — validateAmp would catch a
    // mismatch after the fact, but better to not offer it in the first place.
    .filter(([, def]) => !def.vehicleKinds || def.vehicleKinds.includes(vehicleKind))
    .forEach(([id, def]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = def.label;
      ampEffectSelect.appendChild(option);
    });
  updateEffectInputVisibility();
}

function updateEffectInputVisibility() {
  const def = AMP_EFFECTS[ampEffectSelect.value];
  ampTargetSkillWrap.hidden = def?.target !== "skill";
  ampTargetAttributeWrap.hidden = def?.target !== "attribute";
  ampTargetSpecWrap.hidden = def?.target !== "specialization";
  ampNegativeCostWrap.hidden = !def?.costRange;
}

function describeTarget(def, target) {
  if (!def?.target || !target) return "";
  if (def.target === "skill") return SKILLS[target]?.label ?? target;
  if (def.target === "attribute") return ATTRIBUTES[target]?.label ?? target;
  if (def.target === "specialization") {
    const [skillId, spec] = target.split("/");
    return `${SKILLS[skillId]?.label ?? skillId} (${spec})`;
  }
  return target;
}

function renderAmpCreator() {
  ampEffectsList.innerHTML = customAmp.effects
    .map((entry, index) => {
      const def = AMP_EFFECTS[entry.effect];
      const target = describeTarget(def, entry.target);
      const cost = entry.cost ?? def?.cost ?? 0;
      const sign = cost >= 0 ? "+" : "";
      return `
        <li class="history-item">
          <span>${def?.label ?? entry.effect}${target ? ` — ${target}` : ""} (${sign}${cost})</span>
          <button type="button" class="btn-secondary remove-effect-btn" data-index="${index}">
            Remove
          </button>
        </li>
      `;
    })
    .join("");

  if (customAmp.type === "vehicle") {
    const pool = VEHICLE_TYPES[customAmp.vehicleType]?.pointPool ?? 12;
    const spent = vehiclePointsSpent(customAmp.vehicleStats);
    ampVehiclePointsCounter.textContent = `${spent} / ${pool} points`;
    ampVehiclePointsCounter.classList.toggle("budget-bad", spent !== pool);
  }

  const type = AMP_TYPES[customAmp.type];
  const firstQuality =
    customAmp.type === "quality" && ampFirstQualityCheckbox.checked;
  const rating = ampRating(customAmp, { firstQuality });
  const cost = rating * NUYEN_PER_AMP_RATING;
  const vehicleStats =
    customAmp.type === "vehicle" ? getVehicleStats(customAmp) : null;

  ampSummary.innerHTML = `
    <div class="catalog-entry-header">
      <span class="catalog-entry-name">${customAmp.name || "Unnamed Amp"}</span>
      <span class="catalog-entry-price">${formatNuyen(cost)}</span>
    </div>
    <div class="catalog-entry-meta">
      <span>${type?.label ?? ""}</span>
      <span>Rating ${rating}</span>
      <span>Source: <span class="source-badge source-badge-custom">Custom</span></span>
    </div>
    ${vehicleStats ? `<p class="catalog-entry-description">Pilot ${vehicleStats.pilot}, Body ${vehicleStats.body}, Handling ${vehicleStats.handling}, Speed ${vehicleStats.speed}, Armor ${vehicleStats.armor}</p>` : ""}
    ${customAmp.description ? `<p class="catalog-entry-description">${customAmp.description}</p>` : ""}
  `;

  const problems = [];
  validateAmp(customAmp, problems);
  ampValidationList.innerHTML = problems.length
    ? problems.map((p) => `<li class="validation-error">${p}</li>`).join("")
    : `<li class="validation-ok">Looks valid.</li>`;
  ampSaveButton.disabled = problems.length > 0;
}

function updateTypeDependentVisibility() {
  const isVehicle = customAmp.type === "vehicle";
  ampVehicleTypeWrap.hidden = !isVehicle;
  ampVehicleStatsWrap.hidden = !isVehicle;
  ampFirstQualityWrap.hidden = customAmp.type !== "quality";
}

// Pre-fills the Body/Handling/Speed tumblers from the selected vehicle
// type's own example split — a starting point, not a lock-in; the book
// says its type list "is not exhaustive," so these stay freely editable
// up to the type's pointPool.
function fillVehicleStatsFromType() {
  const preset = VEHICLE_TYPES[ampVehicleTypeSelect.value];
  if (!preset) return;
  customAmp.vehicleStats = {
    body: preset.body,
    handling: preset.handling,
    speed: preset.speed,
  };
  ampVehicleBodyInput.value = preset.body;
  ampVehicleHandlingInput.value = preset.handling;
  ampVehicleSpeedInput.value = preset.speed;
}

ampTypeSelect.addEventListener("change", () => {
  customAmp.type = ampTypeSelect.value;
  updateTypeDependentVisibility();
  if (customAmp.type === "vehicle") fillVehicleStatsFromType();
  refreshEffectOptions();
  renderAmpCreator();
});

ampVehicleTypeSelect.addEventListener("change", () => {
  customAmp.vehicleType = ampVehicleTypeSelect.value;
  fillVehicleStatsFromType();
  refreshEffectOptions();
  renderAmpCreator();
});

[ampVehicleBodyInput, ampVehicleHandlingInput, ampVehicleSpeedInput].forEach(
  (input) => {
    input.addEventListener("input", () => {
      customAmp.vehicleStats = {
        body: Number(ampVehicleBodyInput.value) || 0,
        handling: Number(ampVehicleHandlingInput.value) || 0,
        speed: Number(ampVehicleSpeedInput.value) || 0,
      };
      renderAmpCreator();
    });
  },
);

ampFirstQualityCheckbox.addEventListener("change", renderAmpCreator);

ampNameInput.addEventListener("input", () => {
  customAmp.name = ampNameInput.value;
  renderAmpCreator();
});

ampDescriptionInput.addEventListener("input", () => {
  customAmp.description = ampDescriptionInput.value;
  renderAmpCreator();
});

ampEffectSelect.addEventListener("change", updateEffectInputVisibility);

ampAddEffectButton.addEventListener("click", () => {
  const effectId = ampEffectSelect.value;
  const def = AMP_EFFECTS[effectId];
  if (!def) return;

  const entry = { effect: effectId };
  if (def.target === "skill") entry.target = ampTargetSkillSelect.value;
  if (def.target === "attribute") entry.target = ampTargetAttributeSelect.value;
  if (def.target === "specialization") {
    const spec = ampTargetSpecTextInput.value.trim();
    if (!spec) return;
    entry.target = `${ampTargetSpecSkillSelect.value}/${spec}`;
  }
  if (def.costRange) entry.cost = Number(ampNegativeCostInput.value);

  customAmp.effects.push(entry);
  ampTargetSpecTextInput.value = "";
  renderAmpCreator();
});

ampEffectsList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-effect-btn");
  if (!button) return;
  customAmp.effects.splice(Number(button.dataset.index), 1);
  renderAmpCreator();
});

updateTypeDependentVisibility();
refreshEffectOptions();
renderAmpCreator();

function renderCustomAmpsList() {
  customAmpsList.innerHTML = loadCustomAmps()
    .map(customAmpAsEntry)
    .map(renderCatalogEntry)
    .join("");
}

// Tracks whether Save should create a new Amp or overwrite the one being
// edited. Set by loadAmpForEditing (triggered from either saved-Amp list),
// cleared by a successful update or Cancel Edit.
let editingAmpId = null;

function resetAmpForm() {
  editingAmpId = null;
  ampNameInput.value = "";
  ampDescriptionInput.value = "";
  ampTypeSelect.value = ampTypeSelect.options[0].value;
  customAmp.type = ampTypeSelect.value;
  customAmp.name = "";
  customAmp.description = "";
  customAmp.effects = [];
  ampFirstQualityCheckbox.checked = false;
  updateTypeDependentVisibility();
  if (customAmp.type === "vehicle") fillVehicleStatsFromType();
  refreshEffectOptions();
  ampSaveButton.textContent = "Save Custom Amp";
  ampCancelEditButton.hidden = true;
  renderAmpCreator();
}

function loadAmpForEditing(amp) {
  editingAmpId = amp.id;
  customAmp.type = amp.type;
  customAmp.name = amp.name ?? "";
  customAmp.description = amp.description ?? "";
  customAmp.effects = amp.effects.map((entry) => ({ ...entry }));
  customAmp.vehicleType = amp.vehicleType ?? ampVehicleTypeSelect.value;
  customAmp.vehicleStats = amp.vehicleStats
    ? { ...amp.vehicleStats }
    : { body: 0, handling: 0, speed: 0 };

  ampNameInput.value = customAmp.name;
  ampDescriptionInput.value = customAmp.description;
  ampTypeSelect.value = customAmp.type;
  ampFirstQualityCheckbox.checked = Boolean(amp.firstQuality);
  updateTypeDependentVisibility();
  if (customAmp.type === "vehicle") {
    ampVehicleTypeSelect.value = customAmp.vehicleType;
    ampVehicleBodyInput.value = customAmp.vehicleStats.body;
    ampVehicleHandlingInput.value = customAmp.vehicleStats.handling;
    ampVehicleSpeedInput.value = customAmp.vehicleStats.speed;
  }
  // refreshEffectOptions() filters by the selected vehicle type's kind, so
  // it must run after ampVehicleTypeSelect.value is set above, not before.
  refreshEffectOptions();

  ampSaveButton.textContent = "Update Custom Amp";
  ampCancelEditButton.hidden = false;
  renderAmpCreator();
  showTool("shadow-amps");
  showAmpSubtab("amp-creator");
}

ampSaveButton.addEventListener("click", () => {
  const amp = {
    type: customAmp.type,
    name: customAmp.name,
    description: customAmp.description,
    effects: customAmp.effects,
  };
  if (amp.type === "quality") amp.firstQuality = ampFirstQualityCheckbox.checked;
  if (amp.type === "vehicle") {
    amp.vehicleType = ampVehicleTypeSelect.value;
    amp.vehicleStats = { ...customAmp.vehicleStats };
  }

  if (editingAmpId) {
    updateCustomAmp(editingAmpId, amp);
    resetAmpForm();
  } else {
    saveCustomAmp(amp);
  }
  renderCustomAmpsList();
  renderAmpCatalog();
});

ampCancelEditButton.addEventListener("click", resetAmpForm);

customAmpsList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-custom-amp-btn");
  if (editButton) {
    const amp = getCustomAmp(editButton.dataset.id);
    if (amp) loadAmpForEditing(amp);
    return;
  }
  const deleteButton = event.target.closest(".delete-custom-amp-btn");
  if (deleteButton) {
    deleteCustomAmp(deleteButton.dataset.id);
    renderCustomAmpsList();
    renderAmpCatalog();
  }
});

renderCustomAmpsList();
renderAmpCatalog();

// --- Character Database ---
// Short column header for an Attribute, e.g. "Strength" -> "STR" (matches
// the abbreviations the printed sheets use in the skill table's +Att. column).
function attributeAbbrev(id) {
  return (ATTRIBUTES[id]?.label ?? id).slice(0, 3).toUpperCase();
}

// One <tr> per Skill, plus one indented sub-row per specialization. A
// specialization row only gets the +2 dice bonus (and "+2" in its label)
// when it's a formally bought specialization (character.skills[id].
// specializations); a specialization that only has RR from an Amp still
// gets a row (to show where that RR applies) but no bonus — the printed
// sheets draw both the same way, so this distinction is easy to lose.
function renderSkillTable(character) {
  const rr = getRiskReduction(character);
  const rows = Object.entries(character.skills)
    .map(([id, { rating, specializations }]) => {
      const skill = SKILLS[id];
      if (!skill) return "";
      const skillAttr = skill.linkedAttributes[0];
      const skillDice = dicePool(rating, character.attributes[skillAttr] ?? 0);
      const skillRR = rr.skill[id] ?? 0;

      const rrOnlySpecs = Object.keys(rr.specialization)
        .filter((key) => key.startsWith(`${id}/`))
        .map((key) => key.slice(id.length + 1))
        .filter((spec) => !specializations.includes(spec));

      const specRows = [...specializations, ...rrOnlySpecs]
        .map((spec) => {
          const formal = specializations.includes(spec);
          const specAttr = skill.specializations?.[spec]?.attributes[0] ?? skillAttr;
          const specDice = dicePool(rating, character.attributes[specAttr] ?? 0, formal);
          const specRR = (rr.specialization[`${id}/${spec}`] ?? 0) + skillRR;
          const label = getSpecializationLabel(id, spec);
          return `
            <tr class="skill-spec-row">
              <td>${label}${formal ? ` +${SPECIALIZATION_BONUS}` : ""}</td>
              <td></td>
              <td>${attributeAbbrev(specAttr)}</td>
              <td>${specDice}</td>
              <td>${specRR || ""}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr>
          <td>${skill.label}</td>
          <td>${rating}</td>
          <td>${attributeAbbrev(skillAttr)}</td>
          <td>${skillDice}</td>
          <td>${skillRR || ""}</td>
        </tr>
        ${specRows}
      `;
    })
    .join("");

  return `
    <table class="data-table skills-table">
      <thead>
        <tr><th>Skill</th><th>Rtg.</th><th>+Att.</th><th>=DP</th><th>RR</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAmpTable(character) {
  const rows = getAmpRatings(character)
    .map(({ amp, rating }) => {
      const essenceCost = AMP_TYPES[amp.type]?.essenceCost;
      return `
        <tr>
          <td><strong>${amp.name}</strong>${amp.description ? ` — ${amp.description}` : ""}</td>
          <td>${essenceCost ? `-${essenceCost}` : ""}</td>
          <td>${rating}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <table class="data-table amps-table">
      <thead><tr><th>Shadow Amp</th><th>Ess.</th><th>Rtg.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderWeaponsTable(character) {
  const rows = character.weapons
    .map(
      (w) => `
        <tr>
          <td>${w.name}${w.subtype ? ` (${w.subtype})` : ""}</td>
          <td>${w.dv}</td>
          <td>${w.range}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <table class="data-table weapons-table">
      <thead><tr><th>Weapon</th><th>DV</th><th>Range</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderWoundTable(character) {
  const rows = getWoundTable(character)
    .map(
      (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${row.light}</td>
          <td>${row.serious}</td>
          <td>${row.incap}</td>
        </tr>
      `,
    )
    .join("");
  return `
    <table class="data-table">
      <thead>
        <tr><th></th><th>Light</th><th>Serious</th><th>Incap.</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPortrait(character) {
  if (character.portrait) {
    return `<img class="character-portrait" src="${character.portrait}" alt="${character.streetname} portrait" />`;
  }
  return `
    <div class="character-portrait character-portrait-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
      </svg>
    </div>
  `;
}

function renderCharacterCard(character) {
  const metatype = getMetatype(character.metatype);
  const edge = getStartingEdge(character.metatype);
  const essence = getEssence(character);
  const keywords = getKeywords(character);
  const subtitle = [character.keywords.role, metatype?.label]
    .filter(Boolean)
    .join(", ");

  const attributeBoxes =
    Object.entries(character.attributes)
      .map(
        ([id, rating]) => `
          <div class="attr-box">
            <span class="attr-label">${ATTRIBUTES[id]?.label ?? id}</span>
            <span class="attr-value">${rating}</span>
          </div>
        `,
      )
      .join("") +
    `
      <div class="attr-box attr-box-edge">
        <span class="attr-label">Edge</span>
        <span class="attr-value">${edge}</span>
      </div>
    `;

  return `
    <div class="catalog-entry character-card">
      <div class="character-header">
        ${renderPortrait(character)}
        <div class="character-header-text">
          <h3 class="character-name">${character.streetname}</h3>
          ${subtitle ? `<div class="character-subtitle">${subtitle}</div>` : ""}
          <div class="catalog-entry-meta">
            <span>Essence ${essence}</span>
            ${
              character.official
                ? `<span>Source: <span class="source-badge">${character.source.book}</span> ${character.source.page}</span>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="character-attributes">${attributeBoxes}</div>

      <div class="character-columns">
        <div class="character-main">
          <h4>Skills</h4>
          ${renderSkillTable(character)}

          ${character.knowledgeSkills.length ? `<h4>Knowledge Skills</h4><p>${character.knowledgeSkills.join(", ")}</p>` : ""}

          <h4>Shadow Amps</h4>
          ${renderAmpTable(character)}

          ${character.weapons.length ? `<h4>Weapons</h4>${renderWeaponsTable(character)}` : ""}

          <h4>Wounds</h4>
          ${renderWoundTable(character)}

          ${character.equipment.length ? `<h4>Equipment</h4><p>${character.equipment.join(", ")}</p>` : ""}
        </div>

        <div class="character-sidebar">
          <h4>Keywords</h4>
          <p>${keywords.join(" • ")}</p>

          ${character.dispositions.length ? `<h4>Dispositions</h4><p>${character.dispositions.join(" • ")}</p>` : ""}

          ${
            character.cues.length
              ? `<h4>Cues</h4><ul class="character-list">${character.cues.map((c) => `<li>"${c}"</li>`).join("")}</ul>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

const characterDatabaseList = document.getElementById("character-database-list");
characterDatabaseList.innerHTML = PREGENS.map(renderCharacterCard).join("");

// Click a portrait to see it full-size. Only real <img> portraits are
// clickable (the placeholder is a plain div), so this naturally no-ops
// for characters without one.
const portraitLightbox = document.getElementById("portrait-lightbox");
const portraitLightboxImg = document.getElementById("portrait-lightbox-img");
const portraitLightboxClose = document.getElementById("portrait-lightbox-close");

function openPortraitLightbox(img) {
  portraitLightboxImg.src = img.src;
  portraitLightboxImg.alt = img.alt;
  portraitLightbox.hidden = false;
}

function closePortraitLightbox() {
  portraitLightbox.hidden = true;
  portraitLightboxImg.src = "";
}

characterDatabaseList.addEventListener("click", (event) => {
  const portrait = event.target.closest("img.character-portrait");
  if (portrait) openPortraitLightbox(portrait);
});

portraitLightboxClose.addEventListener("click", closePortraitLightbox);
portraitLightbox.addEventListener("click", (event) => {
  if (event.target === portraitLightbox) closePortraitLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !portraitLightbox.hidden) closePortraitLightbox();
});

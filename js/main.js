/* Shadowbook — Shadowrun Anarchy 2.0 companion tools

Planned features:
1. Die roller
2. NPC / contact database
3. Random NPC generator
4. Player character builder
5. Random job generator

Starting with the die roller.
*/

import { rollBasic, randInt } from "./dice/roll.js";
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
import { METATYPES, getMetatype } from "./character/metatypes.js";
import { getEssence } from "./character/essence.js";
import { getKeywords } from "./character/character.js";
import { getWoundTable } from "./character/wounds.js";
import { PREGENS, getPregen } from "./character/pregens.js";
import { setKindOverride } from "./character/characterKindOverrides.js";
import { resolveVariant } from "./character/template.js";
import { TEMPLATES, getTemplate } from "./character/templates.js";
import { CRITTERS, getCritter } from "./character/critters.js";
import {
  loadMinorCharacters,
  saveMinorCharacter,
  deleteMinorCharacter,
} from "./character/minorCharacters.js";

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
// Honor a direct link's target tab: a character sheet link
// ("?character=<id>") always means the Character Database; otherwise a
// "#section-id" hash (e.g. the Character Database's own "back to list"
// link) picks that section, falling back to the usual default. Needed
// because clicking a character list row is a full page navigation, not
// client-side routing — this is what picks the right tab back up on
// that fresh load. (Templates don't navigate at all — they expand in
// place, see the Templates wiring further down.)
const linkedSectionId = location.hash.slice(1);
const hasLinkedSection = [...toolSections].some((s) => s.id === linkedSectionId);
const linkedParams = new URLSearchParams(location.search);
showTool(
  linkedParams.has("character")
    ? "character-database"
    : hasLinkedSection
      ? linkedSectionId
      : "die-roller",
);

const ampSubtabLinks = document.querySelectorAll("#shadow-amps .subtab-link");
const ampSubtabPanels = document.querySelectorAll("#shadow-amps .subtab-panel");
const showAmpSubtab = setupTabs(
  ampSubtabLinks,
  ampSubtabPanels,
  (btn) => btn.dataset.subtab,
);
showAmpSubtab("amp-catalog");

const characterDbSubtabLinks = document.querySelectorAll(
  "#character-database .subtab-link",
);
const characterDbSubtabPanels = document.querySelectorAll(
  "#character-database .subtab-panel",
);
const showCharacterDbSubtab = setupTabs(
  characterDbSubtabLinks,
  characterDbSubtabPanels,
  (btn) => btn.dataset.subtab,
);
// "?view=<pcs|npcs|templates|critters>" is how a detail view's own "back
// to list" link gets back to the right subtab specifically (plain
// "#character-database" alone defaults to the PC subtab).
const characterDbSubtabKeys = ["prime", "minor", "templates", "critters"];
const linkedDbView = linkedParams.get("view");
showCharacterDbSubtab(
  characterDbSubtabKeys.includes(linkedDbView)
    ? `character-database-${linkedDbView}`
    : "character-database-prime",
);

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
const poolAdvantageControl = document.getElementById("pool-advantage-control");
const poolAdvantageSlider = document.getElementById("pool-advantage-slider");
const poolAdvantageLabels = document.querySelectorAll(
  "#pool-advantage-control .advantage-slider-labels span",
);
const riskDiceReference = document.getElementById("risk-dice-reference");
const rollButton = document.getElementById("roll-button");
const rollResults = document.getElementById("roll-results");
const historyList = document.getElementById("dice-history-list");
const historyClearButton = document.getElementById("dice-history-clear");

function updateRollModeVisibility() {
  const isPool = rollModeSelect.value === "pool";
  genericRollControls.hidden = isPool;
  poolRollControls.hidden = !isPool;
  poolAdvantageControl.hidden = !isPool;
  riskDiceReference.hidden = !isPool;
}
rollModeSelect.addEventListener("change", updateRollModeVisibility);
updateRollModeVisibility();

// -1/0/1 slider value -> rollRiskPool()'s stance ("disadvantage" hits only
// on 6s, "advantage" hits on 4-6 too — core book p. 65, see sra.js).
const ADVANTAGE_STANCES = { "-1": "disadvantage", "0": "normal", "1": "advantage" };

function currentStance() {
  return ADVANTAGE_STANCES[poolAdvantageSlider.value];
}

function updateAdvantageLabel() {
  poolAdvantageLabels.forEach((label) => {
    label.classList.toggle("active", label.dataset.value === poolAdvantageSlider.value);
  });
}
poolAdvantageSlider.addEventListener("input", updateAdvantageLabel);
updateAdvantageLabel();

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
  const stance = currentStance();

  const result = rollRiskPool({ pool, riskDice, rr, stance });

  const dice = [
    ...result.normalRolls.map((value) => [value, 6, isHit(value, stance) ? ["hit"] : []]),
    ...result.riskRolls.map((value) => {
      const classes = ["risk"];
      if (isHit(value, stance)) classes.push("hit");
      return [value, 6, classes];
    }),
  ];

  const specNote = specialized ? ` + ${SPECIALIZATION_BONUS} (specialized)` : "";
  const stanceNote = stance !== "normal" ? ` (${stance})` : "";
  const label = `${attributeDice} (Attribute) + ${skillDice} (Skill)${specNote}${stanceNote}`;
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
// Shared with the NPC Generator's own culture select further down, which
// also wants a leading "Random" option (picked among ready cultures at
// generation time) that this tool's plain culture select doesn't need.
function populateCultureSelect(select, { includeRandom = false } = {}) {
  if (includeRandom) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Random";
    select.appendChild(option);
  }
  Object.entries(CULTURES).forEach(([key, data]) => {
    const option = document.createElement("option");
    option.value = key;
    const ready = isCultureReady(key);
    option.textContent = ready ? data.label : `${data.label} (coming soon)`;
    option.disabled = !ready;
    select.appendChild(option);
  });
}

populateCultureSelect(nameCultureSelect);

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
// the abbreviations the printed sheets use in the skill table's +Att.
// column). A Template skill can list two linked Attributes instead of one
// (the book prints "4+L/C" for e.g. Conjuring, tradition-dependent) —
// `id` is then an array, abbreviated and joined the same way.
function attributeAbbrev(id) {
  if (Array.isArray(id)) return id.map(attributeAbbrev).join("/");
  return (ATTRIBUTES[id]?.label ?? id).slice(0, 3).toUpperCase();
}

// RR shown as filled dots, one per point, like the printed sheets —
// easier to read at a glance than a bare number.
function rrDots(n) {
  return n ? `<span class="rr-dots" title="RR ${n}">${"●".repeat(n)}</span>` : "";
}

// One <tbody> per Skill (its own row plus one indented sub-row per
// specialization), so CSS can zebra-stripe by Skill group the way the
// book does rather than by raw row. A specialization row only gets the
// +2 dice bonus (and "+2" in its label) when it's a formally bought
// specialization (character.skills[id].specializations); a
// specialization that only has RR from an Amp still gets a row (to show
// where that RR applies) but no bonus — the printed sheets draw both the
// same way, so this distinction is easy to lose.
function renderSkillTable(character) {
  const rr = getRiskReduction(character);
  const groups = Object.entries(character.skills)
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
              <td>${rrDots(specRR)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tbody>
          <tr>
            <td>${skill.label}</td>
            <td>${rating}</td>
            <td>${attributeAbbrev(skillAttr)}</td>
            <td>${skillDice}</td>
            <td>${rrDots(skillRR)}</td>
          </tr>
          ${specRows}
        </tbody>
      `;
    })
    .join("");

  return `
    <table class="data-table skills-table">
      <thead>
        <tr><th>Skill</th><th>Rtg.</th><th>+Att.</th><th>=DP</th><th>RR</th></tr>
      </thead>
      ${groups}
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

// A small round thumbnail for the list row — same idea as renderPortrait()
// but sized down, and decorative (alt="") since the streetname next to it
// already says who this is.
function renderPortraitThumb(character) {
  if (character.portrait) {
    return `<img class="character-thumb" src="${character.portrait}" alt="" />`;
  }
  return `
    <div class="character-thumb character-thumb-placeholder">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
      </svg>
    </div>
  `;
}

// One row per character in the database list: thumbnail, name, metatype,
// role, and a compact attribute summary, clickable through to the full
// sheet.
function renderCharacterListRow(character) {
  const metatype = getMetatype(character.metatype);
  const attrSummary = Object.entries(character.attributes)
    .map(([id, rating]) => `${attributeAbbrev(id)} ${rating}`)
    .join(" · ");
  const href = `?character=${encodeURIComponent(character.id)}#character-database`;

  return `
    <a class="catalog-entry character-row" href="${href}">
      <div class="character-row-main">
        ${renderPortraitThumb(character)}
        <div>
          <div class="catalog-entry-header">
            <span class="catalog-entry-name">${character.streetname}</span>
            ${character.pregen ? `<span class="pregen-badge">Pregen</span>` : ""}
          </div>
          <div class="catalog-entry-meta">
            ${[
              metatype ? `<span>${metatype.label}</span>` : "",
              character.keywords.role ? `<span>${character.keywords.role}</span>` : "",
              `<span>${attrSummary}</span>`,
            ]
              .filter(Boolean)
              .join("")}
          </div>
        </div>
      </div>
    </a>
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
      <div class="attr-box">
        <span class="attr-label">Edge</span>
        <span class="attr-value">${edge}</span>
      </div>
      <div class="attr-essence">
        <span class="attr-label">Essence</span>
        <span class="attr-value">${essence}</span>
      </div>
    `;

  return `
    <div class="catalog-entry character-card">
      <div class="character-header">
        <div class="character-name-row">
          <h3 class="character-name">${character.streetname}</h3>
          ${character.pregen ? `<span class="pregen-badge">Pregen</span>` : ""}
          <select class="kind-select" data-character-id="${character.id}" aria-label="PC or NPC">
            <option value="pc" ${character.kind === "pc" ? "selected" : ""}>PC</option>
            <option value="npc" ${character.kind === "npc" ? "selected" : ""}>NPC</option>
          </select>
        </div>
        ${subtitle ? `<div class="character-subtitle">${subtitle}</div>` : ""}
        ${
          character.official
            ? `<div class="catalog-entry-meta"><span>Source: <span class="source-badge">${character.source.book}</span> ${character.source.page}</span></div>`
            : ""
        }
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
          ${renderPortrait(character)}

          <h4>Keywords</h4>
          <ul class="character-tagged-list">${keywords.map((k) => `<li>${k}</li>`).join("")}</ul>

          ${
            character.dispositions.length
              ? `<h4>Dispositions</h4><ul class="character-tagged-list">${character.dispositions.map((d) => `<li>${d}</li>`).join("")}</ul>`
              : ""
          }

          ${
            character.cues.length
              ? `<h4>Cues</h4><ul class="character-tagged-list">${character.cues.map((c) => `<li>"${c}"</li>`).join("")}</ul>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

// --- Templates (Character Database) ---
// Stock NPC templates (template.js) are resolved against a chosen
// metatype rather than built for one, so the detail view gets a
// metatype picker instead of a fixed attribute row. A field with an
// optional Shadow Amp shows both numbers inline ("book style") rather
// than needing its own toggle.
const TEMPLATE_DEFAULT_METATYPE = "human";

// One skill/specialization line in the book's own notation:
// "<b>average hits</b> (rank+ATTR, RR n) [with Amp: hits (rank+ATTR, RR n)]".
function templateSkillLine(entry, metatype) {
  const attr = attributeAbbrev(entry.attribute);
  const hits = resolveVariant(entry.averageHits, { metatype });
  const rank = resolveVariant(entry.rank, { metatype });
  const rr = resolveVariant(entry.rr, { metatype });
  let line = `<strong>${hits}</strong> (${rank}+${attr}, RR ${rr})`;

  const amp =
    entry.averageHits.ampVariant?.amp ??
    entry.rank.ampVariant?.amp ??
    entry.rr.ampVariant?.amp;
  if (amp) {
    const ampHits = resolveVariant(entry.averageHits, { metatype, amp });
    const ampRank = resolveVariant(entry.rank, { metatype, amp });
    const ampRR = resolveVariant(entry.rr, { metatype, amp });
    line += ` <span class="template-amp-variant">[with ${amp}: ${ampHits} (${ampRank}+${attr}, RR ${ampRR})]</span>`;
  }
  return line;
}

// `note` is an optional free-text annotation (template.js) for a rule a
// skill/specialization's fixed fields have no room for — e.g. one of the
// book's "CHOOSE 1 SKILL AND SPECIALIZATION" alternatives. Shown as a
// small muted aside under the line, same treatment as a weapon's note.
function templateNoteLine(note) {
  return note ? `<div class="template-note">${note}</div>` : "";
}

// Bulleted like the book's own SKILLS block, "◊" sub-bullets for
// specializations, rather than a table.
function renderTemplateSkillList(template, metatype) {
  const items = template.skills
    .map((skill) => {
      const specItems = skill.specializations
        .map(
          (spec) => `
            <li class="template-spec">
              ◊ ${spec.label} ${templateSkillLine(spec, metatype)}
              ${templateNoteLine(spec.note)}
            </li>
          `,
        )
        .join("");
      return `
        <li>
          ${skill.label} ${templateSkillLine(skill, metatype)}
          ${templateNoteLine(skill.note)}
          ${specItems ? `<ul class="template-spec-list">${specItems}</ul>` : ""}
        </li>
      `;
    })
    .join("");
  return `<ul class="template-stat-list">${items}</ul>`;
}

// Shared by the fixed `weapons` list and an optional `chooseWeapons.options`
// list (same {name, dv, range, note} shape) — see renderTemplateBody().
function renderWeaponLine(w, metatype) {
  const dv = resolveVariant(w.dv, { metatype });
  let ampLine = "";
  if (w.dv.ampVariant) {
    const ampDv = resolveVariant(w.dv, { metatype, amp: w.dv.ampVariant.amp });
    ampLine = `<br><span class="template-amp-variant">[with ${w.dv.ampVariant.amp}: DV ${ampDv}]</span>`;
  }
  return `<li>${w.name} DV ${dv} [${w.range}]${ampLine}${templateNoteLine(w.note)}</li>`;
}

function renderTemplateWeaponList(weapons, metatype) {
  const items = weapons.map((w) => renderWeaponLine(w, metatype)).join("");
  return `<ul class="template-stat-list">${items}</ul>`;
}

// Thresholds get a "◊ with Amp ..." sub-bullet for the Amp variant (all
// three numbers move together) rather than cramming it into one line.
function renderTemplateWoundList(template, metatype) {
  const item = (label, field) => {
    if (!field) return "";
    const [light, serious, incap] = resolveVariant(field, { metatype });
    let sub = "";
    if (field.ampVariant) {
      const [aLight, aSerious, aIncap] = resolveVariant(field, {
        metatype,
        amp: field.ampVariant.amp,
      });
      sub = `<ul class="template-spec-list"><li class="template-spec">◊ with ${field.ampVariant.amp} ${aLight}/${aSerious}/${aIncap}</li></ul>`;
    }
    return `<li>${label} ${light}/${serious}/${incap}${sub}</li>`;
  };
  return `
    <ul class="template-stat-list">
      ${item("Physical", template.woundThresholds.physical)}
      ${item("Mental", template.woundThresholds.mental)}
    </ul>
  `;
}

function renderTemplateAmpOption(option) {
  return `<li><strong>${option.name}</strong>${option.kind ? ` (${option.kind})` : ""}: ${option.summary}</li>`;
}

// chooseAmps/chooseWeapons' `count` is usually a plain number, but a
// power-scaled Spirit (critters.js) sometimes prints a different count
// per power level ("CHOOSE 1/2/2 SHADOW AMPS") — there it's a
// VariantValue instead, resolved the same way as any other field.
function resolveChooseCount(count, metatype) {
  return typeof count === "number" ? count : resolveVariant(count, { metatype });
}

function renderTemplateBody(template, metatype) {
  const attrSummary = Object.entries(template.attributes)
    .map(
      ([id, field]) =>
        `${attributeAbbrev(id)} <strong>${resolveVariant(field, { metatype })}</strong>`,
    )
    .join(" · ");

  // Skills (usually the longest section) in its own column; everything
  // else stacked in a second column — same idea as the book's own
  // multi-column page layout, not a single long vertical list.
  const leftColumn = `
    <h4>Skills</h4>
    ${renderTemplateSkillList(template, metatype)}

    ${template.spells.length ? `<h4>Spells</h4><ul class="template-stat-list">${template.spells.map((s) => `<li>${s}</li>`).join("")}</ul>` : ""}
  `;

  const chooseWeaponsCount = resolveChooseCount(template.chooseWeapons.count, metatype);
  const chooseAmpsCount = resolveChooseCount(template.chooseAmps.count, metatype);

  const rightColumn = `
    <h4>Weapons</h4>
    ${renderTemplateWeaponList(template.weapons, metatype)}

    ${
      chooseWeaponsCount
        ? `<h4>Choose ${chooseWeaponsCount} Weapon${chooseWeaponsCount > 1 ? "s" : ""}</h4>${renderTemplateWeaponList(template.chooseWeapons.options, metatype)}`
        : ""
    }

    ${template.equipment.length ? `<h4>Equipment</h4><ul class="template-stat-list">${template.equipment.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}

    <h4>Wound Thresholds</h4>
    ${renderTemplateWoundList(template, metatype)}

    ${
      template.requiredAmps.length
        ? `<h4>Shadow Amps</h4><ul class="template-stat-list">${template.requiredAmps.map(renderTemplateAmpOption).join("")}</ul>`
        : ""
    }

    ${
      chooseAmpsCount
        ? `<h4>Choose ${chooseAmpsCount} Shadow Amp${chooseAmpsCount > 1 ? "s" : ""}</h4>${templateNoteLine(template.chooseAmps.note)}<ul class="template-stat-list">${template.chooseAmps.options.map(renderTemplateAmpOption).join("")}</ul>`
        : ""
    }
  `;

  return `
    <p class="template-attributes">${attrSummary}</p>

    <div class="template-columns">
      <div class="template-col">${leftColumn}</div>
      <div class="template-col">${rightColumn}</div>
    </div>
  `;
}

// A toggle button (not a link — clicking it expands the template in
// place, see the click handler below) plus an initially-empty/hidden
// panel right after it for the expanded content.
function renderTemplateListRow(template) {
  const attrSummary = Object.entries(template.attributes)
    .map(([id, field]) => `${attributeAbbrev(id)} ${resolveVariant(field)}`)
    .join(" · ");

  return `
    <div class="template-row-wrap">
      <button
        type="button"
        class="catalog-entry character-row template-toggle"
        data-template-id="${template.id}"
        aria-expanded="false"
      >
        <div class="catalog-entry-header">
          <span class="catalog-entry-name">${template.label}</span>
        </div>
        <div class="catalog-entry-meta">
          <span>${attrSummary}</span>
        </div>
      </button>
      <div class="template-expand" hidden></div>
    </div>
  `;
}

// The expanded panel's contents: source line, metatype picker, and the
// resolved stat block body (wired up by the click handler below).
function renderTemplateExpandedContent(template) {
  const metatypeOptions = Object.entries(METATYPES)
    .map(([id, mt]) => `<option value="${id}">${mt.label}</option>`)
    .join("");

  return `
    <div class="template-card">
      ${
        template.official
          ? `<div class="catalog-entry-meta"><span>Source: <span class="source-badge">${template.source.book}</span> ${template.source.page}</span></div>`
          : ""
      }

      <div class="tool-controls">
        <label for="template-metatype-select-${template.id}">Metatype:</label>
        <select id="template-metatype-select-${template.id}" class="template-metatype-select">${metatypeOptions}</select>
      </div>

      <div class="template-detail-body"></div>
    </div>
  `;
}

// --- Critters (Character Database) ---
// Same card/accordion treatment as Templates (and literally the same
// renderTemplateBody() — see template.js's doc comment on why Critters
// reuse that shape). The only UI difference: a fixed critter gets no
// picker at all (its body is rendered once), while a power-scaled Spirit
// gets a Minor/Regular/Major picker in place of the Templates' metatype
// picker — same resolveVariant() mechanism, just a different kind of key.
function renderCritterListRow(critter) {
  const attrSummary = Object.entries(critter.attributes)
    .map(([id, field]) => `${attributeAbbrev(id)} ${resolveVariant(field)}`)
    .join(" · ");

  return `
    <div class="template-row-wrap">
      <button
        type="button"
        class="catalog-entry character-row template-toggle"
        data-critter-id="${critter.id}"
        aria-expanded="false"
      >
        <div class="catalog-entry-header">
          <span class="catalog-entry-name">${critter.label}</span>
        </div>
        <div class="catalog-entry-meta">
          <span>${attrSummary}</span>
        </div>
      </button>
      <div class="template-expand" hidden></div>
    </div>
  `;
}

function renderCritterExpandedContent(critter) {
  const sourceLine = critter.official
    ? `<div class="catalog-entry-meta"><span>Source: <span class="source-badge">${critter.source.book}</span> ${critter.source.page}</span></div>`
    : "";

  if (!critter.powerLevels.length) {
    return `
      <div class="template-card">
        ${sourceLine}
        <div class="template-detail-body">${renderTemplateBody(critter, undefined)}</div>
      </div>
    `;
  }

  const levelOptions = ["minor", ...critter.powerLevels]
    .map(
      (level) =>
        `<option value="${level === "minor" ? "" : level}">${titleCase(level)}</option>`,
    )
    .join("");

  return `
    <div class="template-card">
      ${sourceLine}
      <div class="tool-controls">
        <label for="critter-power-select-${critter.id}">Power level:</label>
        <select id="critter-power-select-${critter.id}" class="critter-power-select">${levelOptions}</select>
      </div>
      <div class="template-detail-body"></div>
    </div>
  `;
}

const critterDatabaseList = document.getElementById("critter-database-list");
critterDatabaseList.innerHTML = CRITTERS.map(renderCritterListRow).join("");

critterDatabaseList.addEventListener("click", (event) => {
  const toggle = event.target.closest(".template-toggle");
  if (!toggle) return;

  const expand = toggleAccordion(critterDatabaseList, toggle);
  if (!expand) return;

  const critter = getCritter(toggle.dataset.critterId);
  expand.innerHTML = renderCritterExpandedContent(critter);

  const powerSelect = expand.querySelector(".critter-power-select");
  if (powerSelect) {
    const detailBody = expand.querySelector(".template-detail-body");
    const updateExpanded = () => {
      detailBody.innerHTML = renderTemplateBody(critter, powerSelect.value || undefined);
    };
    powerSelect.addEventListener("change", updateExpanded);
    updateExpanded();
  }
});

// Default view is a clickable list (like the Amp Catalog); a link's
// "?character=<id>" query param switches this to a single full
// character sheet instead. Currently sharing #content's usual 900px
// width with every other section — see the .character-database-detail
// note in style.css if that turns out too cramped for the two-column
// sheet.
const primeDatabaseList = document.getElementById("prime-database-list");
const requestedCharacterId = new URLSearchParams(location.search).get("character");
const requestedCharacter = requestedCharacterId ? getPregen(requestedCharacterId) : null;

if (requestedCharacter) {
  primeDatabaseList.innerHTML = `
    <a class="back-to-list" href="?#character-database">&larr; All Characters</a>
    ${renderCharacterCard(requestedCharacter)}
  `;
} else {
  primeDatabaseList.innerHTML = PREGENS.map(renderCharacterListRow).join("");
}

// Unlike the Prime Characters list above, Templates always show as a
// list — a click expands that row's stat block in place (accordion-
// style, one open at a time) instead of navigating to a detail page.
// The Critters tab has no data yet (see index.html) — it just shows its
// empty-list placeholder text, no JS needed until there's something to
// build/generate for it. Minor Characters is wired up further down,
// alongside the NPC Generator that feeds it.
// Shared accordion bookkeeping for the Templates and Minor Characters
// lists (both: a row of .template-toggle + sibling .template-expand):
// collapses whichever other row was open, toggles the clicked one, and
// returns the now-open panel to fill in, or null if the click just closed
// a row (nothing more for the caller to do).
function toggleAccordion(list, toggle) {
  const expand = toggle.nextElementSibling;
  const wasOpen = !expand.hidden;

  list.querySelectorAll(".template-expand").forEach((panel) => {
    if (panel === expand) return;
    panel.hidden = true;
    panel.innerHTML = "";
    panel.previousElementSibling.setAttribute("aria-expanded", "false");
  });

  if (wasOpen) {
    expand.hidden = true;
    expand.innerHTML = "";
    toggle.setAttribute("aria-expanded", "false");
    return null;
  }

  expand.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  return expand;
}

const templateDatabaseList = document.getElementById("template-database-list");
templateDatabaseList.innerHTML = TEMPLATES.map(renderTemplateListRow).join("");

templateDatabaseList.addEventListener("click", (event) => {
  const toggle = event.target.closest(".template-toggle");
  if (!toggle) return;

  const expand = toggleAccordion(templateDatabaseList, toggle);
  if (!expand) return;

  const template = getTemplate(toggle.dataset.templateId);
  expand.innerHTML = renderTemplateExpandedContent(template);

  const metatypeSelect = expand.querySelector(".template-metatype-select");
  const detailBody = expand.querySelector(".template-detail-body");
  const updateExpanded = () => {
    detailBody.innerHTML = renderTemplateBody(template, metatypeSelect.value);
  };
  metatypeSelect.value = TEMPLATE_DEFAULT_METATYPE;
  metatypeSelect.addEventListener("change", updateExpanded);
  updateExpanded();
});

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

primeDatabaseList.addEventListener("click", (event) => {
  const portrait = event.target.closest("img.character-portrait");
  if (portrait) openPortraitLightbox(portrait);
});

// PC/NPC isn't rendered from anywhere else on the card, so this just
// needs to persist — no re-render necessary.
primeDatabaseList.addEventListener("change", (event) => {
  const select = event.target.closest(".kind-select");
  if (select) setKindOverride(select.dataset.characterId, select.value);
});

portraitLightboxClose.addEventListener("click", closePortraitLightbox);
portraitLightbox.addEventListener("click", (event) => {
  if (event.target === portraitLightbox) closePortraitLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !portraitLightbox.hidden) closePortraitLightbox();
});

// --- Minor Characters (Character Database) ---
// Saved NPC Generator output: a thin { name, gender, metatype, templateId }
// pointer, not a baked stat block — resolved live through the same
// getTemplate()/renderTemplateBody() the Templates tab uses, so these stay
// accurate if a Template's numbers change later. Same accordion-list
// presentation as Templates, plus a Delete button since these (unlike
// Templates/pregens) are the user's own data.
const minorDatabaseList = document.getElementById("minor-database-list");

function renderMinorCharacterRow(npc) {
  const metatype = getMetatype(npc.metatype);
  const template = getTemplate(npc.templateId);
  return `
    <div class="template-row-wrap">
      <button
        type="button"
        class="catalog-entry character-row template-toggle"
        data-npc-id="${npc.id}"
        aria-expanded="false"
      >
        <div class="catalog-entry-header">
          <span class="catalog-entry-name">${npc.name}</span>
        </div>
        <div class="catalog-entry-meta">
          <span>${metatype?.label ?? npc.metatype}</span>
          <span>${npc.gender === "female" ? "Female" : "Male"}</span>
          <span>${template?.label ?? npc.templateId}</span>
        </div>
      </button>
      <div class="template-expand" hidden></div>
    </div>
  `;
}

function renderMinorCharacterExpandedContent(npc, template) {
  return `
    <div class="template-card">
      <div class="tool-controls">
        <button
          type="button"
          class="btn-secondary delete-minor-character-btn"
          data-npc-id="${npc.id}"
        >
          Delete
        </button>
      </div>
      <div class="template-detail-body">${renderTemplateBody(template, npc.metatype)}</div>
    </div>
  `;
}

function renderMinorList() {
  minorDatabaseList.innerHTML = loadMinorCharacters()
    .map(renderMinorCharacterRow)
    .join("");
}

renderMinorList();

minorDatabaseList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-minor-character-btn");
  if (deleteButton) {
    deleteMinorCharacter(deleteButton.dataset.npcId);
    renderMinorList();
    return;
  }

  const toggle = event.target.closest(".template-toggle");
  if (!toggle) return;

  const expand = toggleAccordion(minorDatabaseList, toggle);
  if (!expand) return;

  const npc = loadMinorCharacters().find((n) => n.id === toggle.dataset.npcId);
  const template = getTemplate(npc.templateId);
  expand.innerHTML = renderMinorCharacterExpandedContent(npc, template);
});

// --- NPC Generator ---
// Every field (Template, Metatype, Gender, Name) can be picked explicitly
// or left on "Random" — see index.html's own comment on the section.
// Name generation reuses names/streetname.js and names/conventionalName.js
// rather than reimplementing anything here.
const npcgenTemplateSelect = document.getElementById("npcgen-template");
const npcgenMetatypeSelect = document.getElementById("npcgen-metatype");
const npcgenGenderSelect = document.getElementById("npcgen-gender");
const npcgenNameTypeSelect = document.getElementById("npcgen-name-type");
const npcgenCultureWrap = document.getElementById("npcgen-culture-wrap");
const npcgenCultureSelect = document.getElementById("npcgen-culture");
const npcgenNameInput = document.getElementById("npcgen-name");
const npcgenRandomizeNameButton = document.getElementById(
  "npcgen-randomize-name",
);
const npcgenGenerateButton = document.getElementById("npcgen-generate");
const npcgenSaveButton = document.getElementById("npcgen-save");
const npcgenPreview = document.getElementById("npcgen-preview");

const randomOption = (label) => `<option value="">${label}</option>`;

npcgenTemplateSelect.innerHTML =
  randomOption("Random") +
  TEMPLATES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");

npcgenMetatypeSelect.innerHTML =
  randomOption("Random") +
  Object.entries(METATYPES)
    .map(([id, mt]) => `<option value="${id}">${mt.label}</option>`)
    .join("");

populateCultureSelect(npcgenCultureSelect, { includeRandom: true });

function updateNpcgenNameTypeVisibility() {
  npcgenCultureWrap.hidden = npcgenNameTypeSelect.value === "streetname";
}
npcgenNameTypeSelect.addEventListener("change", updateNpcgenNameTypeVisibility);
updateNpcgenNameTypeVisibility();

function pickRandom(list) {
  return list[randInt(0, list.length - 1)];
}

function pickRandomReadyCulture() {
  return pickRandom(Object.keys(CULTURES).filter(isCultureReady));
}

// Resolves a name and a gender together — and, since both Name Type and
// Culture can also be left on "Random", reports back whatever got picked
// for those too, so the caller can reflect it into the controls.
// generateConventionalName() hands back whichever gender it used even
// when one wasn't requested, so a "Random" Gender and a generated
// conventional name always agree — a streetname is gender-agnostic
// (streetname.js), so a random gender is just picked here for the
// record, to store/display alongside it.
function resolveNameAndGender() {
  const gender = npcgenGenderSelect.value || undefined;
  const nameType =
    npcgenNameTypeSelect.value || pickRandom(["streetname", "conventional"]);

  if (nameType === "conventional") {
    const culture = npcgenCultureSelect.value || pickRandomReadyCulture();
    const result = generateConventionalName({ culture, gender });
    return { name: result.fullName, gender: result.gender, nameType, culture };
  }
  return {
    name: generateStreetname(),
    gender: gender ?? (Math.random() < 0.5 ? "female" : "male"),
    nameType,
    culture: npcgenCultureSelect.value,
  };
}

// Only fills the Name field itself — Gender/Name Type/Culture may get
// resolved internally to produce a sensible name, but aren't written back
// to their own controls. Every field stays exactly as the user left it
// (on "Random" or otherwise) until they change it themselves.
npcgenRandomizeNameButton.addEventListener("click", () => {
  npcgenNameInput.value = resolveNameAndGender().name;
});

// The last generated-but-not-yet-saved NPC, enabling the Save button.
let currentNpc = null;

// Resets only the generator's result state, not the field controls —
// Template/Metatype/Gender/Name Type/Culture/Name stay exactly as the
// user left them (on "Random"/blank or otherwise) across Generates and
// Saves; only an explicit change to a control itself moves it off Random.
function resetNpcgenForm() {
  currentNpc = null;
  npcgenSaveButton.disabled = true;
  npcgenPreview.innerHTML = "";
}

npcgenGenerateButton.addEventListener("click", () => {
  const templateId = npcgenTemplateSelect.value || pickRandom(TEMPLATES).id;
  const metatype =
    npcgenMetatypeSelect.value || pickRandom(Object.keys(METATYPES));

  let name = npcgenNameInput.value.trim();
  let gender = npcgenGenderSelect.value;
  if (!name) {
    const resolved = resolveNameAndGender();
    name = resolved.name;
    gender = resolved.gender;
  } else if (!gender) {
    gender = Math.random() < 0.5 ? "female" : "male";
  }

  currentNpc = { name, gender, metatype, templateId };
  npcgenSaveButton.disabled = false;

  const template = getTemplate(templateId);
  const metatypeLabel = getMetatype(metatype)?.label ?? metatype;
  npcgenPreview.innerHTML = `
    <div class="catalog-entry template-card">
      <div class="catalog-entry-header">
        <span class="catalog-entry-name">${name}</span>
      </div>
      <div class="catalog-entry-meta">
        <span>${metatypeLabel}</span>
        <span>${gender === "female" ? "Female" : "Male"}</span>
        <span>${template.label}</span>
      </div>
      ${renderTemplateBody(template, metatype)}
    </div>
  `;
});

npcgenSaveButton.addEventListener("click", () => {
  if (!currentNpc) return;
  saveMinorCharacter(currentNpc);
  renderMinorList();
  resetNpcgenForm();
});

resetNpcgenForm();

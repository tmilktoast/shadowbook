"use strict";

/* Character creation steps in SR6e

1. Define your role and history
2. Select Character Priorities
3. Select Qualities
4. Spend Customization Karma
5. Buy Gear
6. Finishing Steps

*/

// Every element tagged with data-field="..." represents one property of
// the character object (the attribute's value is the dot-notation path
// to that property, e.g. data-field="attributes.body").
const fieldElements = document.querySelectorAll("[data-field]");
// console.log(fieldElements);

// const fieldName = document.getElementById("character-name");
// const fieldMetatype = document.getElementById("character-metatype");
// const fieldAge = document.getElementById("character-age");
// const fieldGender = document.getElementById("character-gender");

// The single source of truth for a character. Personal info sits at the
// top level; attributes/special are nested sub-objects, which is why
// getValueByPath() below needs to walk dot-separated paths rather than
// just doing a single-level property lookup.
const character = {
  name: "",
  metatype: "",
  ethnicity: "",
  age: "",
  gender: "",
  height: "",
  weight: "",
  reputation: "",
  heat: "",
  karma: [],
  attributes: {
    body: 0,
    agility: 0,
    reaction: 0,
    strength: 0,
    willpower: 0,
    logic: 0,
    intuition: 0,
    charisma: 0,
  },
  special: {
    edge: 0,
    magic: 0,
    resonance: 0,
    essence: 6,
  },
  priorities: {
    // used for character creation only
    metatype: null, // "A" through "E"
    attributes: null,
    skills: null,
    magic: null,
    resources: null,
  },
};

const priorityTable = [
  {
    priority: "A",
    metatype: { options: ["dwarf", "ork", "troll"], points: 13 },
    attributePoints: 24,
    skillPoints: 32,
    magic:
      "Full: 4 Magic, Aspected: 5 Magic, Mystic Adept: 4 Magic, Adept: 4 Magic, Technomancer: 4 Resonance",
    nuyen: 450000,
  },
  {
    priority: "B",
    metatype: { options: ["dwarf", "elf", "ork", "troll"], points: 11 },
    attributePoints: 16,
    skillPoints: 24,
    magic:
      "Full: 3 Magic, Aspected: 4 Magic, Mystic Adept: 3 Magic, Adept: 3 Magic, Technomancer: 3 Resonance",
    nuyen: 275000,
  },
  {
    priority: "C",
    metatype: {
      options: ["dwarf", "elf", "human", "ork", "troll"],
      points: 9,
    },
    attributePoints: 12,
    skillPoints: 20,
    magic:
      "Full: 2 Magic, Aspected: 3 Magic, Mystic Adept: 2 Magic, Adept: 2 Magic, Technomancer: 2 Resonance",
    nuyen: 150000,
  },
  {
    priority: "D",
    metatype: {
      options: ["dwarf", "elf", "human", "ork", "troll"],
      points: 4,
    },
    attributePoints: 8,
    skillPoints: 16,
    magic:
      "Full: 1 Magic, Aspected: 2 Magic, Mystic Adept: 1 Magic, Adept: 1 Magic, Technomancer: 1 Resonance",
    nuyen: 50000,
  },
  {
    priority: "E",
    metatype: {
      options: ["dwarf", "elf", "human", "ork", "troll"],
      points: 1,
    },
    attributePoints: 2,
    skillPoints: 10,
    magic: "Mundane",
    nuyen: 8000,
  },
];

// Create a container for the body of the Priority Table in the html file
const priorityTableBody = document.querySelector("#priority-table tbody");

// This builds a cell in the Priority Table html table
// It is called from the priorityTable.forEach method below it
function buildPriorityCell(groupName, priorityLetter, labelText) {
  const td = document.createElement("td");
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.setAttribute("type", "radio");
  input.setAttribute("name", groupName);
  input.value = priorityLetter;
  label.appendChild(input);
  label.append(" " + labelText);
  td.appendChild(label);
  return td;
}

const numFormatter = new Intl.NumberFormat("en-US");

// Populate the HTML Priority table with rows from the
// priorityTable above
priorityTable.forEach((row) => {
  const th = document.createElement("th");
  const tr = document.createElement("tr");
  th.setAttribute("scope", "row");
  th.textContent = row.priority;
  tr.appendChild(th);
  tr.appendChild(
    buildPriorityCell(
      "priority-metatype",
      row.priority,
      `${row.metatype.options.join(", ")} (${row.metatype.points})`,
    ),
  );
  tr.appendChild(
    buildPriorityCell("priority-attributes", row.priority, row.attributePoints),
  );
  tr.appendChild(
    buildPriorityCell("priority-skills", row.priority, row.skillPoints),
  );
  tr.appendChild(buildPriorityCell("priority-magic", row.priority, row.magic));
  tr.appendChild(
    buildPriorityCell(
      "priority-resources",
      row.priority,
      `${numFormatter.format(row.nuyen)}¥`,
    ),
  );

  priorityTableBody.appendChild(tr);
});

priorityTableBody.addEventListener("change", (event) => {
  // event.target
});

// This is the Adept archetype from the book
// This is TEST data
character.name = "Adept";
character.metatype = "elf";
character.ethnicity = "";
character.age = 35;
character.gender = "female";
character.height = "6'2\"";
character.weight = 143;
character.reputation = 5;
character.heat = 3;
character.karma = [1, 5];

character.attributes.body = 5;
character.attributes.agility = 2;
character.attributes.reaction = 3;
character.attributes.strength = 5;
character.attributes.willpower = 3;
character.attributes.logic = 3;
character.attributes.intuition = 1;
character.attributes.charisma = 5;
character.special.edge = 3;

// const iterateObject2 = function (obj) {
//   Object.keys(obj).forEach((key) => {
//     const value = obj[key];
//     // console.log(key);
//     if (typeof value === "object" && value != null) {
//       iterateObject2(value);
//     } else {
//       // console.log(`${key}: ${value}`);
//     }
//   });
// };
// iterateObject2(character);

// Looks up a nested property from a dot-notation string, e.g.
// getValueByPath(character, "attributes.body") === character.attributes.body
// Splits the path into keys ["attributes", "body"], then reduce() walks
// one level deeper into the object per key, using bracket notation
// (current[key]) since the property name is only known at runtime.
function getValueByPath(obj, path) {
  return path.split(".").reduce((current, key) => current[key], obj);
}

// Render pass: for every field element on the page, read its data-field
// path, look up the matching value in `character`, and display it.
// This is a one-way sync (object -> DOM) — typing in a field does NOT
// yet update `character` (that's the DOM -> object direction, TODO).
fieldElements.forEach((el) => {
  const path = el.dataset.field;
  const value = getValueByPath(character, path);
  el.value = value;
});

"use strict";

/* Character creation steps in SR6e

1. Define your role and history
2. Select Character Priorities
3. Select Qualities
4. Spend Customization Karma
5. Buy Gear
6. Finishing Steps

*/

//
const fieldName = document.getElementById("character-name");
const fieldMetatype = document.getElementById("character-metatype");
const fieldAge = document.getElementById("character-age");
const fieldGender = document.getElementById("character-gender");

// The beginning character object
const character = {
  name: "",
  metatype: "",
  ethnicity: "",
  age: "",
  gender: "",
  //   height: "",
  //   weight: "",
  //   reputation: "",
  //   heat: "",
  //   karma: [],
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
};

// This is the Adept archetype from the book
character.name = "Adept";
character.metatype = "Elf";
character.ethnicity = "";
character.age = null;
character.gender = "female";
character.attributes.body = 5;

// console.log(character);

fieldName.textContent = character.name;
fieldMetatype.textContent = character.metatype;
fieldAge.textContent = character.age;
fieldGender.textContent = character.gender;

const iterateObject = function (obj) {
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let value = obj[key];
      console.log(key, value);
    }
  }
};

// iterateObject(character);

const iterateObject2 = function (obj) {
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === "object" && value != null) {
      iterateObject2(value);
    } else {
      console.log(`${key}: ${value}`);
    }
  });
};
iterateObject2(character);

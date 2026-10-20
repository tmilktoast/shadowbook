// NPC Templates from the core rulebook's "Hell Is Other People" chapter
// (p. 243+) — same loading convention as pregens.js: mostly plain JSON
// per ./data/templates/, merged onto createTemplate() and tagged
// official via markOfficial().

import { createTemplate } from "./template.js";
import { markOfficial } from "../officialContent.js";
import ganger from "./data/templates/ganger.json";
import eliteGanger from "./data/templates/elite-ganger.json";
import awakenedGanger from "./data/templates/awakened-ganger.json";
import adeptGanger from "./data/templates/adept-ganger.json";
import deckerGanger from "./data/templates/decker-ganger.json";
import goGanger from "./data/templates/go-ganger.json";
import securityGuard from "./data/templates/security-guard.json";
import securityOfficer from "./data/templates/security-officer.json";
import securityMage from "./data/templates/security-mage.json";
import securityAdept from "./data/templates/security-adept.json";
import securityDecker from "./data/templates/security-decker.json";
import securityRigger from "./data/templates/security-rigger.json";
import combatMedic from "./data/templates/combat-medic.json";
import eliteSecurityOfficer from "./data/templates/elite-security-officer.json";
import eliteSecurityMage from "./data/templates/elite-security-mage.json";
import eliteSecurityAdept from "./data/templates/elite-security-adept.json";
import eliteSecurityDecker from "./data/templates/elite-security-decker.json";
import soldier from "./data/templates/soldier.json";
import eliteSecurityRigger from "./data/templates/elite-security-rigger.json";
import commandoSoldier from "./data/templates/commando-soldier.json";
import mrJohnson from "./data/templates/mr-johnson.json";
import investigator from "./data/templates/investigator.json";
import corporateEmployee from "./data/templates/corporate-employee.json";
import corporateExecutive from "./data/templates/corporate-executive.json";
import coyoteSmuggler from "./data/templates/coyote-smuggler.json";

function buildTemplate(data) {
  return markOfficial({ ...createTemplate(), ...data });
}

export const TEMPLATES = [
  ganger,
  eliteGanger,
  awakenedGanger,
  adeptGanger,
  deckerGanger,
  goGanger,
  securityGuard,
  securityOfficer,
  securityMage,
  securityAdept,
  securityDecker,
  securityRigger,
  combatMedic,
  eliteSecurityOfficer,
  eliteSecurityMage,
  eliteSecurityAdept,
  eliteSecurityDecker,
  soldier,
  eliteSecurityRigger,
  commandoSoldier,
  mrJohnson,
  investigator,
  corporateEmployee,
  corporateExecutive,
  coyoteSmuggler,
].map(buildTemplate);

export function getTemplate(id) {
  return TEMPLATES.find((template) => template.id === id);
}

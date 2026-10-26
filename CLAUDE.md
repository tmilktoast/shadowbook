# Shadowbook

A companion toolset for **Shadowrun: Anarchy 2.0** — dice roller, name
generator, Character Database (pregens/NPCs/Templates/Critters), NPC
generator, Shadow Amp catalog/creator, and (planned) character builder,
job generator, Foundry VTT/Obsidian/PDF export (see "Planned features"
below). Built as a personal project; the user is still reading the
Anarchy 2.0 rulebook, so treat anything rules-related as provisional and
ground new mechanics in the actual reference PDFs rather than assumption
or general Shadowrun knowledge (Anarchy simplifies a lot from mainline
Shadowrun editions).

The project originally started as an SR6e character sheet (to learn JS and
SR6e simultaneously) and pivoted to Anarchy 2.0. That SR6e work is fully
preserved in git history at commit `e1cb89d` if ever worth referencing, but
none of it exists in the current working tree — don't assume any SR6e
concepts (priority tables, 8 core attributes, Essence-as-attribute) carry
over; Anarchy 2.0 is a different, lighter ruleset.

## Running it

This is a Vite project (`npm install`, then `npm run dev`, open
`http://localhost:5173/`). **Do not open `index.html` directly as a
`file://` URL** — the JS uses ES module `import`/`export`, which browsers
block under CORS when loaded from the filesystem instead of a server.

No test suite, no linter configured yet.

## Deployment (TrueNAS)

The goal is to run this as a TrueNAS SCALE app. `Dockerfile` is a
multi-stage build (node → `vite build` → `nginxinc/nginx-unprivileged`
serving `dist/` on port 8080, config in `nginx.conf`, plus a
`HEALTHCHECK` so TrueNAS/`docker ps` show real container health).
`.github/workflows/docker.yml` pushes the image to
`ghcr.io/<owner>/<repo>` (confirmed public, pullable with no registry
login) on pushes to main. Two install paths, same image either way:
`deploy/truenas-custom-app.md` walks the Custom App wizard field by
field (current as of TrueNAS SCALE 25.10 — labels shift release to
release, values don't); `deploy/truenas-compose.yaml` is the "Install
via YAML" snippet for older versions/a quicker path. No persistent
storage or env vars needed yet — it's a static site. A server-side
database is planned (for the Character Database, so data is shared
across devices instead of per-browser localStorage) — that will mean
adding a backend service alongside the static nginx container, with
its data on a TrueNAS dataset, and will need both deploy docs revisited
once it exists (storage/volumes wiring they currently skip).

## Structure

```
index.html              App shell: #sidebar (nav) + #content (tab panels)
css/style.css           Single stylesheet, CSS custom properties for theme
js/main.js              Entry point: tab switching + wires up each tool
js/character/
  character.js           Character data model (createCharacter() factory)
  metatypes.js           METATYPES/QUALITIES, getMetatype(), getRacialQualities()
  data/metatypes.json    The 5 metatypes, keyed by id; racialQualities are ids
  data/qualities.json    Quality definitions, referenced by id (labels only so far)
  lifestyles.js          LIFESTYLES, getLifestyle()
  data/lifestyles.json   The 4 lifestyles with nuyen-per-run modifiers
  attributes.js          ATTRIBUTES, costs, getStartingEdge(), validateAttributes()
  levelsOfPlay.js        LEVELS_OF_PLAY (Ganger/Runner/Prime), creation caps
  essence.js             STARTING_ESSENCE, getEssenceEffects()
  skills.js              SKILLS, costs, dicePool(), validateSkills()
  amps.js                AMP_TYPES/AMP_EFFECTS/VEHICLE_TYPES, ratings, costs,
                         vehicle/deck stats, Risk Reduction, validateAmps()
  catalog.js             CATALOG of the book's ready-made Amps, createAmpFromCatalog()
  data/catalog/*.json    Catalog entries, one file per section
  data/*.json            attributes, levelsOfPlay, essence, skills, ampTypes,
                         ampEffects, vehicleTypes data
js/dice/
  roll.js               Generic dice engine: randInt(), rollBasic()
  diceSvg.js            Inline SVG dice faces (no image assets)
  history.js             Roll history, persisted to localStorage
  sra.js                 STUB — Anarchy 2.0 pool/hit-counting rules, TBD
js/names/
  streetname.js          Shadowrunner handle generator
  conventionalName.js    "Normie" name generator, culture-based
  data/streetnames.json
  data/cultures/*.json   One file per culture (see "Name data" below)
js/data.js               Empty placeholder, not yet used
reference/                Rulebook + reference PDFs (gitignored) — see "Reference material" below
```

## Architecture patterns established so far

- **Tab switching**: sidebar `<a href="#some-id">` links toggle the
  `hidden` attribute on matching `<section id="some-id">` elements inside
  `#content`. `main.js`'s `showTool()` handles this generically — adding a
  new tool just means adding a nav `<li><a href="#x">` and a
  `<section id="x">`, no JS changes needed for the switching itself.
- **JSON data, loaded via native ES module import** (`import data from
  "./foo.json"` — Vite supports this natively, no fetch/async needed for
  static data). Keep game/name data in JSON, logic in `.js` files.
- **Reusable primitives over duplication**: `randInt()` in `dice/roll.js`
  is reused by both dice rolling and name generation. `.btn-primary`,
  `.btn-secondary`, `.tool-controls`, `.history-list`/`.history-item` CSS
  classes are shared across Die Roller and Name Generator rather than each
  tool growing its own near-duplicate styles. Follow this pattern for new
  tools — check for an existing reusable piece before adding a new one.
- **Inline SVG instead of image assets** for both dice faces
  (`diceSvg.js`) and the paper-grain background texture (an `feTurbulence`
  noise filter, base64-encoded, stored as the `--texture-paper` CSS
  variable) — no binary assets to manage, fully stylable via CSS.
- **Single source of truth, actively enforced**: e.g. the Name Generator's
  culture `<select>` is populated from `CULTURES`' own `label` field in JS
  rather than hardcoded a second time in the HTML. When adding a dropdown
  or list driven by data that already exists elsewhere, generate it,
  don't retype it.

## Design decisions (with reasoning — don't silently change these)

- **Accessibility-driven color theme**: the user has light sensitivity
  (no pure black backgrounds, no stark black/white high-contrast pairing)
  and some color blindness (avoid relying on red/green alone to convey
  meaning). The current palette (`css/style.css` `:root`) is muted/warm
  and uses teal/amber as the accent pair instead. The official Anarchy 2.0
  books use a much bolder gold/near-black/maroon look (see reference
  PDFs) — we deliberately only pulled that in as *accents* (sidebar
  background, headings) rather than full-contrast backgrounds, to respect
  the above. Don't swing back toward the book's full contrast without
  checking first.
- **Fonts**: Anton (`--font-display`, big titles) + Oswald
  (`--font-heading`, section headings/nav), loaded from Google Fonts,
  approximating the Anarchy 2.0 bold-condensed-poster look (true
  distressed/grunge fonts are paid licenses, not used). Headings are
  styled uppercase via CSS `text-transform`, not typed in caps in the
  HTML.
- **Character attributes** (core book p. 52): five *rated* Attributes —
  Strength, Agility, Willpower, Logic, Charisma — range 1 to a
  metatype-specific max (`attributeMax` in `metatypes.json`). Bought with
  nuyen: 10,000¥/point, 20,000¥ for the point that reaches the max.
  **Edge is not a rated attribute** even though the sheet lists it
  alongside them: it's a per-adventure pool (start 4 for humans, 3 for
  other metatypes — `startingEdge`), gained/spent in play, not bought.
  **Essence is also separate**: starts at 6, only drops (implants), with
  cumulative penalties (`essence.json`). Don't fold either back into
  `attributes`, and don't mistype Essence for Edge (happened once).
- **Skills** (core book pp. 53-57): 14 skills in `skills.json`, built
  from the book's summary table (p. 54) — each with category, linked
  Attribute(s), optional `requires` (awakened/cyberdeck), and
  specializations each tagged with the Attribute(s) they use. Ratings
  0-8 (capped lower by level of play at creation); 2,500¥/point to 5,
  then 5,000¥/point; specializations +2 dice, 2,500¥ each, need rating
  1+, and custom ones are allowed (stored as free text). Characters
  store skills sparsely: `{ skillId: { rating, specializations: [] } }`.
  Knowledge Skills are unrated strings, 2,500¥ each.
- **Shadow Amps** (core book pp. 58-63) are a build system, not a
  fixed list: Amp type (base rating, `ampTypes.json`) + effects (each
  adds its cost, `ampEffects.json`) = rating; 5,000¥ per rating point.
  The character's first non-racial Quality has base 0, later ones 3.
  Racial qualities are free Quality Amps derived from the metatype, not
  stored in `character.amps`. Each entry in an Amp's `effects` is one
  purchase (repeat to buy again); Risk Reduction effects carry a
  `target` (skill id, attribute id, or `"skillId/specId"`). Verified
  against the book's worked example, Lightning (p. 85): Amp ratings
  5/6/4/2. **Essence is derived** (`getEssence()` = 6 minus implant
  Amps' Essence cost), not stored — don't add an `essence` field back.
  `validateAmps()` also enforces Awakened/cyberdeck prerequisites for
  Skills and adept powers, and RR caps from the level of play.
  `character.js` has `getBuildCost()`/`validateCharacter()` tying
  attributes + skills + Amps to the level-of-play budget.
- **Amp catalog** (`js/character/catalog.js`, `data/catalog/*.json`):
  172 ready-made Amps from the core book (cyberware, bioware, adept
  powers, mentor spirits, contacts, foci, weapons, armor, gear, drugs,
  cyberdecks, RCCs, vehicles/drones), each with the book's `rating`,
  `nuyen`, and `page`, plus structured `effects` that **rebuild that
  rating exactly** — keep that invariant when adding entries (every
  entry was checked: effects sum to rating, rating × 5,000 + `itemCost`
  = price). Where the book doesn't itemize (drugs, a few vehicles), the
  breakdown is reconstructed to match and the entry has a `ratingNote`.
  `createAmpFromCatalog(entry, choices)` builds a character Amp, filling
  player choices (`target: null` effects, mentor spirits' `choose`).
  Equipment Amps carry the base item's price as `itemCost`.
- **Levels of play** (Ganger/Runner/Prime Runner, `levelsOfPlay.json`)
  set the creation budget and caps (attributes at max, skill max, Risk
  Reduction max). Runner is the default. Characters carry `levelOfPlay`
  for now; it may belong to a campaign once campaigns exist.
- **Metatypes** (Human, Elf, Dwarf, Ork, Troll) come straight from the
  Anarchy 2.0 rulebook text the user pasted: scientific name, average
  height/weight, and one racial quality each (none for humans; low-light
  vision for elves/orks; thermographic vision for dwarfs/trolls). No
  attribute modifiers or limits were listed — don't add any without a
  book source. Qualities are defined once in `qualities.json` and
  referenced by id, since metatypes share them. Quality descriptions
  aren't filled in yet (book text not pasted) — don't invent them.
- **`createCharacter()` is a factory function**, not a single shared
  object — the Character Database will hold many characters, so each one
  needs to be independent. Don't regress to a single global `character`
  object like the old SR6e version had.
- **Keywords** are five recommended slots (core book p. 51): metatype/
  social status, origin (scoped to the campaign: a district when the
  campaign is in one city), role/occupation, lifestyle, and an open one
  (often a secondary/former job). The book allows swapping one out as an
  exception. Official pregen sheets print lifestyle *last*, so
  `getKeywords()` does too. Keyword 1 is free text, not derived from
  `metatype` (official examples include "Teenager", "Boston
  bourgeoisie"). Lifestyle is stored as an id into `lifestyles.json` —
  Squatter, Low (the default, no rules), Middle, High, each with a
  nuyen-per-run modifier and a paraphrased effect.
- **Dispositions/Cues** (core book p. 51): four of each
  (`DISPOSITION_COUNT`/`CUE_COUNT`), freeform text. Dispositions are
  personality traits ("Idealist"), Cues are typical sayings; both are
  how Edge is earned/spent. Not paired one-to-one — keep them as two
  flat string lists, no need to over-structure.
- **Portraits** (`portrait` field on both `character.js`'s
  `createCharacter()` and `template.js`'s `createTemplate()`, the latter
  shared by Templates and Critters): a path under `public/portraits/`
  (`public/portraits/critters/` for critters), or `null` for the
  placeholder icon. Unlike the rest of `reference/` (gitignored,
  copyrighted, local-only), extracted portrait art is committed directly
  into the repo now — the user's standing policy is "cut anything marked
  `official` out later if this repo ever goes public," not "never commit
  it." Cropped from each character's own full-body book illustration (a
  bust crop: head/shoulders/a bit of torso, plain background, no
  border/circle mask) or, for critters, a tight crop around the creature
  — see `public/portraits/hercules.jpg` as the reference style. Only
  extract art the book actually has: several critters (Devil Rat,
  Vampire, Guard Dog, Young Dragon, Watcher, all 7 Spirits) and every
  Template are text/stats-only pages with no illustration at all — leave
  `portrait: null` for those rather than substituting something else.

## Name data — handle with care

- **Streetnames vs. pregen names**: don't copy pregen characters' names
  wholesale into `streetnames.json` as "generic" examples (that happened
  once with the fan-doc pregens and was scrubbed). But there is **no
  word-level blacklist** — the user decided individual words that happen
  to appear in a pregen name are fine ("Wild Bill", "Dark Trash"-style
  combos are welcome), and a coincidental adjective+noun recombination
  into a pregen name isn't worth guarding against. Applies to both the
  official core-book pregens and the fan-doc ones.
- **`js/names/data/cultures/*.json`**: one file per culture/nation, each
  with `label`, `firstNames: { male: [], female: [] }`, `lastNames: []`.
  Ready cultures: american, hispanic, french, japanese, chinese, korean,
  pueblo. **Stub cultures** (empty `firstNames`/`lastNames`, a `_note`
  field explaining why): `salish-shidhe`, `sioux`, `ute`. These map to
  Shadowrun's actual canon Native American nations (confirmed via the
  *Native American Nations Vol. 1* sourcebook — Salish-Shidhe, Sioux, Ute,
  Pueblo, formed via the in-fiction Treaty of Denver). They're stubs
  because general web research either turned up nothing reliable (Sioux,
  Ute) or turned up names that are ceremonially bestowed and inherited
  within real living families (Salish-Shidhe/Lushootseed) — not a generic
  pool appropriate for a random generator. **Don't fill these in with
  invented or low-quality "Native American baby name site" content** —
  either find a real citable source (the *Native American Nations*
  sourcebook, if it turns up, is the best bet) or leave them stubbed.
  Pueblo's existing names *are* real and sourced (Henry Voth's 1905 Hopi
  monograph, cited in that file's `_note`) — follow that bar for quality
  if expanding it further.
- **`isCultureReady(culture)`** in `conventionalName.js` gates whether a
  culture appears selectable in the UI (stubs show as disabled
  "(coming soon)" options) — a new culture file is automatically picked
  up once it has real data, no other wiring needed beyond importing it
  into `CULTURES`.
- **"american" is a weighted blend**, not its own fixed list — given name
  and surname are picked independently from a mix of `american` (base
  pool)/`hispanic`/`french` (see `AMERICAN_BLEND` in
  `conventionalName.js`), since real American names come from everywhere.
  This was a deliberate redesign away from a single narrow "Generic
  American" list — don't revert to treating "american" as one flat list.

## Reference material (`reference/`)

Local only — `reference/` is gitignored because the repo is public and
these are copyrighted. For the same reason, paraphrase rules into data
files and comments rather than pasting book text verbatim.

- `sranarchy-20.pdf` — **the Anarchy 2.0 core rulebook, the authority on
  rules.** Text-extractable with `pdftotext` (use it without `-layout`;
  the two-column layout scrambles otherwise). Key spots (book page
  numbers): Keywords/Dispositions/Cues p. 51, Lifestyle p. 164 ("A Place
  to Rest"), official pregens from p. 88 — **the best source for real
  example data** (attribute spreads, Keywords format, Shadow Amps, gear).
- `1203_..._charsheet_editable_web_v1.pdf` — official blank character
  sheet (field layout, the Risk Rating dice-pool table).
- `1205_..._conversion_sr6_to_sra_web_v1.pdf` — official SR6→Anarchy 2.0
  attribute/skill conversion rules.
- `1659004-SRA2_EN_Pregen_v1_0f.pdf` ("Deniable Assets") — **a fan-made
  document, not official.** 15 pregens; useful as extra examples but
  defer to the core book where they differ (e.g. it formats origins as
  "Tacoma, Seattle Metroplex" where the book uses "Seattle / Downtown").
  Source of the pregen names barred from the streetname generator.

## Feature status

| Feature | Status |
|---|---|
| Die Roller | Working — Generic NdX mode, plus a "Shadowrun Anarchy" pool mode (default): Attribute+Skill dice, Risk Dice, RR, and an Advantage/Disadvantage stance slider (core book p. 65 — shifts which d6 faces count as hits: Disadvantage 6 only, Normal 5-6, Advantage 4-6) |
| Name Generator | Working — streetnames (two selectable generation methods, `js/names/streetname.js`: "Real Words" — Adjective+Noun or just a Noun, optional leetspeak; "Phonemes" — invented syllable combinations; or leave it Random) + conventional names, 7 cultures (3 are stubs) |
| Character Database | Working — four subtabs: Prime Characters (full Character sheets: 12 official pregens, all with portraits, + room for user-built PCs/major NPCs, PC/NPC tag), Minor Characters (NPC Generator output), Templates (all 25 non-critter NPC stat blocks from "Hell Is Other People," Ganger through Coyote/Smuggler, transcribed), Critters (all 18 critters from the same chapter, Barghest through Spirit of Water, transcribed — reuses Templates' exact data shape, see `js/character/critters.js`; the 6 that have book art — Barghest, Hell Hound, Shiawase Cyber-Tiger, Basilisk, Cockatrice, Ghoul — have portraits too, see "Portraits" under Design decisions) |
| NPC Generator | Working — picks Template/Metatype/Gender/Name (each explicit or random), saves a `{ name, gender, metatype, templateId }` pointer into Minor Characters via `js/character/minorCharacters.js` |
| Character Builder | Nav link only, no content yet — `js/character/character.js` has the full data model (createCharacter()), just no UI to build one interactively |
| Job Generator | Nav link only, no content yet |
| Amp Catalog | Working — browse/filter/sort the 172 book Amps (`catalog.js`) by section, rating, cost |
| Amp Creator | Working — build a custom Shadow Amp (pick type, add effects from `AMP_EFFECTS`, live rating/cost and `validateAmp()` feedback), edit/delete saved ones |
| `js/dice/sra.js` | Empty stub for Anarchy 2.0 pool/hit-counting rules, once read |

## Planned features (not started)

Noted 2026-10-20, before a pause in active work (user is focused on
finishing the rulebook + other projects for a while) — these are
intended next steps, not yet designed or scoped in detail:

- **Export to Foundry VTT**: Prime Characters, NPCs (Minor Characters),
  Critters, Shadow Amps, and potentially normal equipment. Foundry has
  no official Shadowrun Anarchy 2.0 system module as far as this project
  knows — figure out the target format (a generic/custom Foundry system,
  or piggybacking on an existing compatible system's actor/item schema)
  before implementing. Likely a JSON export matching whatever Foundry's
  import expects, built from the existing `createCharacter()`/
  `createTemplate()` data shapes rather than a new parallel model.
- **Export to Obsidian markdown**: same set of entities, formatted
  against markdown templates the user has already built in their own
  Obsidian vault (not yet shared with/seen by Claude — ask for them, or
  for the user's vault conventions, before building this, rather than
  inventing a template structure from scratch).
- **PDF export for character sheets**: lower priority ("maybe"), likely
  Prime Characters only given the phrasing. No format/library decided.

## Working style notes

- Default collaboration mode has flexed between "user writes the code,
  Claude reviews/explains" and "Claude writes it directly" depending on
  what's asked each session/feature — don't assume either is the fixed
  rule; ask or follow however the current request is phrased.
- Commit after every change, not just at the end of a feature (user
  preference, 2026-10 — tightened from an earlier "after each feature"
  version of this same rule). Pushing is separate — it triggers the
  image build. When pivoting away from a large chunk of working code
  (like the SR6e→Anarchy 2.0 switch), checkpoint it in a commit first
  rather than just deleting, even if it's about to be replaced — see
  `e1cb89d` for the pattern.
- The user is doing their own rules reading in parallel — when a
  rules-dependent decision comes up (skills shape, Shadow Amps, wounds,
  gear), it's fine to propose a reasonable starting structure, but expect
  it to need revision once they've read more, and prefer pulling concrete
  examples from `reference/` over guessing.

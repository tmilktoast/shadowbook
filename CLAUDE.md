# Shadowbook

A companion toolset for **Shadowrun: Anarchy 2.0** — dice roller, name
generator, and (planned) NPC/character database, NPC generator, character
builder, and job generator. Built as a personal project; the user is still
reading the Anarchy 2.0 rulebook, so treat anything rules-related as
provisional and ground new mechanics in the actual reference PDFs rather
than assumption or general Shadowrun knowledge (Anarchy simplifies a lot
from mainline Shadowrun editions).

The project originally started as an SR6e character sheet (to learn JS and
SR6e simultaneously) and pivoted to Anarchy 2.0. That SR6e work is fully
preserved in git history at commit `9e4a0fd` if ever worth referencing, but
none of it exists in the current working tree — don't assume any SR6e
concepts (priority tables, 8 core attributes, Essence-as-attribute) carry
over; Anarchy 2.0 is a different, lighter ruleset.

## Running it

This is a Vite project (`npm install`, then `npm run dev`, open
`http://localhost:5173/`). **Do not open `index.html` directly as a
`file://` URL** — the JS uses ES module `import`/`export`, which browsers
block under CORS when loaded from the filesystem instead of a server.

No test suite, no linter configured yet.

## Structure

```
index.html              App shell: #sidebar (nav) + #content (tab panels)
css/style.css           Single stylesheet, CSS custom properties for theme
js/main.js              Entry point: tab switching + wires up each tool
js/character.js         Character data model (createCharacter() factory)
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
reference/                Official PDFs — see "Reference material" below
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
- **Character attributes**: Strength, Agility, Willpower, Logic, Charisma,
  **Edge** are the six core attributes (confirmed from the actual Anarchy
  2.0 character sheet PDF). **Essence is separate**, not a seventh
  attribute — it cancels magic/healing hits rather than being spent.
  Someone will eventually mis-type this as Essence-instead-of-Edge again;
  it already happened once.
- **`createCharacter()` is a factory function**, not a single shared
  object — the Character Database will hold many characters, so each one
  needs to be independent. Don't regress to a single global `character`
  object like the old SR6e version had.
- **Keywords/Dispositions/Cues** on the character sheet are just flat
  lists of short text (see the pregen examples) — no need to over-
  structure them. Keywords loosely pattern as origin/location/archetype/
  specialty/lifestyle in the one example checked (Noonchi), but that's
  one data point, not a confirmed rule.

## Name data — handle with care

- **`js/names/data/streetnames.json` must never contain the name of an
  actual Anarchy 2.0 pregen character** (Noonchi, Ty, Spectrum, Barry
  Bullet, Kuz, Klee, Shayanne, Lipsync, Aponi, Ricky Lean, Pixel Glitch,
  H4yn, Keran, Peace B, Neon Ivy — from `reference/..._Pregen_v1_0f.pdf`).
  This happened once already (several pregen names were used as
  "generic" streetname examples and had to be scrubbed) — check new
  additions against that list, including partial overlaps that could
  recombine into a pregen name via the adjective+noun pattern (e.g. an
  adjective "Neon" plus a noun "Ivy" would regenerate "Neon Ivy" even
  though neither word alone is a character name).
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

Three official PDFs, useful for grounding anything rules- or
content-related in real examples instead of guessing:

- `1203_..._charsheet_editable_web_v1.pdf` — blank Anarchy 2.0 character
  sheet (field layout, the Risk Rating dice-pool table).
- `1205_..._conversion_sr6_to_sra_web_v1.pdf` — SR6→Anarchy 2.0 attribute/
  skill conversion rules; also where the four Native American Nations
  were confirmed via web search cross-reference.
- `1659004-SRA2_EN_Pregen_v1_0f.pdf` ("Deniable Assets") — 15 pregen
  characters with filled-out sheets. **This is the best source for real
  example data** (attribute spreads, Keywords/Dispositions/Cues format,
  Shadow Amps, gear, nuyen formatting) — check it before inventing a data
  shape from scratch. Also the source of the pregen names that must never
  appear in the streetname generator (see above).

## Feature status

| Feature | Status |
|---|---|
| Die Roller | Working — generic NdX roller, SVG dice faces, localStorage history |
| Name Generator | Working — streetnames + 7 cultures (3 are stubs) |
| Character Database | Nav link only, no content yet |
| NPC Generator | Nav link only, no content yet — will reuse the Name Generator's functions |
| Character Builder | Nav link only, no content yet — `js/character.js` has the data model started (streetname, metatype, attributes, essence, nuyen, skills[], specializations[], keywords[], dispositions[], cues[]) |
| Job Generator | Nav link only, no content yet |
| `js/dice/sra.js` | Empty stub for Anarchy 2.0 pool/hit-counting rules, once read |

## Working style notes

- Default collaboration mode has flexed between "user writes the code,
  Claude reviews/explains" and "Claude writes it directly" depending on
  what's asked each session/feature — don't assume either is the fixed
  rule; ask or follow however the current request is phrased.
- Only commit when explicitly asked. When pivoting away from a large
  chunk of working code (like the SR6e→Anarchy 2.0 switch), checkpoint it
  in a commit first rather than just deleting, even if it's about to be
  replaced — see `9e4a0fd` for the pattern.
- The user is doing their own rules reading in parallel — when a
  rules-dependent decision comes up (skills shape, Shadow Amps, wounds,
  gear), it's fine to propose a reasonable starting structure, but expect
  it to need revision once they've read more, and prefer pulling concrete
  examples from `reference/` over guessing.

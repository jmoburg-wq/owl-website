# The RRG family: how the apps fit together

Contractor Visual Studio (the Studio, this repo) is the hub. A project starts here, where the homeowner sees it on
their own house and picks it. Other apps either feed the Studio (a lead, a measurement) or take a design from it and
carry it further (Fullbid bids and runs the job). Every app keeps its own code, deploy and data. What they share is
a small set of agreements, written down here, so any two can be joined later without rewriting either.

This is a copy. The canonical file is `docs/family/FAMILY.md` in the Studio repo (`exterior-visualizer`). Change both together.

## Members

| App | Role | Where |
|---|---|---|
| **Contractor Visual Studio** (hub) | Design: see it on the house, pick it, get the takeoff and the contractor's bid | `rrg-studio.vercel.app/visualizer`, repo `exterior-visualizer` |
| **Fullbid** | Bid and run the job: measure on site, price, propose, sign, change orders, orders, money | `jmoburg-wq.github.io/owl-website`, repo `owl-website` |
| **Listwell** | Selling a home: listing visuals and local pros | Inside the Studio (`/visualizer/listing`) |
| **RRG Global** | The agency site that sells the family | repo `rrg-global` |

Joining next (James's list, Nov 4, 2026): the matchmakers (`window-matchmaker`, `waterfront-matchmaker`), the trade
sites (`pavelook`, `pavestrong`, `seawall-authority`, `rebuilt-roofing`), storm and claims (`hailcommand`,
`claimcloser`) and contractor tools (`contractorconvo`, `contractor-capital-navigator`, `knockrocket`). See
"Joining" below.

## The five agreements

### 1. Handoffs are documents with a schema and a version

A handoff is one JSON document: `{ schema, version, … }`. Fields a receiver doesn't know are ignored, so adding a
field is safe; renaming or removing one means version 2. A receiver refuses a newer version in plain words ("This
was made with a newer version; update this app").

| Schema | From → to | Link key | Status |
|---|---|---|---|
| `cvs.job-package` v1 | Studio → Fullbid | `cvs` | Live (`lib/fullbid/`) |
| `cvs.measurements` v1 | Fullbid → Studio | `cvs-measure` | Live (`lib/fullbid/measurements.ts`) |
| `family.lead` v1 | any app → Studio | `lead` | Proposed: the Studio doesn't read it yet |

### 2. They travel the same three ways

1. **Inside a link:** `<receiving page>#<key>=d:<base64url(deflate-raw(JSON))>`, for documents up to about 8,000
   characters encoded.
2. **A link to it:** `<receiving page>#<key>-url=<https URL>`. The receiver fetches it only from origins on its
   allow-list, and the sender serves it with CORS for the receiver's origin.
3. **A `.json` file** the person opens or drops on the receiving app.

The hash (`#…`) is never sent to a server, so a design or a customer's numbers in a link don't land in anyone's logs.

### 3. Nothing is created or changed silently

The receiver shows what arrived ("Fullbid sent 6 measurements for this customer") and acts only when the person
confirms. A better-sourced number replaces a weaker one; an equal or weaker one never silently overwrites.

### 4. One vocabulary

The same words mean the same thing in every app. Measurement kinds, units, where a number came from and how much to
trust it are defined once per codebase and must match:

- Studio: `lib/measure.ts` (`MEASURE_KINDS`, `MEASURE_SOURCES` with ranks), `lib/selections/measure.ts` (bath room sizes).
- Fullbid: `js/shared/vocab.js` (`MEASURE_KINDS`, `SOURCE_RANK`, trades, units, where a line is bought).

Sources and ranks: `measured` 5 (on site), `report` 5 (EagleView, Hover, Roofr), `satellite` 3, `photo` 2,
`homeowner` / `typed` 2, `typical` 1, `estimate` 1. A typical size is never sent back as a measurement.

Prices carry an evidence tier everywhere: E0 built-in starter, E1 a company's own starter estimate, E2 the
contractor's own price, E3 a supplier's price (online prices are "seen on a date", never a quote), E4 a quote for
this job, E5 what it actually cost. Nobody invents a maker's price, SKU, color name or spec.

### 5. House rules for everything a contractor or homeowner reads

Imperial units. Plain English with no code words. No building-code or engineering advice. No scraped maker or retailer
images. Renderings are labeled as design concepts. API keys, passwords and payment details never go in a field or a
file; James sets them.

## Where the hub takes things in

| What arrives | Where in the Studio | What happens |
|---|---|---|
| Measurements for a staff customer (`#cvs-measure=` on `/visualizer/admin?lead=…`) | The customer's Measurements card | Shows each number with its source and what was left out; "Add all" saves them through `POST /api/staff/customers/:id/measurements/import`, ranked like any other |
| A bath design's measured room (`?m=` on `/selections` or `/estimate`) | The bath takeoff | Sizes marked `measured` win over typed, guide, photo and typical sizes; measured glass openings are treated as cut-to-size |

## Joining

An app joins by doing three things:

1. **Use the vocabulary.** Store measurements as the shared kinds and sources, prices with an evidence tier.
2. **Hand off with the kit.** `family-kit.js` (in Fullbid at `js/shared/family-kit.js`, served at
   `https://jmoburg-wq.github.io/owl-website/js/shared/family-kit.js`) has `encode`, `decode`, `check`, `linkFor`,
   `readHash` and `familyLead` in one file with no dependencies. Copy it in, or import it from that address.
3. **Link back.** Put the sending page's address in the document (`design.url` in a job package) so the next app can
   offer "Open the design".

What each group most likely sends, to confirm against each app:

| Group | Likely handoff | To |
|---|---|---|
| Matchmakers (windows, waterfront) | `family.lead` with what the homeowner wants; later a starting design | Studio |
| Trade sites (paving, seawalls, roofing) | `family.lead` from their quote forms; the Studio already has these trades' visualizers | Studio |
| Storm and claims (hail, claims) | `cvs.measurements` from reports (`report` source) and `family.lead` | Studio, then Fullbid |
| Contractor tools (conversations, capital, door-knocking) | `family.lead`; a job's status back from Fullbid later | Studio, Fullbid |

## Next, in order

1. **The Studio reads `family.lead`.** Turn it into a lead with its source app and rep code, using the lead hand-off
   the Studio already has (saved first, then sent to the site's `/api/lead`).
2. **A family switcher.** One menu in each app listing the others, built from `FAMILY_APPS` in the kit.
3. **One sign-in across the family.** Decided Nov 11, 2026: the family shares the Studio's backend. Fullbid signs in
   with a Studio account and backs its jobs up there (the Studio repo's `docs/family/FULLBID-ACCOUNTS.md`). Next on
   that backend: AI estimates without the contractor's own key, then plans and billing through Helcim.

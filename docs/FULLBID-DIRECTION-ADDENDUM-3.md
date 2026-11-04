# Addendum 3 to FULLBID-DIRECTION.md (Nov 3, 2026): the job's whole list, not only the picks

James, Nov 3: "Make sure we integrate more seamlessly with Fullbid for helping contractors estimate labor and materials
beyond fixtures, walls etc. when they need to create a list of what's needed, so they can better provide a bid or
estimate to the clients."

Bath packages (shower, bathroom, and now walk-in tub) carry everything the job needs, by phase, beside what the
customer picked. The package is still `cvs.job-package` **version 1**: every field below is optional and additive.
A Fullbid that doesn't know them ignores them; nothing was renamed or removed.

## 1. New fields

```
JobPackage.phases?: [{ id, name }]                 the job's phases in order (below)
PackageMaterial.phase?: string                     a phases id
PackageMaterial.trade?: string                     the shared trade id that installs it (section 3.1)
PackageMaterial.kit?: string | null                "Added for the thermostatic valve"; null: the takeoff's own line
PackageLabor.crewDays?: [low, high]                8-hour days for one person, to the half day, for all units
PackageLabor.kit?: string | null                   the kit that added the hours; null: the design's own
PackageOption.checklist?: [{ id, text, phase, for }]   what the contractor confirms on site, in plain words
```

Phases, in order: `protection` Protection and demo · `framing` Framing and blocking · `plumbing` Plumbing rough-in ·
`electrical` Electrical · `substrate` Substrate and waterproofing · `setting` Tile, panels and setting · `drywall`
Drywall patch and paint · `fixtures` Fixtures, glass and trim-out · `finish` Finish and accessories · `consumables`
Consumables.

## 2. Job materials

After the design's own lines (unchanged, same ids, same order) come the contractor's job lines:

- **Job rows** (ids `<area>.job-…`): tape for the protection, the disposal fee, blocking for the valve and arm, a
  subfloor allowance ("as found"), valve adapters and drop-ear elbows, the shower's P-trap where the floor is rebuilt,
  a tub's drain and overflow, wire connectors and nail plates, backer board screws (27 a 3 × 5 ft sheet, from USG's
  Durock guide: every 8 in. on each stud), alkali-resistant seam tape (Durock's 2 in. × 50 ft roll), pipe and valve
  seals for the membrane, grout sealer (Aqua Mix Sealer's Choice Gold: 50 to 200 sq ft a quart, counted at 100),
  spacers or a leveling system, paint to blend drywall patches, accessory anchors, a door stop, a diamond hole saw,
  saw blade wear and sponges, and a small-parts allowance.
- **Kit rows** (ids `<area>.kit-<kit>--<part>`): what a design part brings (lib/surfaces/job-kits.ts):
  thermostatic valve → volume-control rough-ins; digital controls → data cable, power, an access panel; extra heads →
  a diverter, supply line, fittings, blocking; a ceiling rain head → its elbow and ceiling blocking; body sprays →
  their rough-in bodies; heated floor → the sensor's conduit (and the mat, thermostat and circuit when the takeoff
  lacks them); a heated towel rack → its box, cable and blocking; accent and chromatherapy lights → a driver each;
  a curbless linear drain → lumber to lower the floor; a freestanding tub → the filler's rough-in, drain and blocking;
  a walk-in tub → shutoffs, supply connections, the drain, a dedicated GFCI circuit where the tub has jets or heat
  (quoting the maker's sheet where it was read), leveling, sealant, grab bar blocking, and the old tub out.

Every job line is `designItem: false`, `price: null` (Fullbid prices it from the contractor's price book; unknown
stays blank), with `how` saying how its quantity was reached and `from` saying where it's bought (`supplier` when a
showroom supplier carries the plumbing, `specialty` for a plumbing or electrical supply house, `home-center`,
`contractor` for the contractor's own stock and allowances). The homeowner's order list on CVS does not change.

## 3. Labor and the checklist

Every labor row gets `crewDays`. Kits add hours only where the design has none for that part (a heated floor's hours
are already the design's). The checklist starts with every bath job's checks ("Confirm the drain location under the
floor", "Confirm the valve's position and the supply lines' size and condition"…) and adds each kit's ("Confirm the
water heater can fill the tub (about 100 gallons, as its maker states)", "Confirm the wall can take the fold-down
seat's blocking").

## 4. What Fullbid does with it

Keep the customer's picks (with pictures) apart from the job materials; show job materials by phase with editable
quantities, prices from the contractor's price book (tier shown, unknown blank), labor by trade with crew days; make
(a) the customer bid: picks with pictures, allowances, labor as the contractor chooses to show it, the total, and
(b) the material order sheet: every line grouped by where it's bought. Show the checklist on the job.

## 5. Samples

(Here in `test/fixtures/cvs/`; on the CVS side in `tests/fixtures/fullbid/`.)
`cvs-shower-jobs-neenan-wetroom.json` (a curbless wet room with body sprays and a lit niche,
72 × 42 in., 96-in. walls) and `cvs-walk-in-tub-ella-tub4two.json` (Ella's Bubbles Tub4Two with
air and water jets, two wall grab bars, the drain moved). CVS rewrites them with `UPDATE_FULLBID_FIXTURES=1 npx vitest
run tests/fullbid-jobs.test.ts`.

## 6. Built in Fullbid (branch `cvs-job-materials`)

- `js/cvs/job.js` (pure): `jobMaterialsByPhase`, `laborByTrade` (crew days), `siteChecklist`/`setCheck`, `setJobQty`,
  `setAllowance`, `customerBid` (picks with pictures, allowances, labor by trade / one line / inside the price, total),
  `materialOrderSheet` and `orderSheetText`. Packages without `phase` fall back to the line's `group`.
- `js/cvs/import.js`: lines carry `phase`, `jobTrade`, `kit`, `crewDays`; options keep `checklist`; the preview says
  how many customer picks, job materials and checks; a `specialty` job line for plumbing or electrical goes to the
  contractor's preferred supplier for that class, marked "confirm supplier".
- `js/cvs-ui.js` `cvsJobCard` on the Bid screen; `js/trades/bath/pack.js` `JOB_PHASES`.
- Tests: `test/cvs-job.mjs` and the addendum 3 steps at the end of `test/e2e-v2.mjs`.

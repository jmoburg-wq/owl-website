# Addendum 1 to FULLBID-DIRECTION.md (Nov 1, 2026)

Read after reviewing PR #1 (`fullbid-packs-cvs-import`, commit 470c93c). The work matches the direction. The three
real fixture files come with this addendum. Put them in `test/fixtures/cvs/`. They were run against the branch
before this was written: `node test/cvs.mjs` passes, 103 of 103, with all three present, and the lines import one for
one. That run also turned up the gaps below. Fix them on the same branch.

## 1. A contractor's own package: `from: "supplier"` must not make the contractor its own supplier

In the roof fixture, `company.role` is `"contractor"` (TimberCrest), and its materials say `from: "supplier"`, with
`fromLabel` "The contractor's roofing supplier". The import created a supplier record named "TimberCrest Exteriors"
and put all 16 roofing lines on it.

The rule, added to section 3.4:
- When `company.role` is `"supplier"`, `from: "supplier"` means that company. That is today's behavior; keep it.
- When `company.role` is `"contractor"`, `from: "supplier"` means **the contractor's preferred supplier for that
  material class**, as set in Suppliers. With nothing set, pick a supplier whose classes include it (ABC Supply
  carries roofing in the default list) and mark the line "Confirm supplier". Never create a supplier record from a
  contractor's own name.

Test: the roof fixture's 16 lines land on the preferred roofing supplier, and no supplier is named after the company.

## 2. Packs fill in what a package doesn't send

The roof fixture has materials and report-sourced measurements, but **no labor**. CVS's exterior tools don't suggest
hours yet. Today the import gives that job 0 labor hours, which would underbid it badly.

The rule, added to section 4.3: CVS lines replace a pack's own calculation **only for what the package contains**.
When an option has no `labor`, the pack works out labor from the imported measurements. For roofing, that means
tear-off and install hours from `roof_area`, pitch and layers, using the roofing pack's existing calculators. Tag
those lines `origin: "pack"`. Ask for any measurement the calculator needs and the package lacks; this roof has no
`roof_pitch`, so ask for it rather than assume one. The same applies to fees the pack normally adds, such as a
dumpster or a permit, when the package has none of them.

Tests:
- The roof fixture gets roofing labor greater than 0, tagged `pack`, plus a request for the pitch.
- The bath fixtures, which carry labor, get no pack labor added.

## 3. Turn the real-fixture checks from shape checks into the section 10 checks

The real files are in now, so assert their actual numbers. Today the tests check only line counts and that nothing
shows $0. These are the numbers to assert:

| Fixture | Lines and suppliers | Labor | Other checks |
|---|---|---|---|
| `cvs-shower-neenan-hall.json` | 29 materials. 6 on "Neenan": valve trim, head, hand shower, glass, drain, rough-in valve. "Debris haul-away" has no supplier and no order. The rest go to the preferred home center. | 8 labor lines; mid total 65.5 hr; low 47, high 84 | 11 lines show "typical size". Adding a measured `bath.showerW` marks them for recompute. |
| `cvs-bathroom-ferguson-luxury.json` | 69 materials; 24 on "Ferguson Home" | 20 labor lines; mid total 263.5 hr | Measurements from `photo` (room size) and `typed` (ceiling) are kept. A `measured` room length replaces the photo one. |
| `cvs-roof-timbercrest.json` | 16 materials, all on the preferred roofing supplier (item 1) | Pack labor (item 2) | 8 measurements from `report` and `measured`. A lower-ranked number doesn't replace them. |

Also re-run the diff test against a real file. Change the Neenan glass finish and the tile quantity, re-import, and
expect exactly those two differences. After signing, the same change produces a change order with two lines.

## 4. Wording that still reads as code guidance

Notes like "Rated connectors are commonly required; check your local rules" and "A drip leg is commonly required"
still tell the contractor what code requires. Say what the maker's instructions call for, or simply what the part
does:
- "Use the connectors the maker's instructions call for."
- "A sediment trap keeps debris out of the gas valve."

Keep `check your local rules` only where no maker instruction applies. Fullbid gives no code or engineering advice.

## 5. Answers to `docs/CVS-REQUESTS.md`

1. **Real fixtures:** attached, from CVS's own code: its order list, takeoff and bid-assist hours.
2. **Stable ids:** coming. These fixtures still number some fixture lines with a counter, for example
   `fixtures.shower-head-2`. The CVS exporter will give ids that stay the same across exports. Keep the diff code
   tolerant until then.
3. **Option ids and `design.id`:** will be stable. A copy of a design gets a new id.
4. **Endpoint, CORS, the inline "Send to Fullbid" link, and accepting measurement packets:** the CVS side will build
   these. Keep the request list current as you find more.
5. **`priceBookRefs`:** these are a company's own starter estimates. They may carry a number later. If one does, treat
   it as E1: shown to the contractor, and to a client only after the contractor accepts it.
6. **`company.id`:** always present. Match a supplier record by `company.id` first, then by name.
7. **Pictures:** treat CVS picture URLs as possibly expiring. Store a copy at import, as section 4.1 says.

## 6. Still James's decisions

Section 11 is unchanged: the backend for accounts and payments, the payment provider, the name and domain, and
whether CVS's own "price this job" page stays for showrooms. None of these block step 3, so go on to step 3 when
items 1 to 4 here are done.

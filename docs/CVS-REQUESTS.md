# Requests for the Contractor Visual Studio (CVS) side

Fullbid does not change CVS. These are the things CVS needs to do so the job package import (built in Fullbid on the
`fullbid-packs-cvs-import` branch) works end to end. Hand this list to the CVS side. Section numbers refer to
`docs/FULLBID-DIRECTION.md`; the answers come from its Addendum 1 (section 5) and Addendum 2 (Nov 1, 2026).

## Done on the CVS side

1. **Real fixture files.** Done. Six real exports are in `test/fixtures/cvs/` (see its README): the three from
   Addendum 1 and three from the current exporter. Fullbid's tests assert their numbers (Addendum 1, section 3).
2. **Stable line ids (4.1).** Done in the current exporter: material ids are `${area}.${takeoff id}` or
   `${area}.${item slug}` with no counter. The older exports still number some fixture lines with a counter
   (`fixtures.shower-head-2`); Fullbid's diff pairs those by area and item, so re-imports of either kind compare
   line by line.
3. **Stable option ids.** Done: option ids stay the same for the same design.
4. **`design.id` stays the same for the same design.** Done; a copy of a design gets a new id.
5. **Export endpoint (4.2).** Done: `https://rrg-studio.vercel.app/visualizer/api/fullbid/package?…`. Fullbid reads the
   whole URL after `#cvs-url=`, query included, encoded or not. `https://rrg-studio.vercel.app` always stays on
   Fullbid's allow-list (`settings.cvs.origins` only adds origins).
6. **CORS.** Done for `https://jmoburg-wq.github.io`. If Fullbid moves, CVS changes its `FULLBID_URL` setting and
   Fullbid adds the new origin to its allow-list.
7. **Inline links.** Done: "Bid it in Fullbid" on /estimate, /selections and the Review step sends `#cvs=d:` when the
   package is 8,000 characters or less compressed, otherwise `#cvs-url=`, plus a `.json` download. Exterior staff bids
   (bid editor and materials sheet) send `#cvs=d:` or a `.json` download. The 3-option shower export compresses to
   about 7,400 characters.

## Answers received

- **`priceBookRefs`:** a company's own starter estimates. Shown as reference notes. If one ever carries a number,
  Fullbid treats it as E1: shown to the contractor, and to a client only after the contractor accepts it.
- **Prices on bath lines:** a supplier's line is priced only where that company's price book has the item (E1, source
  "<Company>'s price book"); online picks carry a price "seen on" a date (E3, `seenOn`), never a quote. Fullbid honors
  both tiers and uses a price only when its `per` unit matches the line's unit.
- **`company.id`:** always present. Fullbid matches a supplier record by `company.id` first, then by name. A
  contractor's own package (`company.role: "contractor"`) never creates a supplier record.
- **Pictures:** treat CVS picture URLs as possibly expiring; Fullbid stores its own copy at import (section 4.1).
- **Customer:** bath packages from public pages carry `customer: null`; exterior staff bids carry the lead. Fullbid
  stores it only on the contractor's device.

## Still needed

8. **Accept measurement packets (section 5).** Built on the Studio side on branch `fullbid-measurements-family`
   (exterior-visualizer), not yet merged there. Fullbid sends `{ schema: "cvs.measurements", version: 1, designId,
   from, measurements: [{ kind, value, unit, source, takenAt, note }] }` as `#cvs-measure=d:<…>` on the design's own
   link, plus `?m=` for bath room sizes, or as a `.json` file. The Studio's customer Measurements card shows them and
   adds them on confirm; a bath design opened with `?m=` uses measured sizes first. Exterior packages need
   `design.url` to keep pointing at the customer (`/visualizer/admin?lead=…`), and bath packages need a `design.url`
   so the sizes can ride back on it.
9. **Pictures that last.** If CVS picture URLs expire, say how long they last.
10. **Unit text.** Keep units as words with sizes ("bags (50 lb)", "tubes (10.1 oz)"). Fullbid maps them to its
    units by the first word; please tell us if a new first word appears.
11. **Material groups.** Fullbid maps the group names "Lumber and framing", "Drywall", "Plumbing rough-in",
    "Electrical", "Waterproofing and setting materials", "Paint and finishing", "Demo and protection", "Roofing" and
    "Gutters" to its supplier classes. A new group name still imports (it falls back to building materials), but tell
    us so it can be mapped.
12. **New modules.** A module Fullbid doesn't know imports into its general pack. Tell us when CVS adds one so it can
    get a trade pack.
13. **A discount as a field.** The staff roof bid states its discount only in a note ("The total includes a $250
    discount."). Fullbid reads that amount into a "Discount" line so the option's price matches `option.total`. A
    field such as `option.discount: number | null` would be sturdier than reading the note.
14. **Roof pitch and layers in exterior packages.** The exterior tool sends `roof_area`, eaves, rakes and the rest, but
    not `roof_pitch` (the staff bid does) or the number of layers to tear off. When a package has no labor, Fullbid
    works out roofing hours from these and asks the contractor for a missing pitch. Sending `roof_pitch` and a
    `roof_layers` measurement (with their sources) whenever CVS has them saves that step.
15. **Labor hours for exterior designs.** CVS's exterior tools don't suggest hours yet. Until they do, Fullbid's packs
    work them out from the measurements (origin "pack", at starter rates until the contractor accepts them).

## Questions

- ~~Does an exterior staff bid's `option.total` include tax?~~ Answered (CVS, Nov 1, 2026): no. `total` is the bid's
  lines summed (`subtotal`), less `discount`, rounded up to the company's rounding step and raised to its minimum job.
  Compare it with Fullbid's price before tax; a difference within one rounding step is expected.
- ~~A real discount field~~ Done (CVS, Nov 1, 2026): options carry `subtotal` and `discount` (null when none). Fullbid
  reads `discount` first and falls back to the note for older packages.

# Requests for the Contractor Visual Studio (CVS) side

Fullbid does not change CVS. These are the things CVS needs to do so the job package import (built in Fullbid on the
`fullbid-packs-cvs-import` branch) works end to end. Hand this list to the CVS side. Section numbers refer to
`docs/FULLBID-DIRECTION.md`.

## Needed now

1. **The three real fixture files.** Export the Neenan bath, the roofing job and the third sample as
   `cvs.job-package` version 1 JSON and put them in Fullbid's `test/fixtures/cvs/`. Fullbid's tests already run
   against any file there. Until then, Fullbid tests against clearly labeled synthetic stand-ins in
   `test/fixtures/cvs-synthetic/`.
2. **Stable line ids (4.1).** A material's or labor item's `id` must stay the same every time the same design is
   exported, so a re-import can compare line by line (added, removed, quantity changed, finish changed). Ids with a
   counter that changes between exports would show every line as removed and re-added.
3. **Stable option ids.** The same holds for `options[].id`; Fullbid uses it to keep Good / Better / Best and the
   client's choice across re-imports.
4. **`design.id` stays the same for the same design.** Fullbid finds the existing job by it. A copy of a design
   should get a new id.

## Needed for links

5. **Export endpoint (4.2).** An https URL that returns the package JSON, for `#cvs-url=` links. Fullbid accepts
   these only from origins on its allow-list; today that is `https://rrg-studio.vercel.app` (one setting in Fullbid:
   `settings.cvs.origins`).
6. **CORS.** That endpoint must answer with `Access-Control-Allow-Origin` for Fullbid's origin
   (`https://jmoburg-wq.github.io` today; it changes if Fullbid gets its own domain).
7. **Inline links.** For small packages, a "Send to Fullbid" link of the form
   `<fullbid>/#cvs=d:<base64url(deflate-raw(JSON))>` (the same encoding as Fullbid's share links). Keep these under
   about 8 KB compressed; pictures stay as URLs.

## Needed later (Fullbid steps 3 and 4)

8. **Accept measurement packets (section 5).** `{ schema: "cvs.measurements", version: 1, designId, measurements:
   [{ kind, value, unit, source, takenAt, note }] }`, arriving as a link `#cvs-measure=d:<…>` or a `.json` file,
   so a design can be re-fitted to measured sizes. For the bath, also the `m=<base64url(JSON)>` page parameter that
   `encodeMeasure` already reads.
9. **Pictures that last.** Picture URLs in a package may be fetched once by Fullbid at import and stored. If they
   expire, say how long they last.
10. **Unit text.** Keep units as words with sizes ("bags (50 lb)", "tubes (10.1 oz)"). Fullbid maps them to its
    units by the first word; please tell us if a new first word appears.
11. **Material groups.** Fullbid maps the group names "Lumber and framing", "Drywall", "Plumbing rough-in",
    "Electrical", "Waterproofing and setting materials", "Paint and finishing" and "Demo and protection" to its
    supplier classes. A new group name still imports (it falls back to building materials), but tell us so it can
    be mapped.
12. **New modules.** A module Fullbid doesn't know imports into its general pack. Tell us when CVS adds one so it can
    get a trade pack.

## Questions

- Will `priceBookRefs` ever carry a number? Today Fullbid shows them as reference notes only, never as lines.
- Can `company.id` be included on every package, so Fullbid can match a supplier record by id instead of name?

# Addendum 2 to FULLBID-DIRECTION.md (Nov 1, 2026): the visualizers now send packages

The Contractor Visual Studio side (CVS) is live. Fullbid now receives packages from three places:

| Where | What it sends | How |
|---|---|---|
| Shower and bathroom: /estimate, /selections, and the Review step ("Bid it in Fullbid") | Materials with stable ids, labor hours by trade, the customer's picks with pictures, measurements, up to 3 options | `#cvs=d:` when the package is 8,000 characters or less compressed; otherwise `#cvs-url=https://rrg-studio.vercel.app/visualizer/api/fullbid/package?…`, served with CORS for `https://jmoburg-wq.github.io`. Also as a `.json` download. |
| Exterior staff bids, in the bid editor and the materials sheet (roofing, siding, gutters, windows, doors, seawalls, decks, paving…) | The contractor's priced bid lines as `workItems`, the production takeoff as `materials`, measurements with their sources, the customer, before/after pictures | `#cvs=d:` link, or a `.json` download when the package is too big for a link |

CVS reads Fullbid's address from its `FULLBID_URL` setting, which defaults to `https://jmoburg-wq.github.io/owl-website/`.
If Fullbid moves, CVS changes that setting and Fullbid adds the new origin to its allow-list.

## 1. Handle `workItems` and `option.total` (new optional fields in version 1)

```
workItems: [{ id, service, name, detail, qty, unit, qtyNote, price: { unit, per, tier: "E2", source, seenOn } | null }]
total: number | null
```

A work item is a line the contractor already prices as installed work. Examples: "GAF Timberline HDZ shingles,
installed", 24.3 per sq, from the contractor's own price book.

- **Import each work item as a priced line.** Use `cat: "work"` or Fullbid's nearest equivalent, at its price, with
  evidence E2. Its `name` and `detail` (the customer's color and style) print on the customer's bid.
- **Materials on a package with work items are for ordering only.** That is the takeoff. Keep them as the job's
  order list and its costs, but **don't add their cost to the customer's price a second time**. The work item's
  installed price already includes them.
- **Labor:** when a package has work items and no `labor`, the installed price already covers the labor. Don't add
  pack labor on top of it, unless the contractor turns on "price labor separately" for that job. This refines
  Addendum 1 §2. Pack labor applies when there are neither work items nor labor, as in the roof fixture.
- **`option.total`** is the total on the contractor's own bid. After import, show it beside Fullbid's total. Warn when
  they differ by more than 1%.

Tests:
- A roofing package with three options and work items imports with each option's price equal to its `total`.
- The takeoff materials appear on the order list but not in the price.
- No pack labor is added.

## 2. Bath packages now carry prices sometimes

A supplier's line is priced only where that company's own price book has the item. That is tier E1, source
"<Company>'s price book". Online picks carry the price "seen on Amazon" with `seenOn`, tier E3; that is never a
quote. Every other line is still `price: null`.

## 3. Ids are stable now

Material ids are `${area}.${takeoff id}` or `${area}.${item slug}` with no counter. Option ids and `design.id` stay
the same for the same design. A shower design that changes one finish changes only that line. Turn the diff tests
from Addendum 1 §3 on against stable ids.

## 4. The customer is included only on staff links

Bath packages from the public pages carry `customer: null`. Exterior packages come from a staff bid, and they carry
the lead's name, address, email and phone. Store the customer only on the contractor's device, as today.

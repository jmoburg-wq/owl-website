# Competitive teardown — SimplyWise, Handoff, Joist → Fullbid

Reverse-engineering notes compiled from web search of SimplyWise's marketing site, App Store/Google Play listings
(via aggregator mirrors), its blog, Trustpilot/Capterra reviews, and competitor documentation. Direct fetches of
simplywise.com, apps.apple.com and youtube.com were blocked by this session's network policy, so the YouTube short
(`/shorts/0pDMlhjgxy8`) and the brand-new LiDAR Room Scanner listing (`id6806955636`) could not be read verbatim.
Everything below is cross-referenced from at least two indexed sources unless marked *inferred*.

---

## 1. Company & product line

| Item | Finding |
|---|---|
| Positioning | "SimplyWise — AI Tools for Contractors: Estimates, Receipts, Mileage" |
| Apps | **Cost Estimator** (iOS `id6670619664`, Android `com.simplywise.costestimator`, v0.17.x), **LiDAR Room Scanner** (iOS `id6806955636`, new standalone spin-out of the estimator's Room Scan tab), Receipts/Mileage (legacy bookkeeping product) |
| Homepage anchor `#ch-estimates` | The "Estimates" chapter of the homepage: photo → itemized estimate → branded PDF → invoice |
| Pricing | Free download, 7-day trial. $29.99/mo or $239.99/yr (~$20/mo). IAP tiers "Cost Estimator Pro" ($29.99) and "Cost Estimator Business" ($59.99); SKUs range $4.99–$299.99. One article: "Contractor+ is free until your fifth estimate of the month". |
| Ratings | App Store ≈4.8, Trustpilot ≈4.7 (vendor-cited). Most critical review: "Not Trustworthy" from a licensed GC. Recurring friction: subscription/trial confusion. |
| Known gaps (self-admitted) | No change orders ("duplicate the estimate and resend"), limited web version, LiDAR requires iPhone Pro, deposit field absent on estimates (lives on invoice). |

## 2. Cost Estimator — feature inventory

Listing feature list (structured data): *AI-Powered Estimates from Photos · Professional Bid Creation · Smart Upsell
Suggestions · Built-In Markups · Before & After Visualization · Work Order Management · Project Organization ·
Invoicing · 3D Room Scanning · Measure · Invoices.*

### 2.1 Inputs (the "capture" layer)
1. **Photo** of the job site (primary, marketed as "photo → estimate in ~6 seconds").
2. **Voice description** in plain language.
3. **Typed description** ("describe the project in plain language").
4. **Uploaded plan** (PDF/image of drawings).
5. **LiDAR room scan** (iPhone Pro): wall lengths, ceiling height, square footage flow straight into quantities.
6. **Measure** tool for single on-the-go measurements.
7. **Client intake link**: client fills in info and uploads photos for you.

### 2.2 Processing (the "engine" layer)
- AI reads the capture and returns **material, labor, and fee line items**; every line has **unit, quantity, price per unit**.
- **Pricing data**: national construction pricing databases, **regionally adjusted**; material prices pulled from the
  **Home Depot closest to the registered ZIP**; marketed as "real-time material pricing".
- **Waste factor** applied to material quantities.
- **Markups / overhead / profit margin** applied automatically ("built-in markups").
- **AI flags missing details** and "improves line items before you share".
- **Smart upsell suggestions** (adjacent scope the contractor often forgets to quote).

### 2.3 Outputs (the "document" layer)
- Editable estimate (material/labor/fee lines separated), **branded PDF quote**.
- **E-signature**: client signs on their phone.
- **Convert estimate → invoice** (three-dot menu on a saved estimate); invoice carries deposit/payments.
- **Before & After AI renderings** (visualization upsell).
- **Work orders**, **projects/folders** organized by room, job type, or client.
- Share by link/PDF; clients can respond from the link.

### 2.4 Screen flow (reconstructed)
```
Home (Projects list) ─▶ New Estimate
   ├─ Capture: Photo | Voice | Text | Plan | Room Scan
   ├─ Generating… (~6 s)
   ├─ Estimate editor: lines grouped Materials / Labor / Fees, each editable; totals with markup
   │     ├─ AI review: "missing details" flags, upsell chips
   │     └─ Settings: markups, tax, terms
   ├─ Preview → Send (PDF/link) → Client e-signs
   └─ ••• menu → Convert to Invoice → record deposit/payments → Paid
```

## 3. LiDAR Room Scanner — feature inventory

Confirmed from SimplyWise guides describing the Room Scan tab (standalone listing not indexed):
- Uses the iPhone Pro **LiDAR sensor + camera** (Apple RoomPlan under the hood, *inferred* from their blog's RoomPlan focus)
  to build a **parametric floor plan in one walk** of the room.
- Output: **floor plan with wall lengths labeled**, **rotatable 3D model**, **square footage worked out**, ceiling height.
- Measurements **feed the estimate** directly (sf of floor, sf of wall, LF of perimeter).
- Category-standard exports (*inferred* from peers RoomScan Pro, magicplan, PaoApps): PDF plan, PNG, USDZ/GLB 3D, CSV/JSON.
- Guidance they publish: walk a slow circle, sweep up/down to capture full wall height, take ceiling height in two spots,
  LiDAR reliable to ~5 m per surface.

## 4. What a browser can and cannot replicate

| Capability | Native (SimplyWise) | Web (this build) |
|---|---|---|
| LiDAR depth | ARKit/RoomPlan on iPhone Pro | **WebXR `depth-sensing`** on Android Chrome/ARCore → point cloud; not available in iOS Safari |
| Plane/corner placement | RoomPlan | **WebXR `hit-test`** reticle (Android). **Gyroscope trigonometry** fallback on every phone (incl. iPhone): known camera height + pitch → floor distance; yaw → bearing |
| Ceiling height | LiDAR | Gyro: elevation angle to wall/ceiling junction over a captured corner; or manual |
| Doors/windows | RoomPlan detects | Two-tap marking on a wall (AR or gyro) or manual per-wall editor |
| 3D model | USDZ viewer | Three.js scene; export GLB/OBJ/STL/PLY |
| Floor plan | Native render | SVG with dimensions, PNG export, embedded in PDF |
| Photo → AI estimate | Cloud LLM/vision | **Claude vision + structured output** (catalog-constrained JSON) via the artifact runtime, the user's own key, or a server proxy; plus the local rule engine as the no-cost path |
| Home Depot live pricing | Server scraping/API | Editable national catalog + regional multiplier table (state/ZIP). Pricing is user-editable and persisted. |
| PDF | Native | Print-to-PDF with print stylesheet |
| E-sign | In-app | Canvas signature pad, PNG + timestamp stored with estimate |
| Invoice conversion | In-app | Status machine: draft → sent → signed → invoiced → paid, deposits/payments ledger |
| Offline | Native | PWA service worker; all data local (localStorage + IndexedDB for point clouds) |

## 5. Strategic read (why they win, where the moat is thin)
- **Moat = speed to a defensible number.** Six seconds from photo to priced lines is the entire pitch; everything else
  (invoice, e-sign, folders) is table stakes already offered by Joist/Jobber/Houzz Pro.
- **Pricing data is the real asset** (ZIP-local Home Depot pulls + regional index). It is also the easiest thing to
  make *editable and transparent*, which they do not: reviewers complain bids change on re-open.
- **Thin spots to attack:** no change orders, no web parity, LiDAR gated to iPhone Pro, estimate accuracy opaque.
  A browser-first app that runs on *any* phone, keeps data on-device, shows its math, and exports open formats
  (GLB/OBJ/CSV/JSON) is a credible wedge for independent trades.


---

## 6. Handoff and Joist (added for v2)

Sources: Handoff and Joist listings and reviews on the App Store, Software Advice, GetApp, Capterra and G2, plus
vendor blogs (handoff.ai itself was blocked by this session's network policy).

| | Handoff | Joist |
|---|---|---|
| Price | Flex $149/mo ($119 annual), Pro $299/mo (contract), Scale $719/mo annual; custom API tier | Basics ~$8/mo (5 docs), Pro ~$14–15/mo |
| Core | AI estimates from voice/photo/plans, proposals, digital invoices & payments; AI takeoffs and sub portal on top tier | Estimates, invoices, payments, e-sign, homeowner financing, QuickBooks sync, client management |
| Loved | 70% less estimating time (2–5 h → 15–30 min), responsive support, close-enough numbers | Simple, fast on site, professional-looking estimates, financing helps close larger jobs |
| Complaints | AI pricing not accurate enough; glitches; expensive for small jobs; card fees passed to clients; users ask to **choose Lowe's vs Home Depot** as the price source | QuickBooks sync inconsistent; outages; weak project management and reporting |

## 7. How Fullbid answers the field

| Gap in the market | Fullbid |
|---|---|
| "Pricing isn't accurate for my market" (SimplyWise, Handoff) | **How you price**: your overhead, net goal, wages and burden → target margin, billable rate, own labor rates by trade; regional index by ZIP; underbid warning with one-tap fix |
| "Let me choose Lowe's vs Home Depot" (Handoff request) | Supplier per material class (Home Depot, Lowe's, Menards, Ace, Ferguson, ABC Supply, lumber yard, plant, custom), account discounts, imported price lists, live lookup on supplier sites |
| "What else do I need for this product?" (no one) | 25 product systems + AI "describe anything": required / recommended / optional parts with reasons, labor hours by trade, fees, notes, supplier and cost |
| No change orders (SimplyWise) | Change orders with photo, priced lines, credits, signatures and a contract ledger |
| Only one price (all) | Good / Better / Best generated by actually pricing every quality option; client picks + add-ons at signing |
| LiDAR-only / iPhone Pro gating (SimplyWise) | Any phone: camera + sensors, Android AR, shapes, drawing; plus roof, siding, flatwork and fence measuring |
| Weak web app (SimplyWise) | The web app *is* the product — installable, offline, same features on phone and desktop |
| QuickBooks (SimplyWise none, Joist flaky) | QuickBooks Online invoice CSV import (no live sync yet) |
| Job planning thin (Joist) | Job plan: hours by trade, crew-days, materials by supplier, margin |

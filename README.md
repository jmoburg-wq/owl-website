# Fullbid — Measure it. Configure it. Bid it complete.

Fullbid is a mobile-first web app for contractors. It measures rooms, roofs, siding, decks, drives and fences with a
phone. When you pick a product from a manufacturer or supply house, it lists **everything else the job needs**: parts,
labor hours by trade, disposal and permits, where to buy each item, and what it costs. It then prices the bid **the way
you price**, with Good/Better/Best options, e-signature, change orders and invoicing. It runs in any phone browser,
installs to the home screen, works offline, and keeps all data on the device.

## The loop

| Step | What happens |
|---|---|
| **Measure** | Interior rooms (AR, camera + sensors, shapes or finger-drawn), roofs (footprint + pitch gauge), exterior walls, flat areas (deck, patio, driveway, slab) and linear runs (fence, gutter). 3D model + dimensioned plan for each. |
| **Build** | Pick a product — 25 configurable systems from toilets and water heaters to roof systems, siding, decks and fences — or **describe anything** (name, SKU, specs, a photo of the box) and AI builds the list. Every part is marked *required / recommended / optional* with a one-line reason, sourced from your supplier for that category, with labor hours by trade, fees and “before you order” notes. |
| **Price** | *How you price* turns your overhead, sales, net-profit goal, wages and burden into a target margin, billable rate and minimums. Bids use markup, margin or hourly billing, and **warn you before you underbid** (one tap fixes it). |
| **Source** | Suppliers (Home Depot, Lowe’s, Menards, Ace, Ferguson, ABC Supply, your lumber yard, your plant, any you add) with account pricing, preferred supplier per material class, imported price lists (CSV/paste), optional live price lookup on supplier sites, and per-supplier order lists. |
| **Bid** | Itemized proposal with Good · Better · Best and add-ons the client picks when signing; share link; e-signature; contract total locked at signing. |
| **Change** | Change orders with photo, priced lines (work items from your measurements, custom lines or AI draft), client signature, credits, and a contract ledger that updates itself. |
| **Close** | Convert to invoice, record payments, export QuickBooks Online invoice CSV, takeoff CSV, material orders, and an internal job plan (hours by trade, crew-days, suppliers, margin). |

Client approvals come back **without a server**: the client signs on their phone and taps *Send it back*; the link they
send opens on the contractor’s phone and applies the signature, chosen option and change-order approvals.

## Run it

```bash
cd fullbid
python3 -m http.server 8080
```

Open `http://localhost:8080`. On a phone, the camera, motion sensors and AR need **HTTPS** (`localhost` counts; a LAN
IP over plain HTTP does not). On a laptop, try **Measure → Load demo** for every measurement kind.

### Deploy

- **GitHub Pages** — push to `main`; `.github/workflows/pages.yml` runs the unit tests and publishes only the app. In
  the repository's Settings → Pages, set Source to "GitHub Actions" once.
- **Netlify / Cloudflare Pages** — point at the repository root. `_headers` sets the camera/motion/WebXR permissions
  policy and no-cache on the service worker. No build step.
- Requires iOS 16.4+ / Chrome 89+ (import maps).

## AI assist

Three transports, picked automatically (`js/pricing/ai.js`), all sharing one prompt/schema module (`js/pricing/ai-prompt.js`):

| Transport | When | Key handling |
|---|---|---|
| Claude artifact runtime | the app runs as a claude.ai artifact | none — the viewer's own Claude account |
| Anthropic SDK in the browser | you paste an API key in Settings → AI assist | stays in this device's storage, never in backups |
| Your server endpoint | Settings → AI assist → Server endpoint | key lives on your server (`server/worker.mjs`) |

Tasks: **estimate from photos + description**, **configure anything** (what else a product needs), and **live supplier
prices** (Claude web search restricted to your suppliers' sites; own key or endpoint only). Default model Claude Opus
5.5 (Sonnet 5.5 selectable), structured outputs, prompt caching, server-side refusal fallback.

Deploying the proxy:

```bash
cd server && npm init -y && npm i @anthropic-ai/sdk
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

with a `wrangler.toml` of `main = "worker.mjs"` and `compatibility_flags = ["nodejs_compat"]`.

## Device support

| Capability | iPhone Safari | Android Chrome | Desktop |
|---|---|---|---|
| Camera scan, pitch gauge, quick measure | ✅ (allow Motion & Orientation) | ✅ | — |
| AR scan + depth point cloud | — (no WebXR AR on iOS) | ✅ ARCore devices | — |
| Shapes, drawing, demos, 3D, plans, exports | ✅ | ✅ | ✅ |
| Build, pricing, suppliers, bids, change orders, invoices | ✅ | ✅ | ✅ |
| Voice dictation | ✅ | ✅ | Chrome / Edge |

Sensor scans are typically within 2–4% once squared up — right for bids, not for cutting.

## Project layout

```
index.html, manifest.webmanifest, sw.js, icons/, _headers, netlify.toml, .github/workflows/pages.yml
css/app.css                   design system + print styles
js/brand.js                   the product name (change it here)
js/app.js                     shell, routing, Jobs, Settings, share/response links
js/store.js                   local storage + IndexedDB point clouds; legacy-key migration
js/geometry.js                polygons, metrics, measurement kinds (roof/flat/linear/exterior math)
js/scanner/*                  Measure tab, camera+sensor scanner, WebXR AR, shapes & drawing
js/measure.js                 quick measure + roof pitch gauge
js/model3d.js, js/model-ui.js, js/floorplan.js   3D (rooms, houses with roofs, decks/slabs), plans, exports
js/configurator-ui.js         Build tab + "everything this job needs"
js/pricing/products.js        25 product systems: parts (required/recommended/optional + why), labor hours, fees, notes
js/pricing/catalog.js         48 work items across 13 trades (interior + exterior)
js/pricing/estimator.js       takeoff → supplier/price-list/labor-rate pricing → totals (markup/margin/hourly) → ledger, job plan, CSVs
js/pricing/profile.js         how you price: margin↔markup, burden, overhead, billable rate, minimums, rounding
js/pricing/suppliers.js       suppliers, preferences, CSV price lists + matching, order grouping
js/pricing/tiers.js           Good / Better / Best generation, pricing and choice
js/pricing/regional.js, smart.js, ai.js, ai-prompt.js
js/estimate-ui.js, js/pricing-ui.js, js/suppliers-ui.js, js/changeorder-ui.js, js/document.js
server/worker.mjs             optional AI proxy
docs/TEARDOWN.md              SimplyWise / Handoff / Joist teardown and how Fullbid answers each gap
test/                         unit (Node) + Playwright end-to-end suites
```

## Tests

```bash
npm run test:unit          # geometry, roof math, scanner trig, pricing methods, suppliers, products, tiers, ledger, AI request shapes
npm run test:e2e           # Playwright: v1 flows (scan → 3D → estimate → sign → invoice → share → AI transports)
node test/e2e-v2.mjs       # Playwright: pricing profile, price lists, all measurement kinds, configurator, underbid fix,
                           #   Good/Better/Best signing, change orders, exports, client round trip, describe-anything
```

## Known limits

- iOS Safari has no WebXR AR, so iPhones use the camera + sensor scanner; true LiDAR needs a native shell.
- Live supplier prices depend on what supplier sites publish; prices behind a pro login stay on your imported price list.
- Client approvals travel as links (no server). A hosted backend would add real-time status, SMS sending and payments.
- QuickBooks is a CSV import, not a live sync.

// v2 end-to-end: pricing profile, suppliers + price lists, exterior measuring, product configurator,
// money checks, Good/Better/Best signing, change orders, exports and the backend-free client round trip.
import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = (() => { try { return createRequire(import.meta.url)('playwright'); } catch { return createRequire('/opt/node-tools/node_modules/')('playwright'); } })();
const OUT = new URL('../docs/screens', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true };
const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
const errors = []; const fails = []; const watch = (p, tag) => { p.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); }); }; watch(page, 'main');
const log = (...a) => console.log('•', ...a); const check = (cond, msg, extra = '') => { if (cond) console.log('  ✓', msg); else { console.log('  ✗', msg, extra); fails.push(msg); } };
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const S = (p) => p.evaluate(() => { const st = window.__fullbid.store; return { settings: st.settings, project: st.activeProject() }; });
const money = (t) => Number(String(t).replace(/[^0-9.-]/g, ''));
try {
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForSelector('#screen-home .hero'); await shot(page, 'v2-01-jobs');
  // ---------------- A. how you price
  log('A. pricing profile');
  await page.click('.tabbar [data-tab="settings"]'); await page.click('[data-hub="pricing"]'); await page.waitForSelector('.panel .calc-out');
  const setNum = async (label, v) => { const inp = page.locator('.panel .field', { hasText: label }).locator('input').first(); await inp.fill(String(v)); await inp.dispatchEvent('input'); };
  await setNum('Yearly overhead', 80000); await setNum('Expected yearly sales', 500000); await setNum('Net profit you want to keep', 12);
  await page.click('.panel button:has-text("Use this as my target margin")'); await page.waitForTimeout(200);
  await setNum('Average wage', 30); await setNum('Labor burden', 30); await setNum('Minimum job charge', 450); await page.locator('.panel .field', { hasText: 'Round bid prices up to' }).locator('select').selectOption('25');
  await shot(page, 'v2-02-how-you-price'); await page.click('.panel [data-pact="action"]'); await page.waitForTimeout(300);
  let st = await S(page); check(st.settings.profile.method === 'margin' && st.settings.profile.targetMargin === 28 && st.settings.profile.setupDone, 'overhead 16% + net 12% → 28% target margin', JSON.stringify({ m: st.settings.profile.method, t: st.settings.profile.targetMargin }));
  check(st.settings.profile.minJob === 450 && st.settings.profile.rounding === 25, 'minimum job & rounding saved');
  // ---------------- B. suppliers + price list
  log('B. suppliers & price lists');
  await page.click('[data-hub="suppliers"]'); await page.waitForSelector('.panel select[data-cls]');
  await page.click('.panel [data-act="paste"]'); await page.locator('.sheet select').selectOption('ferguson'); await page.click('.sheet button:has-text("Continue")');
  await page.waitForSelector('.sheet textarea'); await page.fill('.sheet textarea', 'Item #,Description,UOM,Your Price\n1001234,Wax Ring with Horn,EA,4.75\n204567,1/4-Turn Angle Stop Valve,EA,11.20'); await page.click('.sheet button:has-text("Import")'); await page.waitForTimeout(300);
  await page.click('.panel [data-act="add"]'); await page.fill('.sheet [data-f="name"]', 'Neenan Supply'); await page.fill('.sheet [data-f="disc"]', '8'); await page.click('.sheet [data-k="plumbing"]'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(200);
  await shot(page, 'v2-03-suppliers'); await page.click('.panel [data-pact="back"]');
  st = await S(page); check(st.settings.priceList.length === 2 && st.settings.suppliers.some((x) => x.name === 'Neenan Supply' && Math.abs(x.factor - 0.92) < 1e-9), 'price list imported + custom supplier added', JSON.stringify({ n: st.settings.priceList.length }));
  await page.fill('#screen-settings input[placeholder="e.g. 78701"]', '78701'); await page.press('#screen-settings input[placeholder="e.g. 78701"]', 'Tab');
  await page.fill('#screen-settings input[placeholder="Acme Remodeling LLC"]', 'Hill Country Exteriors'); await page.press('#screen-settings input[placeholder="Acme Remodeling LLC"]', 'Tab');
  // ---------------- C. measure every kind
  log('C. measuring roof, exterior, deck, fence');
  await page.click('.tabbar [data-tab="home"]'); await page.click('#screen-home [data-act="new"]'); await page.waitForSelector('.sheet [data-f="name"]'); await page.fill('.sheet [data-f="name"]', 'Dana Whitfield'); await page.fill('.sheet [data-f="address"]', '412 Maple Ct, Austin, TX'); await page.fill('.sheet [data-f="pname"]', 'Whitfield exterior + bath'); await page.click('.sheet button:has-text("Save")'); await page.waitForSelector('#screen-scan .kind-seg');
  for (const k of ['roof', 'exterior', 'flat', 'linear']) { await page.click('.tabbar [data-tab="scan"]'); await page.click(`#screen-scan [data-kind="${k}"]`); await page.click('#screen-scan [data-act="demo"]'); await page.waitForSelector('.sheet'); await page.click(k === 'exterior' ? '.sheet button:has-text("Save room")' : '.sheet button:has-text("Save")'); await page.waitForTimeout(700); if (k === 'roof') { await page.waitForSelector('#screen-model canvas'); await page.waitForTimeout(900); await shot(page, 'v2-04-roof-3d'); } }
  await page.click('.tabbar [data-tab="scan"]'); await page.waitForSelector('#screen-scan [data-act="view"]'); await shot(page, 'v2-05-measure-list');
  st = await S(page); check(st.project.rooms.map((r) => r.kind).join(',') === 'roof,exterior,flat,linear', 'four areas of four kinds', st.project.rooms.map((r) => r.kind).join(','));
  // ---------------- D. configure products
  log('D. product configurator');
  await page.click('.tabbar [data-tab="build"]'); await page.waitForSelector('[data-sys="roof_system"]'); await shot(page, 'v2-06-build-grid');
  await page.click('[data-sys="roof_system"]'); await page.waitForSelector('.panel .need-line');
  const roofQtyPh = await page.getAttribute('.panel [data-q="qty"]', 'placeholder'); check(/^15(\.0)? \(from measurement\)/.test(roofQtyPh || ''), 'roof system linked to the measured roof (15 sq)', roofQtyPh);
  await page.fill('.panel [data-f="productName"]', 'GAF Timberline HDZ'); await page.waitForTimeout(400); await shot(page, 'v2-07-configure-roof');
  const roofNeeds = await page.$$eval('.panel .need-line', (els) => els.length); check(roofNeeds >= 14, 'roof system lists starter, ridge cap, underlayment, ice & water, drip edge, nails, boots, labor, dumpster, permit', roofNeeds);
  await page.click('.panel [data-a="save"]'); await page.waitForTimeout(300);
  await page.click('[data-sys="toilet"]'); await page.waitForSelector('.panel .need-line'); await page.fill('.panel [data-f="productName"]', 'Kohler Cimarron K-3851'); await page.fill('.panel [data-f="price"]', '289');
  await page.locator('.panel .need-line', { hasText: 'Flange repair ring' }).locator('.switch').click(); await page.waitForTimeout(400);
  const toiletText = await page.textContent('.panel'); check(/Wax ring/.test(toiletText) && /Closet bolts/.test(toiletText) && /Ferguson/.test(toiletText) && /price list/i.test(toiletText), 'toilet: parts + Ferguson + price-list price shown');
  check(/Where to buy it/.test(toiletText) && /\$289/.test(toiletText), 'typed product price used');
  await shot(page, 'v2-08-configure-toilet'); await page.click('.panel [data-a="save"]'); await page.waitForTimeout(300);
  st = await S(page); const prods = st.project.estimate.products; check(prods.length === 2 && prods[1].on['flange-repair-ring-spacer'] === true && prods[1].price === 289, 'two products saved with options + typed price', JSON.stringify(prods.map((p) => p.key)));
  // ---------------- E. bid: scope, money checks, tiers
  log('E. bid');
  await page.click('.tabbar [data-tab="estimate"]'); await page.waitForSelector('#screen-estimate .line');
  await page.fill('#screen-estimate textarea', 'Paint the house exterior two coats, new 6 inch seamless gutters, build the deck with composite decking, privacy fence with 2 gates'); await page.click('#screen-estimate [data-act="build"]'); await page.waitForTimeout(500);
  st = await S(page); const keys = st.project.estimate.assemblies.map((a) => a.key); check(['ext_paint', 'gutters', 'deck_build', 'fence'].every((k) => keys.includes(k)), 'exterior scope parsed', keys.join(','));
  const items = st.project.estimate.items; const wax = items.find((i) => /Wax ring/.test(i.name)); check(wax && wax.unitCost === 4.75 && wax.priceSource === 'price list', 'wax ring priced from the Ferguson price list', JSON.stringify(wax && { c: wax.unitCost, s: wax.priceSource }));
  check(items.some((i) => /Drip edge/.test(i.name) && i.supplierId === 'abc') && items.some((i) => /Decking boards/.test(i.name) && i.supplierId === 'yard'), 'roofing from ABC Supply, decking from the lumber yard');
  check(st.project.estimate.adj.method === 'margin' && st.project.estimate.adj.targetMargin === 28, 'new bid inherits the 28% margin profile');
  const mine = await page.textContent('#screen-estimate .card:has(h3:has-text("Your numbers"))'); check(/On target/.test(mine) && /28\.0%/.test(mine), 'your numbers: on target at 28%', mine.slice(0, 160));
  await shot(page, 'v2-09-bid-top'); await page.evaluate(() => { const r = document.querySelector('#screen-estimate'); r.scrollTop = r.scrollHeight * 0.55; }); await shot(page, 'v2-10-bid-numbers');
  await page.click('#screen-estimate .seg button:has-text("Markup")'); await page.waitForSelector('#screen-estimate [data-adj="materialMarkup"]');
  for (const [k, v] of [['materialMarkup', 5], ['laborMarkup', 5], ['overhead', 0], ['profit', 0]]) { await page.fill(`#screen-estimate [data-adj="${k}"]`, String(v)); await page.dispatchEvent(`#screen-estimate [data-adj="${k}"]`, 'change'); }
  await page.waitForTimeout(300); const warn = await page.$('#screen-estimate [data-role="fixrow"]:not(.hidden)'); check(!!warn, 'underbid warning appears at ~5% markup'); await shot(page, 'v2-11-underbid-warning');
  await page.click('#screen-estimate [data-act="fix-margin"]'); await page.waitForTimeout(400); st = await S(page); check(st.project.estimate.adj.method === 'margin' && st.project.estimate.adj.targetMargin === 28, 'one tap re-prices at the target margin');
  await page.click('#screen-estimate [data-act="tiers-on"]'); await page.waitForSelector('#screen-estimate .tier');
  const tierVals = await page.$$eval('#screen-estimate .tier .v', (els) => els.map((e) => Number(e.textContent.replace(/[^0-9.]/g, '')))); check(tierVals.length === 3 && tierVals[0] < tierVals[1] && tierVals[1] < tierVals[2], 'Good < Better < Best', tierVals.join(' / '));
  await page.evaluate(() => { const r = document.querySelector('#screen-estimate'); r.scrollTop = document.querySelector('#screen-estimate .tier').offsetTop - 120; }); await shot(page, 'v2-12-tiers');
  // ---------------- F. documents, exports
  log('F. proposal, sign with tier choice, exports');
  await page.click('#screen-estimate [data-act="preview"]'); await page.waitForSelector('.doc .tiers'); await shot(page, 'v2-13-proposal');
  await page.click('.doc-actions [data-act="sign"]'); await page.waitForSelector('.sheet .tier'); await page.click('.sheet [data-t="best"]'); await page.waitForTimeout(200);
  const addSwitch = page.locator('.sheet .switch').first(); if (await addSwitch.count()) await addSwitch.click(); await page.waitForTimeout(150); const chooseTotal = money(await page.textContent('.sheet .calc-out b')); await shot(page, 'v2-14-choose-option');
  await page.click('.sheet button:has-text("Continue to sign")'); await page.waitForSelector('.sigpad'); await page.fill('.sheet [data-f="name"]', 'Dana Whitfield');
  const sig = await page.$('.sigpad'); const bb = await sig.boundingBox(); await page.mouse.move(bb.x + 20, bb.y + 80); await page.mouse.down(); for (let i = 0; i < 25; i++) await page.mouse.move(bb.x + 20 + i * 10, bb.y + 80 + Math.sin(i / 3) * 30); await page.mouse.up();
  await page.click('.sheet button:has-text("Accept & sign")'); await page.waitForTimeout(500);
  st = await S(page); check(st.project.estimate.tiers.chosen === 'best' && Math.abs(st.project.estimate.signedTotal - chooseTotal) < 1, 'signed Best (+ add-on); contract locked at the chosen total', JSON.stringify({ chosen: st.project.estimate.tiers.chosen, signed: st.project.estimate.signedTotal, shown: chooseTotal }));
  await shot(page, 'v2-15-signed'); await page.click('.doc-bar [data-act="close"]'); await page.waitForTimeout(300);
  const dl = page.waitForEvent('download'); await page.click('#screen-estimate [data-act="qbo"]'); const d = await dl; const qbPath = await d.path(); const qb = fs.readFileSync(qbPath, 'utf8'); check(qb.startsWith('"InvoiceNo","Customer"') && qb.split('\n').length > 20, 'QuickBooks CSV downloaded', d.suggestedFilename());
  await page.click('#screen-estimate [data-act="order"]'); await page.waitForSelector('.panel .card'); const orderGroups = await page.$$eval('.panel .card .card-title h3', (els) => els.map((e) => e.textContent)); check(orderGroups.length >= 3 && orderGroups.includes('ABC Supply') && orderGroups.includes('Ferguson'), 'material orders split by supplier', orderGroups.join(', ')); await shot(page, 'v2-16-material-orders'); await page.click('.panel [data-pact="back"]');
  await page.click('#screen-estimate [data-act="plan"]'); await page.waitForSelector('.panel .kpi'); const planTxt = await page.textContent('.panel'); check(/Roofer/.test(planTxt) && /Plumber/.test(planTxt) && /crew-days/.test(planTxt), 'job plan: hours by trade and crew-days'); await shot(page, 'v2-17-job-plan'); await page.click('.panel [data-pact="back"]');
  // ---------------- G. change order
  log('G. change order');
  await page.click('#screen-estimate [data-act="co-new"]'); await page.waitForSelector('.panel [data-f="title"]'); await page.fill('.panel [data-f="title"]', 'Replace rotted fascia'); await page.fill('.panel [data-f="reason"]', 'Found 24 ft of rotted fascia behind the gutters on the north side.'); await page.fill('.panel [data-f="scheduleDays"]', '1');
  await page.click('.panel [data-a="custom"]'); await page.waitForSelector('.sheet [data-f="name"]'); await page.fill('.sheet [data-f="name"]', 'Fascia board 1×6 PVC (12 ft)'); await page.fill('.sheet [data-f="qty"]', '2'); await page.fill('.sheet [data-f="cost"]', '38'); await page.click('.sheet button:has-text("Add")');
  await page.click('.panel [data-a="custom"]'); await page.waitForSelector('.sheet [data-f="name"]'); await page.fill('.sheet [data-f="name"]', 'Remove & replace fascia'); await page.locator('.sheet [data-f="unit"]').selectOption('hr'); await page.fill('.sheet [data-f="qty"]', '5'); await page.fill('.sheet [data-f="cost"]', '52'); await page.locator('.sheet [data-f="cat"]').selectOption('labor'); await page.click('.sheet button:has-text("Add")');
  await page.waitForTimeout(200); await shot(page, 'v2-18-change-order');
  await page.click('.panel [data-a="doc"]'); await page.waitForSelector('.doc .ledger'); await page.click('.doc-actions [data-act="approve"]'); await page.waitForSelector('.sigpad'); const s2 = await page.$('.sigpad'); const b2 = await s2.boundingBox(); await page.mouse.move(b2.x + 30, b2.y + 70); await page.mouse.down(); for (let i = 0; i < 20; i++) await page.mouse.move(b2.x + 30 + i * 12, b2.y + 70 + Math.cos(i / 2) * 25); await page.mouse.up(); await page.click('.sheet button:has-text("Accept & sign")'); await page.waitForTimeout(400);
  await shot(page, 'v2-19-change-order-signed'); await page.click('.doc-bar [data-act="close"]'); await page.click('.panel [data-pact="back"]'); await page.waitForTimeout(300);
  st = await S(page); const coL = await page.evaluate(async () => { const m = await import('./js/pricing/estimator.js'); const p = window.__fullbid.store.activeProject(); return { L: m.ledger(p), co: m.coTotals(p.changeOrders[0], p.estimate) }; });
  check(st.project.changeOrders[0].status === 'approved' && Math.abs(coL.L.revised - (coL.L.original + coL.co.total)) < 0.01 && coL.co.total > 0, 'change order approved; revised contract = original + CO', JSON.stringify(coL.L));
  // ---------------- H. client round trip (no server)
  log('H. client round trip');
  await page.click('#screen-estimate [data-act="co-new"]'); await page.waitForSelector('.panel [data-f="title"]'); await page.fill('.panel [data-f="title"]', 'Add gutter guards'); await page.click('.panel [data-a="custom"]'); await page.fill('.sheet [data-f="name"]', 'Gutter guards installed'); await page.locator('.sheet [data-f="unit"]').selectOption('lf'); await page.fill('.sheet [data-f="qty"]', '84'); await page.fill('.sheet [data-f="cost"]', '6'); await page.click('.sheet button:has-text("Add")'); await page.click('.panel [data-pact="action"]'); await page.waitForTimeout(300);
  const coLink = await page.evaluate(async () => { const m = await import('./js/document.js'); const p = window.__fullbid.store.activeProject(); return m.buildShareLink(p, window.__fullbid.store.settings, { focusCO: p.changeOrders[1].id }); });
  const cctx = await browser.newContext(ctxOpts); const cp = await cctx.newPage(); watch(cp, 'client'); await cp.goto(coLink, { waitUntil: 'networkidle' }); await cp.waitForSelector('.sheet'); await cp.click('.sheet button:has-text("Open")'); await cp.waitForSelector('.doc .ledger'); await shot(cp, 'v2-20-client-change-order');
  await cp.click('.doc-actions [data-act="approve"]'); await cp.waitForSelector('.sigpad'); await cp.fill('.sheet [data-f="name"]', 'Dana Whitfield'); const s3 = await cp.$('.sigpad'); const b3 = await s3.boundingBox(); await cp.mouse.move(b3.x + 30, b3.y + 70); await cp.mouse.down(); for (let i = 0; i < 18; i++) await cp.mouse.move(b3.x + 30 + i * 12, b3.y + 60 + (i % 5) * 6); await cp.mouse.up(); await cp.click('.sheet button:has-text("Accept & sign")');
  try { await cp.waitForSelector('.sheet:has-text("Send it back")', { timeout: 10000 }); } catch (e) { await shot(cp, 'zz-client-failure'); throw e; } await shot(cp, 'v2-21-client-send-back');
  const resp = await cp.evaluate(async () => { const m = await import('./js/document.js'); const p = window.__fullbid.store.activeProject(); const co = p.changeOrders.find((c) => c.status === 'approved' && c.title === 'Add gutter guards'); return m.buildResponseLink(p, { coApprovals: [{ coId: co.id, n: co.n, signature: co.signature, approvedAt: co.approvedAt }] }); });
  check(resp.length < 40000, 'response link is short enough to text', resp.length); await cctx.close();
  await page.goto(resp, { waitUntil: 'networkidle' }); await page.waitForSelector('.sheet:has-text("Client response received")'); const respTxt = await page.textContent('.sheet'); check(/Change order #2 approved/.test(respTxt), 'contractor copy updated from the client link', respTxt.slice(0, 120)); await shot(page, 'v2-22-response-applied');
  await page.click('.sheet button:has-text("Open the bid")'); st = await S(page); check(st.project.changeOrders[1].status === 'approved' && st.project.changeOrders[1].signature && st.project.changeOrders[1].signature.name === 'Dana Whitfield', 'change order #2 now approved with the client signature');
  // ---------------- I. AI configure-anything (simulated Claude runtime)
  log('I. describe-anything (simulated runtime)');
  const actx = await browser.newContext({ ...ctxOpts, storageState: await ctx.storageState() });
  await actx.addInitScript(() => { const canned = { productName: 'Pella Lifestyle double-hung 36×60', category: 'Windows', unit: 'ea', baseQty: 3, unitPrice: 690, supplierClass: 'windows_doors', parts: [{ name: 'Low-expansion foam', unit: 'can', qty: 2, unitCost: 9, supplierClass: 'building', need: 'required', why: 'Seal the gap' }, { name: 'Flashing tape 4 in', unit: 'roll', qty: 1, unitCost: 22, supplierClass: 'building', need: 'required', why: 'Integrate with WRB' }, { name: 'Interior stool & casing', unit: 'set', qty: 3, unitCost: 55, supplierClass: 'lumber', need: 'recommended', why: 'Old trim cracks' }, { name: 'Window film', unit: 'ea', qty: 3, unitCost: 30, supplierClass: 'windows_doors', need: 'optional', why: 'Glare' }], labor: [{ task: 'Remove sashes & install insert windows', hours: 6, trade: 'carpenter', why: '' }, { task: 'Interior trim', hours: 2.25, trade: 'carpenter', why: '' }], fees: [{ name: 'Window disposal', unit: 'ea', qty: 3, unitCost: 20, need: 'required', why: '' }], notes: ['Measure in three places; order the smallest.'] };
    const sample = async () => ({ text: JSON.stringify(canned), truncated: false }); sample.json = async () => canned; sample.limits = async () => ({ maxPromptBytes: 262144 }); window.claude = { use: async (n) => (n === 'sample' ? sample : null) }; });
  const ap = await actx.newPage(); watch(ap, 'ai'); await ap.goto(BASE + '#/build', { waitUntil: 'networkidle' }); await ap.waitForSelector('[data-ai="1"]'); await ap.click('[data-ai="1"]'); await ap.waitForSelector('.sheet [data-f="d"]'); await ap.fill('.sheet [data-f="d"]', 'Pella Lifestyle double-hung 36x60, replacing three old wood windows'); await ap.fill('.sheet [data-f="q"]', '3'); await ap.click('.sheet button:has-text("List everything it needs")');
  await ap.waitForSelector('.panel .need-line', { timeout: 15000 }); const aiTxt = await ap.textContent('.panel'); check(/Flashing tape/.test(aiTxt) && /Interior trim/.test(aiTxt) && /Window disposal/.test(aiTxt), 'AI-described product lists parts, labor and fees'); await shot(ap, 'v2-23-describe-anything'); await actx.close();
  // ---------------- J. design packages from Contractor Visual Studio
  log('J. CVS design import');
  const fx = (n) => new URL(`./fixtures/cvs-synthetic/${n}.json`, import.meta.url).pathname;
  const jctx = await browser.newContext(ctxOpts); const jp = await jctx.newPage(); watch(jp, 'cvs');
  await jp.goto(BASE, { waitUntil: 'networkidle' }); await jp.waitForSelector('#screen-home .hero');
  const v2 = JSON.parse(fs.readFileSync(fx('bath-neenan'), 'utf8')); v2.version = 2; const v2path = new URL('../docs/screens/zz-v2.json', import.meta.url).pathname; fs.writeFileSync(v2path, JSON.stringify(v2));
  await jp.setInputFiles('#screen-home [data-act="cvs-file"]', v2path); await jp.waitForSelector('.sheet:has-text("Could not import")'); check(/newer version; update Fullbid/.test(await jp.textContent('.sheet')), 'version 2 package refused with the plain message'); await jp.click('.sheet button:has-text("OK")'); fs.unlinkSync(v2path);
  await jp.setInputFiles('#screen-home [data-act="cvs-file"]', fx('bath-neenan')); await jp.waitForSelector('.sheet:has-text("Import a design")');
  const pvTxt = await jp.textContent('.sheet'); check(pvTxt.includes("Import 'Remodel hall, tub to shower' from Neenan: 11 materials, 8 labor items, 1 option. 4 lines use typical sizes."), 'preview sheet shows the counts', pvTxt.slice(0, 200)); await jp.waitForTimeout(450); await shot(jp, 'v3-01-cvs-preview');
  await jp.click('.sheet button:has-text("Import")'); await jp.waitForSelector('#screen-estimate [data-role="cvs-card"]');
  const estTxt = await jp.textContent('#screen-estimate'); check(/Needs a price/.test(estTxt) && /typical size/i.test(estTxt) && !/\$0\.00<\/div>/.test(await jp.innerHTML('#screen-estimate')), 'imported lines show "needs a price" and "typical size", never $0'); await shot(jp, 'v3-02-cvs-bid');
  let jst = await S(jp); check(jst.project.cvs && jst.project.estimate.items.filter((i) => i.origin === 'cvs' && i.cat === 'material').length === 11 && jst.settings.suppliers.some((x) => x.name === 'Neenan'), 'job created with 11 materials and a Neenan supplier');
  await jp.click('#screen-estimate [data-act="preview"]'); await jp.waitForSelector('.doc-actions'); await jp.click('.doc-actions [data-act="share"]'); await jp.waitForSelector('.sheet:has-text("Not ready to send")'); check(true, 'proposal refuses to send while lines need a price'); await jp.waitForTimeout(450); await shot(jp, 'v3-03-not-ready'); await jp.click('.sheet button:has-text("OK")'); await jp.click('.doc-bar [data-act="close"]');
  await jp.click('[data-cvs="price"]'); await jp.waitForSelector('.sheet [data-cvs-id]'); const inputs = await jp.$$('.sheet [data-cvs-id]'); for (const inp of inputs) await inp.fill('12.5'); await jp.click('.sheet button:has-text("Save prices")'); await jp.waitForTimeout(200);
  await jp.click('[data-cvs="accept"]'); await jp.click('.sheet button:has-text("Accept")'); await jp.waitForTimeout(200);
  jst = await S(jp); const r = await jp.evaluate(async () => { const m = await import('./js/cvs/import.js'); return m.sendReadiness(window.__fullbid.store.activeProject()).ok; }); check(r && /ready to send/.test(await jp.textContent('[data-role="cvs-card"]')), 'ready to send once priced and starter rates accepted'); await shot(jp, 'v3-04-cvs-ready');
  await jp.click('[data-cvs="labor"]'); await jp.waitForSelector('.sheet [data-level]'); await jp.click('.sheet [data-trade="tile"][data-level="high"]'); await jp.click('.sheet button:has-text("Done")'); jst = await S(jp); check(jst.project.cvs.laborChoice.tile === 'high', 'labor level per trade');
  const three = JSON.parse(fs.readFileSync(fx('bath-three-options'), 'utf8')); const enc = await jp.evaluate(async (pkg) => { const m = await import('./js/cvs/import.js'); return m.encodeCvsPackage(pkg); }, three);
  await jp.goto(BASE + '#cvs=' + enc, { waitUntil: 'networkidle' }); await jp.waitForSelector('.sheet:has-text("Import a design")'); check(/3 options/.test(await jp.textContent('.sheet')), '#cvs=d: link opens the import preview');
  await jp.click('.sheet button:has-text("Import")'); await jp.waitForSelector('[data-cvs-opt]'); check((await jp.$$('[data-cvs-opt]')).length === 3, 'three options shown as Good / Better / Best'); await shot(jp, 'v3-05-cvs-options');
  await jctx.close();
} catch (e) { console.log('\nE2E-V2 FAILURE:', e.message.split('\n')[0]); fails.push('exception: ' + e.message.split('\n')[0]); try { await page.screenshot({ path: `${OUT}/zz-failure.png` }); } catch {} }
await browser.close();
console.log(`\nchecks failed: ${fails.length}`); fails.forEach((f) => console.log('  -', f));
console.log('page errors:', errors.length); errors.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 300)));
process.exit(fails.length || errors.length ? 1 : 0);

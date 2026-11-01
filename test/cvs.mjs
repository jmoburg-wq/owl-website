// CVS job package import: docs/FULLBID-DIRECTION.md section 10 acceptance checks, plus trade packs and vocabulary.
// Runs against the synthetic stand-ins in test/fixtures/cvs-synthetic/ and, for shape checks, every real fixture
// in test/fixtures/cvs/ (drop the real files there; nothing else to change).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DEFAULTS } from '../js/store.js';
import { importCvsPackage, validatePackage, previewPackage, NEWER_MESSAGE, sendReadiness, acceptStarterPrices, setCvsPrice, addMeasurement, setLaborChoice, cvsTrades, tierMap, encodeCvsPackage, packageFromHash, originAllowed, adoptPendingDesign } from '../js/cvs/import.js';
import { unitFromText, fullbidTrade, classForGroup, packForModule, mergeMeasurement, TRADES as SHARED } from '../js/shared/vocab.js';
import { PACKS, ALL_WORK_ITEMS, ALL_PRODUCTS, WORK_ITEM_ORDER, PRODUCT_ORDER } from '../js/trades/index.js';
import { ASSEMBLIES } from '../js/pricing/catalog.js';
import { SYSTEMS } from '../js/pricing/products.js';
import { TRADES } from '../js/pricing/profile.js';
import { recompute, totals, lineHours, takeoff } from '../js/pricing/estimator.js';
import { tierSummary, applyChoice, variant } from '../js/pricing/tiers.js';
import { groupBySupplier, DEFAULT_SUPPLIERS } from '../js/pricing/suppliers.js';

let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', msg, extra); } };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const load = (dir, f) => JSON.parse(readFileSync(new URL(`./fixtures/${dir}/${f}`, import.meta.url), 'utf8'));
const freshState = () => { const st = structuredClone(DEFAULTS); st.settings.suppliers = structuredClone(DEFAULT_SUPPLIERS); return st; };
const importNew = (pkg, st = freshState()) => { const plan = importCvsPackage(structuredClone(pkg), st); if (!plan.ok) throw new Error(plan.error); const r = plan.apply(st); return { st, plan, p: r.project }; };
const mats = (p) => p.estimate.items.filter((i) => i.origin === 'cvs' && i.cat === 'material');
const labs = (p) => p.estimate.items.filter((i) => i.origin === 'cvs' && i.cat === 'labor');
const supName = (st, id) => (st.settings.suppliers.find((s) => s.id === id) || {}).name;

// ---------------- trade packs and vocabulary (step 1)
ok(PACKS.length === 14, 'fourteen trade packs', PACKS.length);
ok(ALL_WORK_ITEMS.length === 48 && ASSEMBLIES.length === 48, 'all 48 work items come from packs');
ok(ALL_PRODUCTS.length === 25 && SYSTEMS.length === 25, 'all 25 products come from packs');
ok(ASSEMBLIES.map((a) => a.key).join() === WORK_ITEM_ORDER.join(), 'work item order unchanged');
ok(SYSTEMS.map((s) => s.key).join() === PRODUCT_ORDER.join(), 'product order unchanged');
ok(PACKS.every((p) => p.meta.id && p.meta.name && Array.isArray(p.meta.sequence)), 'every pack has id, name and sequence');
ok(ALL_WORK_ITEMS.every((w) => w.pack), 'every work item knows its pack');
for (const id of ['demo', 'finish_carpentry', 'glass', 'cleanup', 'marine', 'fencing', 'landscaping']) ok(TRADES[id] && TRADES[id].rate > 0, `labor trade ${id} added`);
ok(Object.values(SHARED).every((t) => TRADES[t.fullbid]), 'every shared trade maps to a Fullbid labor trade');
ok(fullbidTrade('plumbing') === 'plumber' && fullbidTrade('finish carpentry') === 'finish_carpentry' && fullbidTrade('paint') === 'painter', 'CVS trade ids map');
ok(unitFromText('bags (50 lb)') === 'bag' && unitFromText('sheets (3 × 5 ft)') === 'sheet' && unitFromText('tubes (10.1 oz)') === 'tube' && unitFromText('pieces') === 'piece' && unitFromText('sq ft') === 'sq ft' && unitFromText('each') === 'ea', 'unit text → canonical by first word');
ok(classForGroup('Lumber and framing') === 'lumber' && classForGroup('Plumbing rough-in') === 'plumbing' && classForGroup('Waterproofing and setting materials') === 'flooring' && classForGroup('Paint and finishing') === 'paint' && classForGroup('Electrical') === 'electrical' && classForGroup('Drywall') === 'building', 'CVS groups → material classes');
ok(packForModule('shower') === 'bath' && packForModule('some_new_module') === 'general' && packForModule('exterior', 'Gutters') === 'gutters' && packForModule('driveway', 'asphalt') === 'asphalt' && packForModule('driveway', 'concrete') === 'concrete', 'module → pack, unknown → general');
{ const list = [{ kind: 'roof_area', value: 2400, source: 'report' }]; const r1 = mergeMeasurement(list, { kind: 'roof_area', value: 2300, source: 'satellite' }); ok(r1.action === 'kept' && list[0].value === 2400, 'lower-ranked number never overwrites'); const r2 = mergeMeasurement(list, { kind: 'roof_area', value: 2420, source: 'measured' }); ok(r2.action === 'kept', 'equal rank never overwrites silently'); const l2 = [{ kind: 'x', value: 1, source: 'typical' }]; ok(mergeMeasurement(l2, { kind: 'x', value: 2, source: 'measured' }).action === 'replaced' && l2[0].value === 2, 'higher rank wins'); }
{ const packDir = new URL('../js/trades/', import.meta.url); const bad = readdirSync(packDir).filter((d) => existsSync(new URL(`${d}/pack.js`, packDir))).filter((d) => /required by code|code requires/i.test(readFileSync(new URL(`${d}/pack.js`, packDir), 'utf8'))); ok(bad.length === 0, 'no "required by code" claims in any pack', bad.join()); }

// ---------------- validation
const bath = load('cvs-synthetic', 'bath-neenan.json'), roof = load('cvs-synthetic', 'roofing-report.json'), three = load('cvs-synthetic', 'bath-three-options.json');
ok(importCvsPackage({ ...bath, version: 2 }, freshState()).error === NEWER_MESSAGE, 'version 2 refused with the plain message');
ok(!importCvsPackage({ hello: 1 }, freshState()).ok, 'non-package refused');
ok(validatePackage(bath).ok && bath.futureField, 'unknown fields are ignored');
{ const odd = structuredClone(bath); odd.source.module = 'treehouse'; odd.design.id = 'odd'; const { p } = importNew(odd); ok(p.cvs.pack === 'general' && mats(p).length === 11, 'unknown module imports into the general pack'); }

// ---------------- preview
{ const pv = previewPackage(bath); ok(pv.materials === 11 && pv.labor === 8 && pv.options === 1 && pv.typical === 4, 'preview counts', JSON.stringify(pv));
  ok(pv.text === "Import 'Remodel hall, tub to shower' from Neenan: 11 materials, 8 labor items, 1 option. 4 lines use typical sizes.", 'preview text', pv.text); ok(pv.pack === 'bath', 'shower module → bath pack'); }

// ---------------- materials one for one; suppliers (section 3.4)
{ const { st, p } = importNew(bath); const m = mats(p); const src = bath.options[0].materials;
  ok(m.length === src.length, 'one line per fixture material', m.length);
  ok(src.every((r, i) => m[i].item === r.item && m[i].finish === (r.finish || '') && m[i].qty === r.qty && m[i].unitText === r.unit && m[i].name === r.item + (r.finish ? `, ${r.finish}` : '')), 'item, finish, qty and unit match one for one');
  const byItem = (s) => m.find((x) => x.item === s);
  ok(supName(st, byItem('Shower base 60 × 32 in').supplierId) === 'Neenan' && supName(st, byItem('Framed glass door').supplierId) === 'Neenan', 'fixture and glass lines on a "Neenan" supplier');
  ok(supName(st, byItem('Panel adhesive').supplierId) === 'The Home Depot' && supName(st, byItem('Moisture-resistant drywall').supplierId) === 'The Home Depot', 'setting materials on the preferred home center');
  ok(byItem('2×4 stud, 8 ft').supplierId === 'homedepot', 'home-center lumber goes to a home center even when lumber is preferred from the yard');
  const haul = byItem('Haul-away and disposal'); ok(haul.noOrder && !haul.supplierId, 'haul-away is a contractor line with no order');
  ok(!groupBySupplier(p.estimate.items, st.settings).some((g) => g.lines.includes(haul)), 'contractor lines never appear on a material order');
  ok(st.settings.suppliers.filter((s) => s.name === 'Neenan').length === 1, 'one Neenan supplier record created');
  const again = structuredClone(bath); again.design.id = 'other'; importNew(again, st); ok(st.settings.suppliers.filter((s) => s.name === 'Neenan').length === 1, 'existing supplier matched by company name');
  ok(p.cvs.conceptNotice === bath.company.conceptNotice, 'concept notice kept exactly');
  ok(p.client.name === 'Pat Sample' && p.name === 'Remodel hall, tub to shower', 'client and job name from the package');
  ok(byItem('Panel adhesive').unit === 'tube' && byItem('Panel adhesive').note.startsWith('About one tube'), 'unit id for math; how → note');
  ok(byItem('Shower base 60 × 32 in').designItem && !byItem('Panel adhesive').designItem, 'design items flagged');
}

// ---------------- labor: mid by default, low/high, sub replaces hours
{ const { st, p } = importNew(bath); const src = bath.options[0].labor;
  const mid = src.reduce((s, l) => s + ((l.hours[0] + l.hours[1]) / 2) * (l.units || 1), 0);
  const hrs = () => labs(p).reduce((s, l) => s + lineHours(l), 0);
  ok(near(hrs(), mid), 'labor hours at mid = sum of midpoints × units', `${hrs()} vs ${mid}`);
  ok(labs(p).find((l) => l.cvsTrade === 'plumbing').ltrade === 'plumber', 'labor lines use the Fullbid trade');
  setLaborChoice(p, 'tile', 'high', st.settings); ok(near(hrs(), mid - 8 + 10), 'tile at high', hrs());
  const tileMid = 8; setLaborChoice(p, 'tile', 'mid', st.settings);
  setLaborChoice(p, 'glass', { sub: 650, name: 'Clear Glass Co' }, st.settings);
  const glassMid = 2.5; ok(near(hrs(), mid - glassMid), 'switching glass to a sub removes its hours', hrs());
  const sub = labs(p).find((l) => l.sub); ok(sub && sub.unitCost === 650 && sub.evidence === 'E4' && sub.unit === 'job', 'sub lump sum line at E4');
  ok(cvsTrades(p).length === 8 && tileMid === 8, 'eight trades listed');
  const rf = importNew(roof).p; const rmid = (1.0 * 24.5) + (1.75 * 24.5); ok(near(labs(rf).reduce((s, l) => s + lineHours(l), 0), rmid), 'units multiply hours (roofing per square)');
}

// ---------------- prices: null → needs a price, never $0; send gate
{ const { st, p } = importNew(bath);
  ok(mats(p).every((l) => l.unitCost === null && l.priceSource === 'needs a price'), 'every imported material with price:null needs a price');
  let r = sendReadiness(p); ok(!r.ok && r.unpriced.length === 11, 'proposal refuses to send with unpriced lines', r.message);
  ok(r.starter.length === 8, 'starter labor rates need accepting', r.starter.length);
  for (const l of mats(p)) setCvsPrice(p, l.cvsId, 10);
  r = sendReadiness(p); ok(!r.ok && !r.unpriced.length && r.starter.length === 8, 'still blocked by unaccepted starter rates');
  acceptStarterPrices(p); r = sendReadiness(p); ok(r.ok, 'ready once every line is priced or accepted', r.message);
  ok(mats(p).every((l) => l.evidence === 'E2'), 'typed prices are E2');
  const own = freshState(); own.settings.profile.useOwnRates = true; const p2 = importNew(bath, own).p; ok(labs(p2).every((l) => l.evidence === 'E2'), 'own labor rates are E2 and need no acceptance');
  const pl = freshState(); pl.settings.priceList = [{ supplierId: 'homedepot', name: 'Panel adhesive tube', price: 7.48, sku: '', updatedAt: '2026-10-01' }];
  const p3 = importNew(bath, pl).p; const adh = mats(p3).find((l) => l.item === 'Panel adhesive'); ok(adh.unitCost === 7.48 && adh.evidence === 'E3', 'a supplier price list fills a line at E3', JSON.stringify([adh.unitCost, adh.evidence]));
  recompute(p, st.settings); ok(mats(p).length === 11, 'recompute keeps imported lines');
}

// ---------------- typical sizes → recompute
{ const { p } = importNew(bath); const typ = mats(p).filter((l) => l.typical); ok(typ.length === 4, 'typical lines flagged');
  ok(p.measurements.find((m) => m.kind === 'bath.showerW').source === 'typical', 'package measurements stored with their source');
  const r = addMeasurement(p, { kind: 'bath.showerW', value: 59.5, unit: 'in', source: 'measured' });
  ok(r.action === 'replaced' && mats(p).filter((l) => l.recompute).length === 4 && p.cvs.recompute.kinds.includes('bath.showerW'), 'measured bath.showerW marks typical lines for recompute'); }

// ---------------- roofing: pack and ranked measurements
{ const st = freshState(); const pre = importNew({ ...structuredClone(roof), design: { ...roof.design, id: 'tmp' } }, st);
  const plan = importCvsPackage(structuredClone(roof), st); const p0 = plan.apply(st, { newProject: () => { const x = structuredClone(pre.p); x.cvs = null; x.id = 'r2'; x.measurements = [{ kind: 'roof_area', value: 2300, source: 'satellite' }, { kind: 'eaves', value: 125, source: 'measured' }]; x.estimate.items = []; st.projects.unshift(x); return x; } }).project;
  ok(p0.cvs.pack === 'roofing', 'roofing fixture lands in the roofing pack');
  ok(p0.measurements.find((m) => m.kind === 'roof_area').value === 2450 && p0.measurements.find((m) => m.kind === 'roof_area').source === 'report', 'report-sourced measurement replaces a lower-ranked one');
  ok(p0.measurements.find((m) => m.kind === 'eaves').value === 125, 'an on-site measurement is not silently overwritten by the report');
  addMeasurement(p0, { kind: 'roof_area', value: 2200, source: 'satellite' }); ok(p0.measurements.find((m) => m.kind === 'roof_area').value === 2450, 'report kept above a later satellite number');
  p0.estimate.assemblies = [{ key: 'roof_shingles', opts: {} }]; p0.rooms = []; ok(!takeoff(p0, st.settings).length, "CVS lines replace the roofing pack's own calculator"); }

// ---------------- three options → Good / Better / Best
{ const { st, p } = importNew(three); const t = p.estimate.tiers;
  ok(t.on && t.cvsOptions.good === 'o-good' && t.cvsOptions.better === 'o-better' && t.cvsOptions.best === 'o-best', 'three options → Good / Better / Best');
  ok(t.names.best === 'Cast stone panels', 'tier names from the options');
  ok(p.cvs.activeOption === 'o-better' && mats(p).some((l) => l.name === 'Textured wall panel kit, White'), 'Better is shown first');
  for (const l of mats(p)) setCvsPrice(p, l.cvsId, 100); acceptStarterPrices(p);
  const sum = tierSummary(p, st.settings); ok(sum.length === 3 && sum[2].total > sum[0].total, 'tiers priced from their own lines', sum.map((x) => Math.round(x.total)).join('/'));
  ok(sendReadiness(p).ok, 'a price typed once fills the same material in every option');
  const v = variant(p, st.settings, 'best'); ok(v.est.items.some((l) => l.name === 'Cast stone panel kit, White'), 'best variant swaps lines');
  ok(p.estimate.items.some((l) => l.name === 'Textured wall panel kit, White'), 'variant leaves the real estimate alone');
  applyChoice(p, st.settings, 'best'); ok(p.cvs.activeOption === 'o-best' && mats(p).some((l) => l.name.startsWith('Cast stone')), 'client choice bakes in the option');
  ok(tierMap([{ id: 'a' }]).better === 'a' && tierMap([{ id: 'a' }, { id: 'b' }]).good === 'a', 'tier map by order'); }

// ---------------- re-import: before and after signing
const changed = () => { const n = structuredClone(bath); const m = n.options[0].materials; m.find((x) => x.item === 'Shower valve trim').finish = 'Matte black'; m.find((x) => x.item === 'Panel adhesive').qty = 8; return n; };
{ const { st, p } = importNew(bath); for (const l of mats(p)) setCvsPrice(p, l.cvsId, 20);
  const edited = p.estimate.items.find((l) => l.item === 'Silicone sealant'); edited.locked = true; edited.qty = 5;
  const plan = importCvsPackage(changed(), st);
  ok(plan.mode === 'update' && plan.diff.length === 2, 'same fixture with one finish and one quantity changed shows exactly two differences', JSON.stringify(plan.diff.map((d) => d.type)));
  ok(plan.diff.some((d) => d.type === 'finish' && d.to === 'Matte black') && plan.diff.some((d) => d.type === 'qty' && d.from === 6 && d.to === 8), 'the differences are the finish and the quantity');
  plan.apply(st);
  ok(mats(p).find((l) => l.item === 'Shower valve trim').finish === 'Matte black' && mats(p).find((l) => l.item === 'Panel adhesive').qty === 8, 'before signing the changes apply');
  ok(mats(p).find((l) => l.item === 'Silicone sealant').qty === 5, "the contractor's edit is kept");
  ok(mats(p).find((l) => l.item === 'Panel adhesive').unitCost === 20, 'prices survive re-import');
  ok(st.projects.filter((x) => x.cvs && x.cvs.designId === bath.design.id).length === 1, 're-import updates the job instead of making a new one'); }
{ const { st, p } = importNew(bath); for (const l of mats(p)) setCvsPrice(p, l.cvsId, 20); acceptStarterPrices(p);
  p.estimate.signature = { name: 'Pat', at: new Date().toISOString() }; p.estimate.signedTotal = totals(p.estimate).total;
  const plan = importCvsPackage(changed(), st); ok(plan.mode === 'change-order', 'after signing, re-import makes a change order');
  const { changeOrder: co } = plan.apply(st);
  ok(co.items.length === 2 && co.status === 'draft', 'change order draft with those two lines', co.items.map((i) => i.name).join(' | '));
  const qty = co.items.find((i) => /quantity/.test(i.name)); ok(qty && qty.qty === 2 && qty.unitCost === 20, 'quantity change priced the same way');
  ok(co.items.some((i) => /^Swap: Brushed nickel → Matte black/.test(i.name)), 'finish change is a swap line');
  ok(mats(p).find((l) => l.item === 'Shower valve trim').finish === 'Brushed nickel', 'signed design stays the contract until the change is approved');
  ok(adoptPendingDesign(p, st.settings) && mats(p).find((l) => l.item === 'Shower valve trim').finish === 'Matte black', 'approved change adopts the new design');
}
{ const { st, p } = importNew(bath); for (const l of mats(p)) setCvsPrice(p, l.cvsId, 20); p.estimate.signature = { name: 'x' };
  const rem = structuredClone(bath); rem.options[0].materials = rem.options[0].materials.filter((m) => m.item !== 'Floor protection'); rem.options[0].materials.push({ ...rem.options[0].materials[0], id: 'm99', item: 'Grab bar', finish: 'Brushed nickel' });
  const { changeOrder: co } = importCvsPackage(rem, st).apply(st);
  ok(co.items.some((i) => i.name.startsWith('Credit: Floor protection') && i.qty < 0) && co.items.some((i) => i.name.startsWith('Grab bar')), 'removed lines are credits, added lines are charges'); }

// ---------------- transport
{ const enc = await encodeCvsPackage(bath); ok(enc.startsWith('d:'), 'link encoding matches share links');
  const r = await packageFromHash(`#cvs=${enc}`, DEFAULTS.settings); ok(r.obj && r.obj.design.id === bath.design.id, '#cvs=d: round-trips');
  ok(originAllowed('https://rrg-studio.vercel.app/api/package/1', DEFAULTS.settings) && !originAllowed('https://evil.example.com/p.json', DEFAULTS.settings) && !originAllowed('http://rrg-studio.vercel.app/x', DEFAULTS.settings), 'cvs-url allow-list');
  const bad = await packageFromHash('#cvs-url=' + encodeURIComponent('https://evil.example.com/p.json'), DEFAULTS.settings, () => { throw new Error('should not fetch'); }); ok(bad.error, 'non-listed origins are refused without fetching');
  const good = await packageFromHash('#cvs-url=' + encodeURIComponent('https://rrg-studio.vercel.app/p.json'), DEFAULTS.settings, async () => ({ ok: true, json: async () => bath })); ok(good.obj && good.obj.schema === 'cvs.job-package', 'allow-listed origin fetched'); }

// ---------------- real fixtures (test/fixtures/cvs/*.json), when present
const realDir = new URL('./fixtures/cvs/', import.meta.url); const real = existsSync(realDir) ? readdirSync(realDir).filter((f) => f.endsWith('.json')) : [];
for (const f of real) {
  const pkg = load('cvs', f); const pv = previewPackage(pkg); const { p } = importNew(pkg);
  const src = pkg.options.find((o) => o.id === p.cvs.activeOption).materials;
  ok(mats(p).length === src.length && src.every((r, i) => mats(p)[i].item === String(r.item) && mats(p)[i].qty === (Number(r.qty) || 0)), `real fixture ${f}: lines match one for one`);
  ok(pv.materials > 0 && pv.options === pkg.options.length, `real fixture ${f}: preview counts`);
  ok(mats(p).every((l) => l.unitCost !== 0 || l.evidence), `real fixture ${f}: nothing shows $0 without evidence`);
}

console.log(`cvs tests: ${pass} passed, ${fail} failed${real.length ? ` (${real.length} real fixture${real.length === 1 ? '' : 's'})` : ' (real fixtures not present yet; synthetic stand-ins used)'}`);
if (fail) process.exit(1);

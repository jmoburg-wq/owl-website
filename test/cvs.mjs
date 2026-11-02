// CVS job package import: docs/FULLBID-DIRECTION.md section 10 acceptance checks, plus trade packs and vocabulary.
// Runs against the real CVS exports in test/fixtures/cvs/ (the numbers in FULLBID-DIRECTION addenda 1 and 2) and the
// labeled synthetic stand-ins in test/fixtures/cvs-synthetic/ for edge cases; every real file also gets a shape check.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DEFAULTS } from '../js/store.js';
import { importCvsPackage, validatePackage, previewPackage, NEWER_MESSAGE, sendReadiness, acceptStarterPrices, setCvsPrice, addMeasurement, setLaborChoice, cvsTrades, tierMap, encodeCvsPackage, packageFromHash, originAllowed, adoptPendingDesign, optionPrices, setPriceLaborSeparately, discountFromNotes, cvsOrigins, setActiveOption } from '../js/cvs/import.js';
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
{ const packDir = new URL('../js/trades/', import.meta.url); const bad = readdirSync(packDir).filter((d) => existsSync(new URL(`${d}/pack.js`, packDir))).filter((d) => /required by code|code requires|code needs|commonly required|drip leg|require[sd]? (a |the )?permit|\bis required\b|\bRequired (in|over|within|where|for)\b/i.test(readFileSync(new URL(`${d}/pack.js`, packDir), 'utf8'))); ok(bad.length === 0, 'no code-requirement claims in any pack (addendum 1, section 4)', bad.join());
  const all = readdirSync(packDir).filter((d) => existsSync(new URL(`${d}/pack.js`, packDir))).map((d) => readFileSync(new URL(`${d}/pack.js`, packDir), 'utf8')).join('\n');
  ok(all.includes("Use the connectors the maker\\'s instructions call for.") && all.includes('A sediment trap keeps debris out of the gas valve.'), "notes say what the maker's instructions call for, or what the part does"); }

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

// ---------------- real fixtures: the section 10 checks with the numbers in addendum 1, section 3
const allLines = (p) => [...p.estimate.items.filter((i) => i.origin !== 'cvs' && i.origin !== 'pack'), ...Object.values(p.estimate.cvsLines || {}).flat()];
const packLines = (p) => Object.values(p.estimate.cvsLines || {}).flat().filter((i) => i.origin === 'pack');
const midHours = (o, level = 'mid') => o.labor.reduce((s, l) => s + (level === 'low' ? l.hours[0] : level === 'high' ? l.hours[1] : (l.hours[0] + l.hours[1]) / 2) * (l.units || 1), 0);
const hrsOf = (p) => labs(p).reduce((s, l) => s + lineHours(l), 0);
const hall = load('cvs', 'cvs-shower-neenan-hall.json'), ferg = load('cvs', 'cvs-bathroom-ferguson-luxury.json'), roofReal = load('cvs', 'cvs-roof-timbercrest.json');
const ferg2 = load('cvs', 'cvs-bathroom-ferguson-luxury-v2.json'), n3 = load('cvs', 'cvs-shower-neenan-3options.json'), roofBid = load('cvs', 'cvs-roof-bid-timbercrest-3options.json');

{ // cvs-shower-neenan-hall.json
  const { st, p, plan } = importNew(hall); const m = mats(p);
  ok(m.length === 29, 'hall: 29 materials', m.length);
  const onNeenan = m.filter((l) => supName(st, l.supplierId) === 'Neenan').map((l) => l.item);
  ok(onNeenan.length === 6 && ['Shower valve trim', 'Shower head', 'Hand shower on a slide bar', 'Shower door or glass panel', 'Shower drain for the base', 'Rough-in valve'].every((x) => onNeenan.includes(x)), 'hall: 6 on Neenan (valve trim, head, hand shower, glass, drain, rough-in valve)', onNeenan.join(' | '));
  const haul = m.find((l) => l.item === 'Debris haul-away'); ok(haul && haul.noOrder && !haul.supplierId && !groupBySupplier(p.estimate.items, st.settings).some((g) => g.lines.includes(haul)), 'hall: debris haul-away has no supplier and no order');
  const rest = m.filter((l) => !onNeenan.includes(l.item) && l !== haul); ok(rest.length === 22 && rest.every((l) => l.supplierId === 'homedepot'), 'hall: the rest go to the preferred home center', rest.length);
  ok(labs(p).length === 8 && near(hrsOf(p), 65.5), 'hall: 8 labor lines, mid total 65.5 hr', hrsOf(p));
  ok(midHours(hall.options[0], 'low') === 47 && midHours(hall.options[0], 'high') === 84, 'hall: fixture low 47, high 84');
  for (const t of cvsTrades(p)) setLaborChoice(p, t, 'low', st.settings); ok(near(hrsOf(p), 47), 'hall: low total 47 hr', hrsOf(p));
  for (const t of cvsTrades(p)) setLaborChoice(p, t, 'high', st.settings); ok(near(hrsOf(p), 84), 'hall: high total 84 hr', hrsOf(p));
  ok(m.filter((l) => l.typical).length === 11 && plan.preview.typical === 11, 'hall: 11 lines show "typical size"');
  const r = addMeasurement(p, { kind: 'bath.showerW', value: 59.75, unit: 'in', source: 'measured' }); ok(r.marked === 11 && mats(p).filter((l) => l.recompute).length === 11, 'hall: a measured bath.showerW marks them for recompute', r.marked);
  ok(!packLines(p).length, 'hall: carries labor, so no pack labor is added');
  ok(!plan.createsSupplier || st.settings.suppliers.find((x) => x.name === 'Neenan').cvsCompanyId === 'neenan', 'hall: the Neenan record keeps company.id');
}
{ // cvs-bathroom-ferguson-luxury.json
  const { st, p } = importNew(ferg); const m = mats(p);
  ok(m.length === 69 && m.filter((l) => supName(st, l.supplierId) === 'Ferguson Home').length === 24, 'ferguson: 69 materials, 24 on "Ferguson Home"');
  ok(labs(p).length === 20 && near(hrsOf(p), 263.5), 'ferguson: 20 labor lines, mid total 263.5 hr', hrsOf(p));
  const ms = (k) => p.measurements.find((x) => x.kind === k);
  ok(ms('bath.roomL').source === 'photo' && ms('bath.roomW').source === 'photo' && ms('bath.ceilingIn').source === 'typed' && ms('bath.ceilingIn').value === 108, 'ferguson: photo (room size) and typed (ceiling) measurements kept');
  const r = addMeasurement(p, { kind: 'bath.roomL', value: 13.5, unit: 'ft', source: 'measured' }); ok(r.action === 'replaced' && ms('bath.roomL').value === 13.5 && ms('bath.roomL').source === 'measured' && ms('bath.roomW').source === 'photo', 'ferguson: a measured room length replaces the photo one');
  ok(!packLines(p).length, 'ferguson: carries labor, so no pack labor is added');
}
{ // cvs-roof-timbercrest.json: a contractor's own package (addendum 1, sections 1 and 2)
  const st = freshState(); const plan = importCvsPackage(structuredClone(roofReal), st); const p = plan.apply(st).project; const m = mats(p);
  ok(!plan.createsSupplier && !st.settings.suppliers.some((x) => /timbercrest/i.test(x.name)), 'roof: no supplier named after the contractor');
  ok(m.length === 16 && m.every((l) => l.supplierId === 'abc' && l.confirmSupplier), 'roof: 16 lines on the preferred roofing supplier (ABC Supply by default), marked "Confirm supplier"');
  ok(groupBySupplier(p.estimate.items, st.settings).length === 1 && groupBySupplier(p.estimate.items, st.settings)[0].lines.length === 16, 'roof: one order, to that supplier');
  const own = freshState(); own.settings.suppliers.push({ id: 'beacon', name: 'Beacon Building Products', short: 'Beacon', classes: ['roofing'], factor: 1, delivery: 0 }); own.settings.supplierPrefs = { roofing: 'beacon' };
  const p2 = importNew(roofReal, own).p; ok(mats(p2).every((l) => l.supplierId === 'beacon' && !l.confirmSupplier), "roof: the contractor's preferred roofing supplier from Suppliers takes the lines, no confirmation");
  ok(p.measurements.length === 8 && p.measurements.every((x) => ['report', 'measured'].includes(x.source)), 'roof: 8 measurements from report and measured');
  for (const k of ['roof_area', 'eaves', 'gutters']) addMeasurement(p, { kind: k, value: 1, unit: '', source: 'satellite' });
  ok(p.measurements.find((x) => x.kind === 'roof_area').value === 2430 && p.measurements.find((x) => x.kind === 'eaves').value === 142 && p.measurements.find((x) => x.kind === 'gutters').value === 142, 'roof: a lower-ranked number does not replace them');
  const pl = p.estimate.items.filter((i) => i.origin === 'pack'); const plab = pl.filter((i) => i.cat === 'labor'); const roofHrs = plab.filter((i) => i.pack === 'roofing').reduce((s, l) => s + lineHours(l), 0);
  ok(roofHrs > 0 && plab.every((l) => l.ltrade === 'roofer' && l.unit === 'hr' && l.unitCost > 0), 'roof: roofing labor greater than 0, tagged pack', roofHrs);
  ok(plan.preview.needs.some((n) => n.kind === 'roof_pitch') && p.cvs.needs.some((n) => n.kind === 'roof_pitch'), 'roof: asks for the roof pitch');
  const ready = sendReadiness(p); ok(!ready.ok && ready.waiting.length === 1 && ready.needs.join() === 'roof_pitch' && /waits on the roof pitch/.test(ready.message), 'roof: the bid waits on the pitch rather than assuming one', ready.message);
  ok(pl.some((l) => l.cat === 'fee' && /dumpster/i.test(l.name) && l.evidence === 'E0') && pl.some((l) => l.cat === 'fee' && /permit/i.test(l.name)), 'roof: usual fees (dumpster, permit) added at starter prices');
  ok(pl.some((l) => l.pack === 'gutters' && l.cat === 'labor' && l.hours > 0), 'roof: gutter hanging hours from the measured gutters');
  const before = hrsOfPack(p); addMeasurement(p, { kind: 'roof_pitch', value: 9, unit: 'x/12', source: 'measured' }, st.settings);
  ok(hrsOfPack(p) > before && sendReadiness(p).waiting.length === 0 && !p.cvs.needs.length, 'roof: entering a steep pitch re-works the install hours', `${before} → ${hrsOfPack(p)}`);
  ok(plab.every((l) => l.evidence === 'E0'), 'roof: pack labor at starter rates (E0) until accepted');
  for (const l of mats(p)) setCvsPrice(p, l.cvsId, 10); acceptStarterPrices(p); ok(sendReadiness(p).ok, 'roof: ready once priced, accepted and measured');
  const again = importCvsPackage(structuredClone(roofReal), st); ok(again.mode === 'update' && again.diff.length === 0 && !again.createsSupplier, 'roof: re-import of the same file shows no differences');
}
function hrsOfPack(p) { return p.estimate.items.filter((i) => i.origin === 'pack' && i.cat === 'labor').reduce((s, l) => s + lineHours(l), 0); }

{ // supplier records match by company.id first, then by name
  const st = freshState(); st.settings.suppliers.push({ id: 'showroom', name: 'Neenan Company showroom', short: 'Neenan showroom', classes: [], cvsCompanyId: 'neenan', factor: 1, delivery: 0 }, { id: 'other', name: 'Neenan', short: 'Neenan', classes: [], factor: 1, delivery: 0 });
  const { p, plan } = importNew(hall, st); ok(!plan.createsSupplier && mats(p).filter((l) => l.supplierId === 'showroom').length === 6, 'company.id matches a supplier record before its name');
}

// diff against real files: Neenan glass finish and tile quantity (addendum 1, section 3), stable ids (addendum 2, section 3)
const hallChanged = () => { const n = structuredClone(hall); const m = n.options[0].materials; m.find((x) => x.id === 'glass.glass').finish = 'Matte black'; m.find((x) => x.id === 'walls.wall-tile').qty = 90; return n; };
{ const { st, p } = importNew(hall); for (const l of mats(p)) setCvsPrice(p, l.cvsId, 20);
  const plan = importCvsPackage(hallChanged(), st);
  ok(plan.mode === 'update' && plan.diff.length === 2 && plan.diff.some((d) => d.type === 'finish' && d.id === 'glass.glass' && d.to === 'Matte black') && plan.diff.some((d) => d.type === 'qty' && d.id === 'walls.wall-tile' && d.from === 82 && d.to === 90), 'hall: glass finish and tile quantity changed → exactly those two differences', JSON.stringify(plan.diff.map((d) => [d.type, d.id]))); }
{ const { st, p } = importNew(hall); for (const l of mats(p)) setCvsPrice(p, l.cvsId, 20); acceptStarterPrices(p); p.estimate.signature = { name: 'Client' };
  const { changeOrder: co } = importCvsPackage(hallChanged(), st).apply(st);
  ok(co.items.length === 2 && co.items.some((i) => /^Swap: Polished Chrome → Matte black/.test(i.name)) && co.items.some((i) => /quantity 82 → 90/.test(i.name) && i.qty === 8), 'hall: after signing, the same change makes a change order with two lines', co.items.map((i) => i.name).join(' | ')); }
{ // an older export whose fixture ids carry a counter still pairs line for line
  const { st } = importNew(hall); const n = structuredClone(hall); const sh = n.options[0].materials.find((x) => x.id === 'fixtures.shower-head-2'); sh.id = 'fixtures.shower-head-5'; sh.finish = 'Brushed nickel';
  const plan = importCvsPackage(n, st); ok(plan.diff.length === 1 && plan.diff[0].type === 'finish', 'counter ids: a renumbered line is paired, not removed and re-added', JSON.stringify(plan.diff.map((d) => d.type))); }

{ // cvs-shower-neenan-3options.json: Good / Better / Best with stable ids
  const { st, p, plan } = importNew(n3); const t = p.estimate.tiers;
  ok(plan.preview.options === 3 && t.on && t.cvsOptions.good === 'opt-builder-primary-panels' && t.cvsOptions.better === 'opt-builder-primary-tile' && t.cvsOptions.best === 'opt-builder-primary-walk-in', 'neenan 3 options: imported as Good / Better / Best');
  ok(p.cvs.activeOption === 'opt-builder-primary-tile' && mats(p).length === 28, 'neenan 3 options: Better shown first');
  ok(n3.options.every((o) => o.materials.every((m) => !/^(fixtures|body-sprays)\..*-\d+$/.test(m.id))) && hall.options[0].materials.some((m) => /^fixtures\..*-\d+$/.test(m.id)), 'neenan 3 options: fixture ids carry no counter (the older hall export did)');
  ok(Object.values(p.estimate.cvsLines).flat().filter((l) => l.cat === 'material').every((l) => l.cvsOption && l.key === `cvs|${l.cvsOption}|m|${l.cvsId}`), 'neenan 3 options: every line keyed by option and stable id');
  ok(!packLines(p).length, 'neenan 3 options: carries labor, no pack labor');
  const again = importCvsPackage(structuredClone(n3), st); ok(again.diff.length === 0, 'neenan 3 options: re-import of the same export shows no differences');
  const one = structuredClone(n3); one.options[1].materials.find((m) => m.id === 'fixtures.shower-head').finish = 'Polished nickel';
  const plan2 = importCvsPackage(one, st); ok(plan2.diff.length === 1 && plan2.diff[0].id === 'fixtures.shower-head' && plan2.diff[0].optionId === 'opt-builder-primary-tile' && plan2.diff[0].to === 'Polished nickel', 'neenan 3 options: one finish changed → exactly one difference', JSON.stringify(plan2.diff));
  plan2.apply(st); ok(mats(p).find((l) => l.cvsId === 'fixtures.shower-head').finish === 'Polished nickel' && mats(p).find((l) => l.cvsId === 'fixtures.shower-head').unitCost === null, 'neenan 3 options: the change applies before signing');
}
{ // cvs-bathroom-ferguson-luxury-v2.json: current exporter, stable ids, concept notice
  const { st, p } = importNew(ferg2); ok(mats(p).length === 69 && labs(p).length === 20 && near(hrsOf(p), midHours(ferg2.options[0])) && near(hrsOf(p), 253.25), 'ferguson v2: 69 materials, 20 labor lines, mid 253.25 hr', hrsOf(p));
  ok(p.cvs.conceptNotice === ferg2.company.conceptNotice && st.settings.suppliers.filter((x) => x.cvsCompanyId === 'fergusonhome').length === 1, 'ferguson v2: concept notice kept, one supplier record by company.id');
  ok(importCvsPackage(structuredClone(ferg2), st).diff.length === 0, 'ferguson v2: re-import shows no differences');
  // bath packages may carry prices: E1 from the company's price book, E3 seen online (addendum 2, section 2)
  const priced = structuredClone(ferg2); priced.design.id = 'priced-copy'; const o = priced.options[0];
  const sup = o.materials.find((m) => m.from === 'supplier'); sup.price = { unit: 389, per: 'ea', tier: 'E1', source: "Ferguson Home's price book", seenOn: null }; sup.unit = 'each';
  const hc = o.materials.find((m) => m.from === 'home-center'); hc.from = 'online'; hc.price = { unit: 24.99, per: unitFromText(hc.unit), tier: 'E3', source: 'seen on Amazon', seenOn: '2026-10-30' };
  const odd = o.materials.find((m) => m.from === 'home-center' && m !== hc && unitFromText(m.unit) !== 'sq ft'); odd.price = { unit: 3, per: 'sq ft', tier: 'E1', source: "Ferguson Home's price book", seenOn: null };
  const pp = importNew(priced, st).p; const L = (id) => mats(pp).find((l) => l.cvsId === String(id));
  ok(L(sup.id).unitCost === 389 && L(sup.id).evidence === 'E1' && L(sup.id).priceSource === "Ferguson Home's price book", 'E1 price from the supplier price book is honored');
  ok(sendReadiness(pp).starter.includes(L(sup.id)), 'an E1 price reaches the client only after the contractor accepts it');
  ok(L(hc.id).unitCost === 24.99 && L(hc.id).evidence === 'E3' && /not a quote/.test(L(hc.id).priceSource) && L(hc.id).seenOn === '2026-10-30' && L(hc.id).needsSupplier, 'E3 "seen online" price kept with its date, never a quote');
  ok(!sendReadiness(pp).starter.includes(L(hc.id)) && !sendReadiness(pp).unpriced.includes(L(hc.id)), 'an E3 line needs no acceptance');
  ok(L(odd.id).unitCost === null && /per sq ft/.test(L(odd.id).priceNote), 'a price per a different unit is not used');
  const re = structuredClone(priced); re.options[0].materials.find((m) => m.id === sup.id).price.unit = 399; importCvsPackage(re, st).apply(st); ok(L(sup.id).unitCost === 399, "a re-sent price-book price replaces the old one");
  setCvsPrice(pp, sup.id, 350); importCvsPackage(structuredClone(re), st).apply(st); ok(L(sup.id).unitCost === 350 && L(sup.id).evidence === 'E2', 'a price the contractor typed survives re-import');
}

{ // cvs-roof-bid-timbercrest-3options.json: priced work items (addendum 2, section 1)
  const st = freshState(); const plan = importCvsPackage(structuredClone(roofBid), st); const p = plan.apply(st).project;
  ok(/12 priced work items/.test(plan.preview.text) && plan.preview.options === 3 && !plan.createsSupplier, 'roof bid: preview counts the priced work', plan.preview.text);
  ok(p.client.name === 'Casey Smith' && p.client.phone === '+19135551234', 'roof bid: the customer is stored on the job');
  const t = p.estimate.tiers; ok(t.cvsOptions.good === 'opt-good' && t.cvsOptions.better === 'opt-better' && t.cvsOptions.best === 'opt-best', 'roof bid: Good / Better / Best');
  const work = Object.values(p.estimate.cvsLines).flat().filter((l) => l.cat === 'work');
  ok(work.filter((l) => l.cvsId !== 'discount').length === 12 && work.filter((l) => l.unitCost != null).every((l) => l.evidence === 'E2' && l.designItem), 'roof bid: work items are priced lines at E2 that print on the bid');
  ok(work.some((l) => l.name === 'GAF Timberline HDZ shingles, installed, Charcoal' && l.qty === 27.2 && l.unit === 'sq' && l.unitCost === 465), 'roof bid: name and detail (color) on the line');
  ok(work.find((l) => l.cvsId === 'discount' && l.cvsOption === 'opt-better').unitCost === -250 && discountFromNotes(['The total includes a $1,250.50 discount.']) === 1250.5, 'roof bid: the stated $250 discount is a line');
  const sum = tierSummary(p, st.settings); const totalOf = (k) => roofBid.options.find((o) => o.tier === k).total;
  ok(sum.every((x) => near(x.preTax, totalOf(x.key))), "roof bid: each option's price equals its total", sum.map((x) => `${x.key} ${x.preTax}/${totalOf(x.key)}`).join(', '));
  const op = optionPrices(p, totals); ok(op.length === 3 && op.every((x) => !x.warn && x.diff === 0) && op[1].theirs === 15924.5, 'roof bid: option.total shown beside Fullbid’s total, no warning when they match');
  const m = mats(p); ok(m.length === 16 && m.every((l) => l.orderOnly && l.supplierId === 'abc'), 'roof bid: takeoff materials on the order list');
  ok(groupBySupplier(p.estimate.items, st.settings).reduce((s, g) => s + g.lines.length, 0) === 16, 'roof bid: the order list has the 16 takeoff lines');
  const pre = totals(p.estimate).preTax; for (const l of m) setCvsPrice(p, l.cvsId, 100); const T2 = totals(p.estimate);
  ok(near(T2.preTax, pre) && near(T2.preTax, 15924.5) && T2.orderCost === m.reduce((s, l) => s + l.qty * 100, 0) && T2.jobCost === T2.orderCost, 'roof bid: priced materials are cost only, never added to the price', `${pre} → ${T2.preTax}`);
  const marked = { ...p.estimate, adj: { method: 'stack', materialMarkup: 15, laborMarkup: 10, overhead: 10, profit: 10, taxRate: 7, taxMaterialsOnly: true } }; ok(near(totals(marked).preTax, 15924.5) && near(totals(marked).tax, 0), 'roof bid: markups never apply to priced work or the order list');
  ok(!Object.values(p.estimate.cvsLines).flat().some((l) => l.origin === 'pack') && !p.estimate.items.some((l) => l.cat === 'labor'), 'roof bid: no pack labor added on top of work items');
  const r = sendReadiness(p); ok(!r.ok && r.unpriced.length === 3 && r.unpriced.every((l) => l.item === 'Downspouts'), 'roof bid: only the unpriced work lines block sending (not the order list)', r.message);
  setPriceLaborSeparately(p, true, st.settings); const withLab = Object.values(p.estimate.cvsLines).flat().filter((l) => l.origin === 'pack');
  ok(withLab.length > 0 && withLab.every((l) => l.cat === 'labor') && totals(p.estimate).preTax > 15924.5, '"price labor separately" adds pack labor (no fees) on top of the work');
  setPriceLaborSeparately(p, false, st.settings); ok(!Object.values(p.estimate.cvsLines).flat().some((l) => l.origin === 'pack') && near(totals(p.estimate).preTax, 15924.5), 'switching it off removes that labor');
  const off = structuredClone(roofBid); off.options[1].total = 15000; const st2 = freshState(); const p3 = importNew(off, st2).p; const w = optionPrices(p3, totals).find((x) => x.id === 'opt-better');
  ok(w.warn && near(w.diff, 924.5), 'roof bid: a warning when Fullbid’s total differs from the bid by more than 1%');
  const close = structuredClone(roofBid); close.options[1].total = 15924.5 * 1.009; ok(!optionPrices(importNew(close, freshState()).p, totals).find((x) => x.id === 'opt-better').warn, 'roof bid: no warning within 1%');
  // re-import with a work price changed; after signing it becomes a change order line
  const ch = structuredClone(roofBid); ch.options[1].workItems.find((x) => x.id === 'b-gut').price.unit = 13;
  const pl2 = importCvsPackage(ch, st); ok(pl2.diff.length === 1 && pl2.diff[0].type === 'price' && pl2.diff[0].cat === 'work', 'roof bid: a changed work price is one difference', JSON.stringify(pl2.diff));
  p.estimate.signature = { name: 'Casey' }; setActiveOption(p, 'opt-better', st.settings); const co = importCvsPackage(ch, st).apply(st).changeOrder;
  ok(co.items.length === 1 && co.items[0].cat === 'work' && co.items[0].unitCost === 1 && co.items[0].qty === 142, 'roof bid: after signing, the price change is a change order line', JSON.stringify(co.items.map((i) => [i.name, i.qty, i.unitCost])));
}

{ // transport for the live CVS links (addendum 2)
  const live = 'https://rrg-studio.vercel.app/visualizer/api/fullbid/package?id=abc&k=1';
  let asked = null; const f = async (u) => { asked = u; return { ok: true, json: async () => n3 }; };
  const raw = await packageFromHash('#cvs-url=' + live, DEFAULTS.settings, f); ok(raw.obj && asked === live, 'a #cvs-url= link keeps its full query (?id=…&k=…)', asked);
  const enc = await packageFromHash('#cvs-url=' + encodeURIComponent(live), DEFAULTS.settings, f); ok(enc.obj && asked === live, 'an encoded #cvs-url= link works too');
  const custom = { cvs: { origins: ['https://studio.example.com'] } }; ok(cvsOrigins(custom).includes('https://rrg-studio.vercel.app') && originAllowed(live, custom) && originAllowed('https://studio.example.com/p', custom), 'the allow-list keeps https://rrg-studio.vercel.app beside added origins');
  const link = await encodeCvsPackage(n3); ok(link.startsWith('d:') && link.length <= 8000, 'the 3-option Neenan package fits an inline link', link.length);
  const back = await packageFromHash(`#cvs=${link}`, DEFAULTS.settings); ok(back.obj && JSON.stringify(back.obj) === JSON.stringify(n3), 'the inline link round-trips the real package');
}

// ---------------- every real fixture (test/fixtures/cvs/*.json): lines match one for one
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

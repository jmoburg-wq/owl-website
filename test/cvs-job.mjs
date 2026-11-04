// CVS job packages, addendum 3 (docs/FULLBID-DIRECTION-ADDENDUM-3.md): picks apart from job materials, job materials by
// phase with editable quantities and price-book prices, labor by trade with crew days, the confirm-on-site checklist,
// the customer bid and the material order sheet. Runs on the real CVS exports in test/fixtures/cvs/.
import { readFileSync } from 'node:fs';
import { DEFAULTS } from '../js/store.js';
import { importCvsPackage, previewPackage, rebuildCvsLines, NEWER_MESSAGE } from '../js/cvs/import.js';
import { jobMaterialsByPhase, laborByTrade, siteChecklist, setCheck, setJobQty, setAllowance, pickLines, jobLines, customerBid, materialOrderSheet, orderSheetText, phasesOf, phaseOfLine } from '../js/cvs/job.js';
import { JOB_PHASES } from '../js/trades/bath/pack.js';
import { totals, recompute } from '../js/pricing/estimator.js';
import { DEFAULT_SUPPLIERS } from '../js/pricing/suppliers.js';

let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', msg, extra); } };
const load = (f) => JSON.parse(readFileSync(new URL(`./fixtures/cvs/${f}`, import.meta.url), 'utf8'));
const freshState = () => { const st = structuredClone(DEFAULTS); st.settings.suppliers = structuredClone(DEFAULT_SUPPLIERS); return st; };
const importNew = (pkg, st = freshState()) => { const plan = importCvsPackage(structuredClone(pkg), st); if (!plan.ok) throw new Error(plan.error); const r = plan.apply(st); return { st, plan, p: r.project }; };

const shower = load('cvs-shower-jobs-neenan-wetroom.json');
const tub = load('cvs-walk-in-tub-ella-tub4two.json');
const oldShower = load('cvs-shower-neenan-hall.json');

// ---------------- the package: version 1, additive fields
ok(shower.version === 1 && tub.version === 1, 'addendum 3 packages are still version 1');
ok(shower.phases.map((p) => p.id).join() === JOB_PHASES.map((p) => p.id).join(), "the bath pack's phases match CVS's");
ok(importCvsPackage({ ...shower, version: 2 }, freshState()).error === NEWER_MESSAGE, 'a version 2 package is still refused');

// ---------------- preview: picks apart from job materials, and the checklist
{ const pv = previewPackage(shower); const o = shower.options[0];
  const picks = o.materials.filter((m) => m.designItem).length;
  ok(pv.phased && pv.picks === picks && pv.jobMaterials === o.materials.length - picks && pv.checks === o.checklist.length, 'preview counts picks, job materials and checks', JSON.stringify(pv));
  ok(pv.text.includes(`${picks} customer picks and ${o.materials.length - picks} job materials by phase; ${o.checklist.length} things to confirm on site.`), 'preview says so in plain words', pv.text);
  ok(!previewPackage(oldShower).text.includes('by phase'), 'an older package previews exactly as before'); }

// ---------------- picks stay apart from job materials
{ const { p } = importNew(shower); const o = shower.options[0];
  ok(pickLines(p).every((l) => l.designItem) && jobLines(p).every((l) => !l.designItem), 'picks and job materials never mix');
  ok(pickLines(p).length === o.materials.filter((m) => m.designItem).length && jobLines(p).length === o.materials.filter((m) => !m.designItem).length, 'every line lands on one side');
  const bid = customerBid(p); const names = bid.picks.map((x) => x.name).join('|');
  ok(bid.picks.length === o.shoppingList.flatMap((s) => s.rows).length && bid.picks.every((x) => x.picture), "the customer bid shows the design's picks, each with its picture");
  ok(!/screws|seam tape|small parts|haul-away|grout sealer/i.test(names), 'job materials never print on the customer bid');
}

// ---------------- job materials by phase: order, fields, editable quantities, prices from the price book
{ const { st, p } = importNew(shower); const groups = jobMaterialsByPhase(p); const order = phasesOf(p).map((x) => x.id);
  ok(groups.map((g) => order.indexOf(g.id)).every((v, i, a) => v >= 0 && (i === 0 || v > a[i - 1])), 'phases in the job order', groups.map((g) => g.id).join());
  ok(groups.reduce((t, g) => t + g.lines.length, 0) === jobLines(p).length, 'every job line in a phase');
  ok(groups.find((g) => g.id === 'substrate').lines.some((l) => /Backer board screws/.test(l.name)), 'backer board screws under substrate and waterproofing');
  const kitLine = jobLines(p).find((l) => l.kit); ok(kitLine && /^Added for /.test(kitLine.kit), 'kit lines say what they were added for', kitLine && kitLine.kit);
  ok(jobLines(p).every((l) => l.unitCost == null && l.priceSource === 'needs a price'), 'no price is made up: every job line needs a price');
  const screws = jobLines(p).find((l) => /Backer board screws/.test(l.name));
  ok(setJobQty(p, screws.key, 200) && screws.qty === 200 && screws.locked, 'a quantity edited on site is kept and marked');
  rebuildCvsLines(p, st.settings); ok(jobLines(p).find((l) => /Backer board screws/.test(l.name)).qty === 200, 'the edit survives a rebuild');
  ok(!setJobQty(p, screws.key, -3), 'a negative quantity is refused');
  // the contractor's price list prices a job line (E3, "price list"); the rest stay blank
  st.settings.priceList = [{ name: 'Grout sealer', price: 18.5, supplierId: null, updatedAt: '2026-11-03' }];
  rebuildCvsLines(p, st.settings); const sealer = jobLines(p).find((l) => l.item === 'Grout sealer');
  ok(sealer && sealer.unitCost === 18.5 && sealer.evidence === 'E3', 'a job line priced from the price list shows its tier', JSON.stringify(sealer && { c: sealer.unitCost, e: sealer.evidence }));
  // (the price list's name match is Fullbid's own: "Grout sealer" also prices the plain grout line)
  ok(jobLines(p).filter((l) => !/grout/i.test(l.item)).every((l) => l.unitCost == null), 'unknown stays blank');
  ok(jobMaterialsByPhase(p).every((g) => g.lines.every((l) => l.unitCost == null || l.unitCost > 0)), 'nothing shows $0');
}

// ---------------- labor by trade with crew days
{ const { p } = importNew(shower); const lab = laborByTrade(p); const src = shower.options[0].labor;
  const mid = src.reduce((t, l) => t + ((l.hours[0] + l.hours[1]) / 2) * l.units, 0);
  ok(Math.abs(lab.reduce((t, g) => t + g.hours, 0) - mid) < 0.01, 'labor by trade sums to the mid hours', `${lab.reduce((t, g) => t + g.hours, 0)} vs ${mid}`);
  ok(lab.every((g) => g.crewDays === Math.max(0.5, Math.ceil(g.hours / 4) / 2)), 'crew days are 8-hour days to the half day');
  ok(p.estimate.items.filter((l) => l.cat === 'labor').every((l) => Array.isArray(l.crewDays)), "labor lines keep the design's crew days"); }

// ---------------- the confirm-on-site checklist
{ const { st, p } = importNew(shower); const c = siteChecklist(p);
  ok(c.length === shower.options[0].checklist.length && c[0].text === 'Confirm the drain location under the floor', 'the checklist shows on the job', c[0] && c[0].text);
  setCheck(p, c[0].id, true); ok(siteChecklist(p)[0].done, 'a check is kept');
  const again = importCvsPackage(structuredClone(shower), st); again.apply(st); ok(siteChecklist(p)[0].done, 'checks survive a re-import of the same design');
  ok(siteChecklist(importNew(oldShower).p).length === 0, 'an older package has no checklist (and nothing breaks)'); }

// ---------------- the material order sheet: every line, grouped by where it's bought
{ const { st, p } = importNew(shower); const sheet = materialOrderSheet(p, st.settings); const all = p.estimate.items.filter((l) => l.origin === 'cvs' && l.cat === 'material');
  const keys = sheet.flatMap((g) => g.lines.map((l) => l.key));
  ok(keys.length === all.length && new Set(keys).size === keys.length, 'every material line once, picks and job materials');
  ok(sheet[0].name === 'Neenan', "the showroom's own order comes first", sheet[0].name);
  const stock = sheet[sheet.length - 1]; const noOrder = new Set(all.filter((l) => l.noOrder).map((l) => l.key));
  ok(stock.key === '_stock' && stock.lines.every((l) => noOrder.has(l.key)) && stock.lines.length === noOrder.size, 'your own stock and allowances last, no order');
  ok(sheet.some((g) => g.lines.some((l) => l.designItem)) && sheet.some((g) => g.lines.some((l) => !l.designItem)), 'picks and job materials both on the sheet');
  const text = orderSheetText(p, sheet); ok(text.startsWith('Material order: ') && text.includes('[customer pick]'), 'the sheet as text');
}
{ // a contractor's own walk-in tub job: specialty lines go to the preferred supplier for plumbing and electrical, to confirm
  const { st, p } = importNew(tub); const sheet = materialOrderSheet(p, st.settings);
  ok(p.cvs.pack === 'bath' && p.cvs.module === 'walk_in_tub', 'a walk-in tub imports into the bath pack');
  const cable = jobLines(p).find((l) => /dedicated circuit/.test(l.name)); ok(cable && phaseOfLine(cable) === 'electrical' && cable.jobTrade === 'electrical', "the tub's circuit is an electrical job line");
  ok(sheet.every((g) => g.lines.length > 0), 'no empty groups');
  ok(jobMaterialsByPhase(p).some((g) => g.id === 'plumbing' && g.lines.some((l) => /shutoff/i.test(l.name))), 'shutoffs under plumbing rough-in');
  ok(siteChecklist(p).some((c) => /water heater/.test(c.text)), "the tub's checks show"); }

// ---------------- the customer bid: picks, allowances, labor as shown, total
{ const { p } = importNew(shower); recompute(p, freshState().settings); const T = totals(p.estimate);
  const b = customerBid(p); ok(b.total === Math.round(T.total * 100) / 100 && b.needsPrices, 'the bid total is the estimate total, and says prices are missing');
  ok(b.labor.length === laborByTrade(p).length, 'labor by trade by default');
  ok(customerBid(p, { labor: 'total' }).labor.length === 1 && customerBid(p, { labor: 'hidden' }).labor.length === 0, 'labor as one line, or inside the price');
  const pick = pickLines(p)[0]; setAllowance(p, pick.cvsId, true);
  ok(customerBid(p).allowances.length === 1 && customerBid(p).allowances[0].name === pick.name, 'a pick bid as an allowance shows under the selections still to make');
  setAllowance(p, pick.cvsId, false); ok(customerBid(p).allowances.length === 0, 'and back'); }

// ---------------- older packages still import and work
for (const f of ['cvs-shower-neenan-hall.json', 'cvs-bathroom-ferguson-luxury.json', 'cvs-roof-timbercrest.json']) {
  const { st, p } = importNew(load(f)); const groups = jobMaterialsByPhase(p);
  ok(groups.reduce((t, g) => t + g.lines.length, 0) === jobLines(p).length, `${f}: job lines grouped by their kind of material`);
  ok(materialOrderSheet(p, st.settings).flatMap((g) => g.lines).length === p.estimate.items.filter((l) => l.origin === 'cvs' && l.cat === 'material').length, `${f}: order sheet has every line`);
}

console.log(`cvs job tests: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

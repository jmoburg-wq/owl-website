// Contractor Visual Studio (CVS) job package v1 → Fullbid job. See docs/FULLBID-DIRECTION.md section 4.
// Pure functions only (no DOM): validate, preview, map to lines, price readiness, measurements, re-import diff.
// Every way in (link with the package inside, link to the package, a .json file) goes through importCvsPackage().
import { unitFromText, fullbidTrade, classForGroup, packForModule, mergeMeasurement, TRADES as SHARED_TRADES, rankOf } from '../shared/vocab.js';
import { suppliersOf, supplierFor, matchPriceRow } from '../pricing/suppliers.js';
import { profileOf, laborIndex, LABOR_BASE, TRADES as LABOR_TRADES } from '../pricing/profile.js';
import { regionFor } from '../pricing/estimator.js';
import { PACK_MAP } from '../trades/index.js';

export const SCHEMA = 'cvs.job-package';
export const MAX_VERSION = 1;
export const DEFAULT_CVS_ORIGINS = ['https://rrg-studio.vercel.app'];
export const NEWER_MESSAGE = 'This design was made with a newer version; update Fullbid';
const HOME_CENTER_IDS = ['homedepot', 'lowes', 'menards'];
const TIER_ORDER = ['good', 'better', 'best'];
const r2 = (v) => Math.round(v * 100) / 100;
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? '' : String(v));
const slugify = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
/** Lines that belong to the design package: imported from it ('cvs') or worked out by a pack for it ('pack'). */
export const isJobLine = (l) => !!l && (l.origin === 'cvs' || l.origin === 'pack');
const isContractorPkg = (pkg) => str(pkg && pkg.company && pkg.company.role) === 'contractor';

// ---------------------------------------------------------------- validation
/** Check shape and version. Unknown fields are ignored. Returns { ok, error, pkg }. */
export function validatePackage(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'This file is not a design package.' };
  if (obj.schema !== SCHEMA) return { ok: false, error: obj.schema && /^cvs\./.test(obj.schema) ? NEWER_MESSAGE : 'This file is not a design package from Contractor Visual Studio.' };
  const v = Number(obj.version);
  if (!Number.isFinite(v) || v < 1) return { ok: false, error: 'This design package has no version number.' };
  if (v > MAX_VERSION) return { ok: false, error: NEWER_MESSAGE };
  const options = arr(obj.options);
  if (!options.length) return { ok: false, error: 'This design package has no options to price.' };
  if (options.length > 3) return { ok: false, error: 'This design package has more than three options.' };
  if (!obj.design || !obj.design.id) return { ok: false, error: 'This design package has no design id.' };
  for (const o of options) for (const m of arr(o.materials)) if (!m || m.id == null) return { ok: false, error: 'A material in this design package has no id.' };
  for (const o of options) for (const w of arr(o.workItems)) if (!w || w.id == null) return { ok: false, error: 'A priced line in this design package has no id.' };
  return { ok: true, pkg: obj };
}

// ---------------------------------------------------------------- preview
export function previewPackage(pkg) {
  const opts = arr(pkg.options);
  const matIds = new Set(), labIds = new Set(), typIds = new Set(); let work = 0;
  for (const o of opts) {
    for (const m of arr(o.materials)) { matIds.add(m.id); if (m.typical) typIds.add(m.id); }
    for (const l of arr(o.labor)) labIds.add(l.id);
    work += arr(o.workItems).length;
  }
  const title = str(pkg.design && pkg.design.title) || 'Untitled design';
  const company = str(pkg.company && pkg.company.name) || 'a CVS designer';
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const pack = projectPack(pkg);
  const text = `Import '${title}' from ${company}: ${work ? `${n(work, 'priced work item')}, ` : ''}${n(matIds.size, 'material')}, ${n(labIds.size, 'labor item')}, ${n(opts.length, 'option')}.` + (typIds.size ? ` ${typIds.size} line${typIds.size === 1 ? ' uses' : 's use'} typical sizes.` : '');
  const fill = packFillPlan(pkg, null);
  // addendum 3: the customer's picks apart from the job materials, and what to confirm on site
  const first = opts[0] || {}; const phased = arr(first.materials).some((m) => m && m.phase);
  const picks = arr(first.materials).filter((m) => m && m.designItem).length; const jobMats = arr(first.materials).length - picks; const checks = arr(first.checklist).length;
  const jobText = phased ? ` ${n(picks, 'customer pick')} and ${n(jobMats, 'job material')} by phase${checks ? `; ${n(checks, 'thing')} to confirm on site` : ''}.` : '';
  return { title, company, materials: matIds.size, labor: labIds.size, work, options: opts.length, typical: typIds.size, pack, packName: (PACK_MAP[pack] && PACK_MAP[pack].meta.name) || 'General', module: str(pkg.source && pkg.source.module), fillsLabor: fill.options.length > 0, needs: fill.needs, picks, jobMaterials: jobMats, checks, phased, text: text + jobText };
}

/** The pack that takes the whole job (the module), with exterior and flatwork split by the design's materials. */
export function projectPack(pkg) {
  const module = str(pkg.source && pkg.source.module);
  const hint = arr(pkg.options).flatMap((o) => arr(o.materials).map((m) => `${str(m.area)} ${str(m.group)} ${str(m.item)}`)).join(' ') + ' ' + str(pkg.design && pkg.design.title);
  if (module === 'exterior') {
    const counts = {}; for (const o of arr(pkg.options)) for (const m of arr(o.materials)) { const p = packForModule('exterior', `${str(m.area)} ${str(m.group)}`); counts[p] = (counts[p] || 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'roofing';
  }
  return packForModule(module, hint);
}

// ---------------------------------------------------------------- suppliers (section 3.4)
const isHomeCenter = (s) => !!(s && (s.homeCenter || HOME_CENTER_IDS.includes(s.id)));
/**
 * The supplier record for a supplier's package (a showroom, a lumberyard): matched by company.id first, then by name,
 * or described for creation. A contractor's own package never makes a supplier record (addendum 1, section 1).
 */
export function companySupplier(settings, company) {
  if (str(company && company.role) === 'contractor') return { supplier: null, created: false };
  const name = str(company && company.name).trim(); if (!name) return { supplier: null, created: false };
  const lc = name.toLowerCase(); const list = suppliersOf(settings);
  const found = (company.id != null && company.id !== '' && list.find((s) => s.cvsCompanyId != null && String(s.cvsCompanyId) === String(company.id))) || list.find((s) => [s.name, s.short].some((x) => str(x).toLowerCase() === lc));
  if (found) return { supplier: found, created: false };
  return { supplier: { id: `cvs-${slugify(name) || 'company'}`, name, short: name, domain: '', classes: [], factor: 1, delivery: 0, notes: 'Added from a design package', cvsCompanyId: company.id || null }, created: true };
}
function homeCenterFor(settings, cls) {
  const pref = supplierFor(settings, cls); if (isHomeCenter(pref)) return pref;
  return suppliersOf(settings).find(isHomeCenter) || pref;
}
/**
 * On a contractor's own package, `from: "supplier"` means the contractor's preferred supplier for that material class:
 * the one set in Suppliers, or else one whose classes include it, marked "Confirm supplier".
 */
export function preferredSupplierFor(settings, cls) {
  const list = suppliersOf(settings); const set = settings && settings.supplierPrefs && settings.supplierPrefs[cls];
  const chosen = set && list.find((s) => s.id === set);
  if (chosen) return { supplierId: chosen.id };
  const dflt = supplierFor(settings, cls);
  const pick = dflt && (dflt.classes || []).includes(cls) ? dflt : list.find((s) => (s.classes || []).includes(cls));
  return pick ? { supplierId: pick.id, confirmSupplier: true } : { supplierId: null, needsSupplier: true };
}
/** Where a line is bought → { supplierId, noOrder, needsSupplier, confirmSupplier, fromNote }. */
export function supplierForLine(m, cls, settings, companySup, role = '') {
  const from = str(m.from) || 'contractor';
  // A job line from a plumbing or electrical supply house (addendum 3): the contractor's preferred supplier for it, to confirm
  if (from === 'specialty' && m.phase && !m.designItem && (cls === 'plumbing' || cls === 'electrical')) return { ...preferredSupplierFor(settings, cls), confirmSupplier: true };
  if (from === 'supplier' && role === 'contractor') return preferredSupplierFor(settings, cls);
  if (from === 'supplier') return { supplierId: companySup ? companySup.id : null, needsSupplier: !companySup };
  if (from === 'home-center') return { supplierId: homeCenterFor(settings, cls).id };
  if (from === 'contractor') return { supplierId: null, noOrder: true };
  if (from === 'online') return { supplierId: null, needsSupplier: true, fromNote: m.price && m.price.seenOn ? `Price seen online on ${m.price.seenOn}, not a quote` : 'Bought online' };
  return { supplierId: null, needsSupplier: true };
}

// ---------------------------------------------------------------- prices
/** Labor rate for a trade: the contractor's own rate (E2) or the starter rate × region (E0). */
export function laborRateFor(ltrade, settings) {
  const p = profileOf(settings);
  if (p.useOwnRates && Number(p.rates[ltrade]) > 0) return { rate: r2(Number(p.rates[ltrade])), evidence: 'E2' };
  if (p.useOwnRates && Number(p.rates.laborer) > 0) return { rate: r2(Number(p.rates.laborer)), evidence: 'E2' };
  const base = (LABOR_TRADES[ltrade] && LABOR_TRADES[ltrade].rate) || LABOR_BASE;
  return { rate: r2(base * laborIndex(ltrade, { ...settings, profile: { ...p, useOwnRates: false } }, regionFor(settings))), evidence: 'E0' };
}
function priceMaterial(line, m, settings, priceFromOther) {
  if (priceFromOther) return { unitCost: priceFromOther.unitCost, evidence: priceFromOther.evidence, priceSource: priceFromOther.priceSource };
  const pl = (settings && settings.priceList) || [];
  if (pl.length) {
    const row = matchPriceRow({ name: line.name, sku: m.sku }, pl, line.supplierId) || (line.supplierId ? null : matchPriceRow({ name: line.name, sku: m.sku }, pl, null));
    if (row) return { unitCost: r2(Number(row.price)), evidence: 'E3', priceSource: 'price list', priceAt: row.updatedAt };
  }
  return packagePrice(m.price, line);
}
const COUNT_UNITS = ['ea', 'piece'];
const sameUnit = (a, b) => a === b || (COUNT_UNITS.includes(a) && COUNT_UNITS.includes(b));
/**
 * A price the package carries, at its own tier: E1 from the company's price book (shown to the contractor; to a client
 * only once accepted), E2 the contractor's own price book, E3 a price seen online on a date (never a quote).
 * A price per a different unit than the line is not used (no conversions are guessed).
 */
export function packagePrice(p, line) {
  if (!p || p.unit == null || !Number.isFinite(Number(p.unit)) || !/^E[0-5]$/.test(str(p.tier))) return { unitCost: null, evidence: null, priceSource: 'needs a price' };
  if (p.per && !sameUnit(unitFromText(p.per), line.unit)) return { unitCost: null, evidence: null, priceSource: 'needs a price', priceNote: `The design's price is per ${p.per}; this line is counted in ${line.unitText || line.unit}.` };
  const seen = p.tier === 'E3' && (p.seenOn || line.from === 'online');
  const source = str(p.source) || (p.tier === 'E1' ? 'company price book' : 'design package');
  return { unitCost: r2(Number(p.unit)), evidence: p.tier, priceSource: seen ? `${source}${p.seenOn ? ` on ${p.seenOn}` : ''}, not a quote` : source, priceAt: p.seenOn || null, seenOn: p.seenOn || null };
}

// ---------------------------------------------------------------- mapping (section 4.5)
export const LEVELS = ['low', 'mid', 'high'];
const hoursAt = (h, level) => { const lo = Number(h && h[0]) || 0, hi = Number(h && h[1] != null ? h[1] : lo) || 0; return level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2; };
export const tradeLabel = (t) => (SHARED_TRADES[t] && SHARED_TRADES[t].label) || (LABOR_TRADES[fullbidTrade(t)] || {}).label || str(t);

/**
 * Lines for one package option. `prev` (key → previous line) keeps the contractor's edits and prices;
 * `shared` (cvsId → priced line) lets a price typed on one option fill the same material in the others.
 * `measurements` (the job's, ranked) feed a pack's own labor when the option sends none (addendum 1, section 2).
 * `laborSeparately`: the contractor's per-job switch to add pack labor on top of priced work items (addendum 2).
 */
export function linesForOption(pkg, opt, settings, { laborChoice = {}, companySup = null, prev = new Map(), shared = new Map(), pack = projectPack(pkg), measurements = arr(pkg.measurements), laborSeparately = false } = {}) {
  const out = []; const role = str(pkg.company && pkg.company.role);
  const work = arr(opt.workItems); const hasWork = work.length > 0;
  // priced installed work (addendum 2): prints on the customer's bid at its own price, evidence E2
  for (const w of work) {
    const key = `cvs|${opt.id}|w|${w.id}`; const name = str(w.name) + (w.detail ? `, ${w.detail}` : '');
    const base = { id: key, key, origin: 'cvs', cvsId: String(w.id), cvsOption: opt.id, custom: true, cat: 'work', assembly: 'cvs', assemblyName: 'Work', trade: 'Work', service: str(w.service),
      pack: w.service ? packForModule(str(pkg.source && pkg.source.module), str(w.service)) : pack, roomId: null, roomName: '', name, item: str(w.name), detail: w.detail == null ? '' : str(w.detail), finish: w.detail == null ? '' : str(w.detail),
      qty: Number(w.qty) || 0, unit: unitFromText(w.unit), unitText: str(w.unit), note: w.qtyNote == null ? '' : str(w.qtyNote), designItem: true, taxable: false, hours: 0 };
    const pr = w.price && w.price.unit != null && Number.isFinite(Number(w.price.unit)) ? { unitCost: r2(Number(w.price.unit)), evidence: /^E[0-5]$/.test(str(w.price.tier)) ? w.price.tier : 'E2', priceSource: str(w.price.source) || 'your price book', fromPackage: true } : { unitCost: null, evidence: null, priceSource: 'needs a price' };
    let line = { ...base, ...pr, baseCost: pr.unitCost };
    const p = prev.get(key);
    if (p) { if (p.priceLocked) line = { ...line, unitCost: p.unitCost, evidence: p.evidence, priceSource: p.priceSource, priceLocked: true, fromPackage: false }; if (p.accepted && p.evidence === line.evidence) line.accepted = true; if (p.locked) line = { ...line, locked: true, qty: p.qty, name: p.name, note: p.note, edited: p.edited || { qty: p.qty, name: p.name } }; }
    out.push(line);
  }
  const discount = hasWork ? (Number(opt.discount) > 0 ? Number(opt.discount) : discountFromNotes(opt.notes)) : 0;
  if (discount > 0) out.push({ id: `cvs|${opt.id}|w|discount`, key: `cvs|${opt.id}|w|discount`, origin: 'cvs', cvsId: 'discount', cvsOption: opt.id, custom: true, cat: 'work', assembly: 'cvs', assemblyName: 'Work', trade: 'Work', roomId: null, roomName: '', name: 'Discount', item: 'Discount', qty: 1, unit: 'job', unitText: 'job', unitCost: -discount, baseCost: -discount, evidence: 'E2', priceSource: 'on your bid', fromPackage: true, note: Number(opt.discount) > 0 ? 'On your bid' : 'From the bid’s notes', designItem: true, taxable: false, hours: 0 });
  for (const m of arr(opt.materials)) {
    const key = `cvs|${opt.id}|m|${m.id}`;
    const cls = classForGroup(m.group, m.item);
    const sup = supplierForLine(m, cls, settings, companySup, role);
    const name = str(m.item) + (m.finish ? `, ${m.finish}` : '');
    const base = {
      id: key, key, origin: 'cvs', cvsId: String(m.id), cvsOption: opt.id, custom: true, cat: 'material',
      assembly: 'cvs', assemblyName: hasWork ? `Order list: ${str(m.group) || 'materials'}` : str(m.group) || 'Design materials', trade: str(m.group) || 'Design materials',
      pack: m.area ? packForModule(str(pkg.source && pkg.source.module), `${str(m.area)} ${str(m.group)}`) : pack,
      roomId: null, roomName: str(m.area), name, item: str(m.item), finish: m.finish == null ? '' : str(m.finish), maker: m.maker == null ? '' : str(m.maker), collection: m.collection == null ? '' : str(m.collection),
      sku: m.sku == null ? '' : str(m.sku), qty: Number(m.qty) || 0, unit: unitFromText(m.unit), unitText: str(m.unit), cls, ...sup,
      note: m.how == null ? '' : str(m.how), notes: arr(m.notes).map(str), typical: !!m.typical, designItem: !!m.designItem, group: str(m.group), from: str(m.from) || 'contractor', fromLabel: m.fromLabel == null ? '' : str(m.fromLabel),
      taxable: !hasWork, supplierPinned: !!sup.supplierId && !sup.confirmSupplier,
      // addendum 3: the job phase, the trade that installs it, the kit that added it
      ...(m.phase ? { phase: str(m.phase) } : {}), ...(m.trade ? { jobTrade: str(m.trade) } : {}), ...(m.kit ? { kit: str(m.kit) } : {}),
      // with priced work items, the takeoff is the order list and the job's cost: never added to the price again
      ...(hasWork ? { orderOnly: true } : {}),
    };
    const p = prev.get(key);
    const keepPrev = p && p.unitCost != null && p.evidence !== null && !p.fromPackage;
    const priced = keepPrev ? { unitCost: p.unitCost, evidence: p.evidence, priceSource: p.priceSource } : priceMaterial(base, m, settings, shared.get(String(m.id)));
    if (!keepPrev && priced.unitCost != null && m.price && priced.priceSource !== 'price list' && !shared.get(String(m.id))) priced.fromPackage = true;
    let line = { ...base, ...priced, baseCost: priced.unitCost };
    if (p) {
      if (p.accepted && p.evidence === line.evidence) line.accepted = true;
      if (p.supplierPinned && p.supplierId && p.supplierId !== line.supplierId && !line.noOrder) { line.supplierId = p.supplierId; line.supplierPinned = true; delete line.confirmSupplier; delete line.needsSupplier; }
      if (p.locked) line = { ...line, locked: true, qty: p.qty, name: p.name, unit: p.unit, note: p.note, edited: p.edited || { qty: p.qty, name: p.name } };
      if (p.recompute) line.recompute = true;
      if (p.allowance && line.designItem) line.allowance = true;
    }
    out.push(line);
  }
  // labor: hours for one unit × units, at the chosen level per trade; a sub's lump sum replaces that trade's hours
  const byTrade = new Map();
  for (const l of arr(opt.labor)) { const t = str(l.trade) || 'carpentry'; if (!byTrade.has(t)) byTrade.set(t, []); byTrade.get(t).push(l); }
  for (const [trade, list] of byTrade) {
    const choice = laborChoice[trade] || 'mid'; const ltrade = fullbidTrade(trade);
    if (choice && typeof choice === 'object' && choice.sub != null) {
      const key = `cvs|${opt.id}|sub|${trade}`; const amt = Number(choice.sub);
      out.push({ id: key, key, origin: 'cvs', cvsOption: opt.id, cvsTrade: trade, custom: true, cat: 'labor', assembly: 'cvs', assemblyName: 'Labor', trade: 'Labor', roomId: null, roomName: '', name: `${tradeLabel(trade)}: subcontractor${choice.name ? ` (${choice.name})` : ''}, lump sum`, unit: 'job', qty: 1, unitCost: Number.isFinite(amt) && amt > 0 ? r2(amt) : null, baseCost: amt, hours: 0, ltrade, sub: true, evidence: Number.isFinite(amt) && amt > 0 ? 'E4' : null, priceSource: 'sub quote', taxable: false, note: list.map((l) => str(l.name)).join('; ') });
      continue;
    }
    const level = LEVELS.includes(choice) ? choice : 'mid';
    const { rate, evidence } = laborRateFor(ltrade, settings);
    for (const l of list) {
      const key = `cvs|${opt.id}|l|${l.id}`; const units = Number(l.units) > 0 ? Number(l.units) : 1;
      const hours = r2(hoursAt(l.hours, level) * units);
      const p = prev.get(key);
      let line = { id: key, key, origin: 'cvs', cvsId: String(l.id), cvsOption: opt.id, cvsTrade: trade, custom: true, cat: 'labor', assembly: 'cvs', assemblyName: 'Labor', trade: 'Labor', roomId: null, roomName: str(l.area), name: str(l.name) || tradeLabel(trade), unit: 'hr', qty: hours, hours, hoursRange: arr(l.hours).map(Number), units, level, ltrade, unitCost: rate, baseCost: rate, evidence, priceSource: evidence === 'E2' ? 'your rate' : 'starter rate', note: l.why == null ? '' : str(l.why), size: l.size == null ? '' : str(l.size), taxable: false, ...(Array.isArray(l.crewDays) ? { crewDays: l.crewDays.map(Number) } : {}), ...(l.kit ? { kit: str(l.kit) } : {}) };
      if (p) { if (p.accepted && p.evidence === line.evidence) line.accepted = true; if (p.priceLocked) line = { ...line, unitCost: p.unitCost, evidence: 'E2', priceSource: 'your rate', priceLocked: true }; }
      out.push(line);
    }
  }
  // a pack fills what the package doesn't send: labor (and usual fees) from the measurements
  if (!arr(opt.labor).length && (!hasWork || laborSeparately)) out.push(...packLinesFor(pkg, opt, settings, { measurements, prev, laborOnly: hasWork }).lines);
  return out;
}

/** "The total includes a $250 discount." → 250. Only an amount the bid states; nothing is guessed. */
export function discountFromNotes(notes) {
  for (const n of arr(notes)) { const m = /\$\s?([\d,]+(?:\.\d{1,2})?)\s+discount/i.exec(str(n)); if (m) { const v = Number(m[1].replace(/,/g, '')); if (v > 0) return v; } }
  return 0;
}

// ---------------------------------------------------------------- pack fill (addendum 1, section 2)
const measureMap = (list) => { const o = {}; for (const m of arr(list)) if (m && m.kind && Number.isFinite(Number(m.value))) o[m.kind] = Number(m.value); return o; };
/** Which options get pack labor, the packs that work it out, and the measurements they still need. */
export function packFillPlan(pkg, project, { laborSeparately = !!(project && project.cvs && project.cvs.priceLaborSeparately) } = {}) {
  const meas = measureMap(project && project.measurements ? project.measurements : pkg.measurements);
  const options = arr(pkg.options).filter((o) => !arr(o.labor).length && (!arr(o.workItems).length || laborSeparately));
  const needs = new Map(); const packs = new Set();
  for (const o of options) for (const id of fillPacks(pkg, o)) { const r = PACK_MAP[id].fill(meas, { has: hasIn(o) }); if (r.lines.length) packs.add(id); for (const n of r.needs) needs.set(n.kind, n); }
  return { options: options.map((o) => o.id), packs: [...packs], needs: [...needs.values()] };
}
function fillPacks(pkg, opt) {
  const module = str(pkg.source && pkg.source.module); const ids = new Set();
  for (const m of arr(opt.materials)) ids.add(m.area || m.group ? packForModule(module, `${str(m.area)} ${str(m.group)}`) : projectPack(pkg));
  if (!ids.size) ids.add(projectPack(pkg));
  return [...ids].filter((id) => PACK_MAP[id] && typeof PACK_MAP[id].fill === 'function');
}
const hasIn = (opt) => (re) => [...arr(opt.materials).map((m) => str(m.item)), ...arr(opt.workItems).map((w) => str(w.name))].some((t) => re.test(t));

/** Pack-made lines for one option, tagged origin "pack": labor in hours at the contractor's rate, fees at starter prices (E0). */
export function packLinesFor(pkg, opt, settings, { measurements = arr(pkg.measurements), prev = new Map(), laborOnly = false } = {}) {
  const meas = measureMap(measurements); const out = []; const needs = [];
  for (const id of fillPacks(pkg, opt)) {
    const pk = PACK_MAP[id]; const r = pk.fill(meas, { has: hasIn(opt) }); needs.push(...r.needs);
    for (const ln of r.lines) {
      if (laborOnly && ln.cat !== 'labor') continue;
      const key = `pack|${opt.id}|${id}|${ln.slug || slugify(ln.name)}`; const p = prev.get(key);
      const common = { id: key, key, origin: 'pack', pack: id, cvsOption: opt.id, custom: true, assembly: 'pack', assemblyName: `${pk.meta.name}: worked out by Fullbid`, trade: pk.meta.name, roomId: null, roomName: '', name: ln.name, note: ln.note || '', taxable: false, needsMeasure: ln.needs || [] };
      let line;
      if (ln.cat === 'labor') {
        const ltrade = ln.ltrade || 'laborer'; const hours = r2(ln.unit === 'hr' ? Number(ln.qty) : (Number(ln.qty) * Number(ln.unitCost)) / LABOR_BASE);
        const { rate, evidence } = laborRateFor(ltrade, settings);
        line = { ...common, cat: 'labor', unit: 'hr', qty: hours, hours, ltrade, unitCost: rate, baseCost: rate, evidence, priceSource: evidence === 'E2' ? 'your rate' : 'starter rate', basis: `${fmtQty(ln.qty)} ${ln.unit}` };
        if (p && p.priceLocked) line = { ...line, unitCost: p.unitCost, evidence: 'E2', priceSource: 'your rate', priceLocked: true };
      } else {
        line = { ...common, cat: ln.cat === 'material' ? 'material' : 'fee', unit: ln.unit, qty: r2(Number(ln.qty) || 0), unitCost: r2(Number(ln.unitCost) || 0), baseCost: r2(Number(ln.unitCost) || 0), evidence: 'E0', priceSource: 'starter price' };
        if (p && p.priceLocked) line = { ...line, unitCost: p.unitCost, evidence: 'E2', priceSource: 'your price', priceLocked: true };
      }
      if (p && p.accepted && p.evidence === line.evidence) line.accepted = true;
      if (p && p.locked) line = { ...line, locked: true, qty: p.qty, hours: line.cat === 'labor' ? p.qty : line.hours, name: p.name };
      out.push(line);
    }
  }
  return { lines: out, needs };
}
const fmtQty = (v) => String(Math.round(Number(v) * 100) / 100);

// ---------------------------------------------------------------- options → Good / Better / Best
/** Which option sits on which tier: the package's own tier when given, otherwise by order (1 → better, 2 → good/better, 3 → all). */
export function tierMap(options) {
  const map = {}; const opts = arr(options);
  for (const o of opts) if (TIER_ORDER.includes(o.tier) && !map[o.tier]) map[o.tier] = o.id;
  const rest = opts.filter((o) => !Object.values(map).includes(o.id));
  const free = (opts.length === 1 ? ['better'] : opts.length === 2 ? ['good', 'better', 'best'] : TIER_ORDER).filter((t) => !map[t]);
  for (const o of rest) { const t = free.shift(); if (t) map[t] = o.id; }
  return map;
}

/** Rebuild every option's lines from the stored package, keeping edits, prices and choices. Puts the active option's lines on the estimate. */
export function rebuildCvsLines(project, settings) {
  const est = project.estimate; const cvs = project.cvs; if (!cvs || !cvs.pkg) return est.items;
  syncActiveCvs(est); const pkg = cvs.pkg; const companySup = cvs.companySupplierId ? suppliersOf(settings).find((s) => s.id === cvs.companySupplierId) || null : null;
  const prevAll = new Map(); for (const lines of Object.values(est.cvsLines || {})) for (const l of lines) prevAll.set(l.key, l);
  for (const l of est.items || []) if (isJobLine(l)) prevAll.set(l.key, l);
  const shared = new Map(); for (const l of prevAll.values()) if (l.cat === 'material' && l.origin === 'cvs' && l.unitCost != null && l.cvsId && /^E[2-5]$/.test(str(l.evidence)) && !l.fromPackage) shared.set(l.cvsId, l);
  const lines = {}; const laborSeparately = !!cvs.priceLaborSeparately;
  for (const opt of arr(pkg.options)) lines[opt.id] = linesForOption(pkg, opt, settings, { laborChoice: cvs.laborChoice || {}, companySup, prev: prevAll, shared, pack: cvs.pack, measurements: project.measurements || pkg.measurements, laborSeparately });
  est.cvsLines = lines;
  const fill = packFillPlan(pkg, project); cvs.needs = fill.needs; cvs.packFill = fill.packs;
  const active = cvs.activeOption && lines[cvs.activeOption] ? cvs.activeOption : arr(pkg.options)[0].id;
  cvs.activeOption = active; est.cvsActive = active;
  est.items = [...(est.items || []).filter((i) => !isJobLine(i)), ...lines[active].map((l) => ({ ...l }))];
  return est.items;
}

/** Swap the CVS lines on an estimate to the option on `tierKey` (used by Good/Better/Best pricing). */
export function swapCvsOption(est, tierKey) {
  const optId = est.tiers && est.tiers.cvsOptions && est.tiers.cvsOptions[tierKey];
  if (!optId || !est.cvsLines || !est.cvsLines[optId]) return est;
  syncActiveCvs(est); est.cvsActive = optId;
  est.items = [...(est.items || []).filter((i) => !isJobLine(i)), ...est.cvsLines[optId].map((l) => ({ ...l }))];
  return est;
}

/** Every CVS line on the job: the visible option from the estimate (it carries the latest edits), the others from storage. */
export function allCvsLines(est) {
  const active = est.cvsActive; const out = (est.items || []).filter(isJobLine);
  for (const [id, lines] of Object.entries(est.cvsLines || {})) if (id !== active) out.push(...lines);
  return out;
}
/** Copy the visible option's lines (with edits) back into storage. */
export function syncActiveCvs(est) { if (est.cvsActive && est.cvsLines && est.cvsLines[est.cvsActive]) est.cvsLines[est.cvsActive] = (est.items || []).filter(isJobLine).map((l) => ({ ...l })); }

// ---------------------------------------------------------------- price readiness (section 7)
/**
 * Lines that stop a proposal from going out: no price, a starter price (E0/E1) not yet accepted, or a line that waits
 * on a measurement the job doesn't have yet (the roof pitch). Order-list materials on a priced-work bid never block:
 * they are not in the client's price.
 */
export function sendReadiness(project) {
  const est = project.estimate; const lines = [...(est.items || []).filter((i) => !isJobLine(i)), ...allCvsLines(est)].filter((i) => !i.orderOnly);
  const unpriced = lines.filter((i) => i.unitCost == null || (isJobLine(i) && !Number.isFinite(Number(i.unitCost))));
  const starter = lines.filter((i) => i.unitCost != null && /^E[01]$/.test(str(i.evidence)) && !i.accepted);
  const have = new Set(arr(project.measurements).map((m) => m.kind));
  const waiting = lines.filter((i) => arr(i.needsMeasure).some((k) => !have.has(k)));
  const kinds = [...new Set(waiting.flatMap((i) => arr(i.needsMeasure)).filter((k) => !have.has(k)))];
  const needLabels = kinds.map((k) => ((project.cvs && arr(project.cvs.needs).find((n) => n.kind === k)) || { label: k }).label.toLowerCase());
  const ok = !unpriced.length && !starter.length && !waiting.length;
  const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  return { ok, unpriced, starter, waiting, needs: kinds, message: ok ? '' : and([unpriced.length ? `${unpriced.length} line${unpriced.length === 1 ? ' needs a price' : 's need a price'}` : '', starter.length ? `${starter.length} starter price${starter.length === 1 ? '' : 's'} to accept or replace` : '', waiting.length ? `${waiting.length} labor line${waiting.length === 1 ? ' waits' : 's wait'} on the ${needLabels.join(' and ')}` : ''].filter(Boolean)) };
}
/** Contractor accepts every remaining starter (E0/E1) price on this job. */
export function acceptStarterPrices(project) {
  const est = project.estimate; let n = 0;
  for (const l of [...(est.items || []).filter((i) => !isJobLine(i)), ...allCvsLines(est)]) if (l.unitCost != null && /^E[01]$/.test(str(l.evidence)) && !l.accepted) { l.accepted = true; n++; }
  return n;
}
/** Price one CVS material (by its CVS id, across every option) as the contractor's own price (E2). */
export function setCvsPrice(project, cvsId, unitCost) {
  const est = project.estimate; const v = unitCost === '' || unitCost == null ? null : r2(Number(unitCost)); let n = 0;
  for (const l of allCvsLines(est)) if (l.origin === 'cvs' && l.cvsId === String(cvsId) && l.cat === 'material') { l.unitCost = v; l.baseCost = v; l.evidence = v == null ? null : 'E2'; l.priceSource = v == null ? 'needs a price' : 'your price'; l.accepted = false; l.fromPackage = false; n++; }
  return n;
}
/** Price one priced-work line (by its key) as the contractor's own price (E2). */
export function setWorkPrice(project, key, unitCost) {
  const v = unitCost === '' || unitCost == null ? null : r2(Number(unitCost)); let n = 0;
  for (const l of allCvsLines(project.estimate)) if (l.key === key && l.cat === 'work') { l.unitCost = v; l.baseCost = v; l.evidence = v == null ? null : 'E2'; l.priceSource = v == null ? 'needs a price' : 'your price'; l.priceLocked = v != null; l.fromPackage = false; n++; }
  return n;
}
export const needsPrice = (l) => l && l.unitCost == null;

// ---------------------------------------------------------------- measurements (section 3.3, 5)
/**
 * Add a measurement to the job; a higher-ranked number wins. Typical-size CVS lines are marked for recompute.
 * With `settings`, a measurement a pack was waiting for (the roof pitch) re-works that pack's labor.
 */
export function addMeasurement(project, m, settings = null) {
  project.measurements = project.measurements || [];
  const r = mergeMeasurement(project.measurements, { kind: m.kind, value: Number(m.value), unit: m.unit || '', source: m.source || 'measured', takenAt: m.takenAt || new Date().toISOString(), note: m.note || '' });
  if ((r.action === 'added' || r.action === 'replaced') && rankOf(m.source || 'measured') >= 5 && project.cvs) {
    const est = project.estimate; let n = 0;
    for (const l of allCvsLines(est)) if (l.typical) { if (!l.recompute) n++; l.recompute = true; }
    project.cvs.recompute = { kinds: [...new Set([...((project.cvs.recompute && project.cvs.recompute.kinds) || []), m.kind])], at: new Date().toISOString() };
    r.marked = n;
  }
  if (settings && project.cvs && project.cvs.pkg && r.action !== 'kept' && r.action !== 'same' && (arr(project.cvs.needs).some((x) => x.kind === m.kind) || arr(project.cvs.packFill).length)) rebuildCvsLines(project, settings);
  return r;
}

// ---------------------------------------------------------------- re-import diff (section 4.6)
const matKey = (m) => ({ item: str(m.item), finish: m.finish == null ? '' : str(m.finish), qty: Number(m.qty) || 0, unit: str(m.unit) });
const workKey = (w) => ({ item: str(w.name), finish: w.detail == null ? '' : str(w.detail), qty: Number(w.qty) || 0, unit: str(w.unit), price: w.price && w.price.unit != null ? Number(w.price.unit) : null });
const noCounter = (id) => String(id).replace(/-\d+$/, '');
/**
 * Pair lines of two exports by id. Ids are stable now (addendum 2, section 3); for older exports whose fixture ids
 * carry a counter, an unmatched line is paired with one of the same area and item (or the same id without the counter).
 */
export function pairLines(oldList, newList, nameOf) {
  const om = new Map(arr(oldList).map((x) => [String(x.id), x])); const nm = new Map(arr(newList).map((x) => [String(x.id), x]));
  const pairs = []; const added = []; const removed = [];
  for (const [id, x] of nm) if (om.has(id)) pairs.push([id, om.get(id), x]);
  const lostOld = [...om.entries()].filter(([id]) => !nm.has(id)); const newOnly = [...nm.entries()].filter(([id]) => !om.has(id));
  const sig = (x) => `${str(x.area)}|${nameOf(x)}`;
  for (const [id, x] of newOnly) {
    const i = lostOld.findIndex(([oid, o]) => noCounter(oid) === noCounter(id) || sig(o) === sig(x));
    if (i >= 0) { const [, o] = lostOld.splice(i, 1)[0]; pairs.push([id, o, x]); } else added.push([id, x]);
  }
  for (const [id, o] of lostOld) removed.push([id, o]);
  return { pairs, added, removed };
}
/** Differences between two packages, per option: added, removed, quantity changed, finish (or work detail) changed, price changed. */
export function diffPackages(oldPkg, newPkg) {
  const out = []; const oldOpts = new Map(arr(oldPkg && oldPkg.options).map((o) => [o.id, o]));
  for (const o of arr(newPkg.options)) {
    const prev = oldOpts.get(o.id);
    if (!prev) { out.push({ type: 'option-added', optionId: o.id, name: str(o.name) }); continue; }
    const mp = pairLines(prev.materials, o.materials, (m) => str(m.item));
    for (const [id, m] of mp.added) out.push({ type: 'added', optionId: o.id, id, cat: 'material', name: str(m.item), to: matKey(m) });
    for (const [id, p, m] of mp.pairs) {
      const a = matKey(p), b = matKey(m);
      if (a.finish !== b.finish || a.item !== b.item) out.push({ type: 'finish', optionId: o.id, id, cat: 'material', name: b.item, from: a.finish || a.item, to: b.finish || b.item, qty: b.qty, unit: b.unit });
      if (a.qty !== b.qty) out.push({ type: 'qty', optionId: o.id, id, cat: 'material', name: b.item + (b.finish ? `, ${b.finish}` : ''), from: a.qty, to: b.qty, unit: b.unit });
    }
    for (const [id, m] of mp.removed) out.push({ type: 'removed', optionId: o.id, id, cat: 'material', name: str(m.item) + (m.finish ? `, ${m.finish}` : ''), from: matKey(m) });
    const wp = pairLines(prev.workItems, o.workItems, (w) => str(w.name));
    for (const [id, w] of wp.added) out.push({ type: 'added', optionId: o.id, id, cat: 'work', name: str(w.name) + (w.detail ? `, ${w.detail}` : ''), to: workKey(w) });
    for (const [id, p, w] of wp.pairs) {
      const a = workKey(p), b = workKey(w); const nm = b.item + (b.finish ? `, ${b.finish}` : '');
      if (a.finish !== b.finish || a.item !== b.item) out.push({ type: 'finish', optionId: o.id, id, cat: 'work', name: b.item, from: a.finish || a.item, to: b.finish || b.item, qty: b.qty, unit: b.unit });
      if (a.qty !== b.qty) out.push({ type: 'qty', optionId: o.id, id, cat: 'work', name: nm, from: a.qty, to: b.qty, unit: b.unit });
      if (a.price !== b.price) out.push({ type: 'price', optionId: o.id, id, cat: 'work', name: nm, from: a.price, to: b.price, unit: b.unit });
    }
    for (const [id, w] of wp.removed) out.push({ type: 'removed', optionId: o.id, id, cat: 'work', name: str(w.name) + (w.detail ? `, ${w.detail}` : ''), from: workKey(w) });
    const lp = pairLines(prev.labor, o.labor, (l) => `${str(l.trade)}|${str(l.name)}`);
    for (const [id, l] of lp.added) out.push({ type: 'added', optionId: o.id, id, cat: 'labor', name: str(l.name) });
    for (const [id, p, l] of lp.pairs) if (JSON.stringify(arr(p.hours)) !== JSON.stringify(arr(l.hours)) || Number(p.units || 1) !== Number(l.units || 1)) out.push({ type: 'hours', optionId: o.id, id, cat: 'labor', name: str(l.name), from: arr(p.hours), to: arr(l.hours) });
    for (const [id, l] of lp.removed) out.push({ type: 'removed', optionId: o.id, id, cat: 'labor', name: str(l.name) });
  }
  for (const [id, o] of oldOpts) if (!arr(newPkg.options).some((x) => x.id === id)) out.push({ type: 'option-removed', optionId: id, name: str(o.name) });
  return out;
}
export function describeDiff(d) {
  if (d.type === 'added') return `Added: ${d.name}`;
  if (d.type === 'removed') return `Removed: ${d.name}`;
  if (d.type === 'finish') return `${d.name}: ${d.from || '(none)'} → ${d.to || '(none)'}`;
  if (d.type === 'qty') return `${d.name}: quantity ${d.from} → ${d.to} ${d.unit}`;
  if (d.type === 'hours') return `${d.name}: hours ${d.from.join('–')} → ${d.to.join('–')}`;
  if (d.type === 'price') return `${d.name}: price ${d.from == null ? '(none)' : `$${d.from}`} → ${d.to == null ? '(none)' : `$${d.to}`} per ${d.unit}`;
  if (d.type === 'option-added') return `New option: ${d.name}`;
  if (d.type === 'option-removed') return `Option removed: ${d.name}`;
  return d.type;
}

/** The signed option's id (the tier the client chose, or the active option). */
export function signedOptionId(project) {
  const est = project.estimate; const chosen = est.tiers && est.tiers.chosen;
  return (chosen && est.tiers.cvsOptions && est.tiers.cvsOptions[chosen]) || (project.cvs && project.cvs.activeOption);
}

/** After signing, design changes become a change-order draft: removed lines as credits, added as charges, finish swaps as a swap line. */
export function changeOrderFromDiff(project, newPkg, diffs, settings) {
  const est = project.estimate; syncActiveCvs(est); const optId = signedOptionId(project);
  const signedLines = new Map(((est.cvsLines && est.cvsLines[optId]) || est.items.filter(isJobLine)).map((l) => [l.key, l]));
  const newOpt = arr(newPkg.options).find((o) => o.id === optId);
  const companySup = project.cvs.companySupplierId ? suppliersOf(settings).find((s) => s.id === project.cvs.companySupplierId) || null : null;
  const fresh = newOpt ? new Map(linesForOption(newPkg, newOpt, settings, { laborChoice: project.cvs.laborChoice || {}, companySup, prev: signedLines, pack: project.cvs.pack, measurements: project.measurements, laborSeparately: !!project.cvs.priceLaborSeparately }).map((l) => [l.key, l])) : new Map();
  const items = [];
  const base = (l, extra) => ({ id: `co|${Math.random().toString(36).slice(2, 9)}`, key: '', origin: 'cvs', cvsId: l.cvsId, cat: l.cat, name: l.name, unit: l.unit, unitText: l.unitText, qty: l.qty, unitCost: l.unitCost, evidence: l.evidence, priceSource: l.priceSource, supplierId: l.supplierId || null, noOrder: !!l.noOrder, taxable: l.cat === 'material', hours: l.cat === 'labor' ? l.hours : 0, ltrade: l.ltrade, ...extra });
  const pre = { labor: 'l', work: 'w', material: 'm' };
  for (const d of diffs.filter((x) => x.optionId === optId)) {
    const k = `cvs|${optId}|${pre[d.cat] || 'm'}|${d.id}`; const old = signedLines.get(k); const nu = fresh.get(k);
    if ((old && old.orderOnly) || (nu && nu.orderOnly)) continue; // order-list materials on a priced-work bid don't change the price
    if (d.type === 'added' && nu) items.push(base(nu, { note: 'Added in the design' }));
    else if (d.type === 'removed' && old) items.push(base(old, { qty: -Math.abs(old.qty), hours: old.cat === 'labor' ? -Math.abs(old.hours || 0) : 0, name: `Credit: ${old.name}`, note: 'Removed from the design' }));
    else if (d.type === 'qty' && nu && old) items.push(base(nu, { qty: r2(d.to - d.from), name: `${nu.name} (quantity ${d.from} → ${d.to})`, unitCost: old.unitCost, evidence: old.evidence, note: 'Quantity changed in the design' }));
    else if (d.type === 'finish' && nu && old) items.push(base(nu, { qty: nu.qty, name: `Swap: ${d.from || old.name} → ${d.to}`, ...(nu.unitCost != null && old.unitCost != null && nu.evidence && /^E[2-5]$/.test(nu.evidence) ? { unitCost: r2(nu.unitCost - old.unitCost), evidence: nu.evidence, priceSource: 'difference in your prices' } : { unitCost: null, evidence: null, priceSource: 'needs a price' }), note: `Price the difference per ${nu.unit}` }));
    else if (d.type === 'price' && nu && old) items.push(base(nu, { qty: nu.qty, name: `${nu.name} (price ${d.from == null ? 'none' : d.from} → ${d.to == null ? 'none' : d.to} per ${nu.unit})`, unitCost: d.from != null && d.to != null ? r2(d.to - d.from) : null, evidence: d.to != null ? nu.evidence : null, priceSource: d.to != null ? nu.priceSource : 'needs a price', note: 'Price changed on your bid' }));
    else if (d.type === 'hours' && nu && old) items.push(base(nu, { qty: r2(nu.qty - old.qty), hours: r2((nu.hours || 0) - (old.hours || 0)), unitCost: old.unitCost, name: `${nu.name} (hours changed)`, note: 'Hours changed in the design' }));
  }
  return { id: Math.random().toString(36).slice(2, 9), n: (project.changeOrders || []).reduce((m, c) => Math.max(m, c.n), 0) + 1, title: `Design change: ${str(newPkg.design && newPkg.design.title)}`.slice(0, 120), reason: 'The design was updated after the contract was signed. These lines are the differences.', photo: '', items, status: 'draft', scheduleDays: 0, credit: false, origin: 'cvs', createdAt: new Date().toISOString() };
}

// ---------------------------------------------------------------- building a job
function measurementsInto(project, pkg) {
  project.measurements = project.measurements || []; const results = [];
  for (const m of arr(pkg.measurements)) if (m && m.kind) results.push({ kind: m.kind, ...mergeMeasurement(project.measurements, { kind: m.kind, value: Number(m.value), unit: str(m.unit), source: str(m.source) || 'estimate', from: 'cvs' }) });
  return results;
}
function tiersFor(pkg, prevTiers) {
  const opts = arr(pkg.options); if (opts.length < 2) return prevTiers && prevTiers.chosen ? prevTiers : null;
  const map = tierMap(opts); const names = {}, blurbs = {};
  for (const [t, id] of Object.entries(map)) { const o = opts.find((x) => x.id === id); names[t] = str(o.name) || t; blurbs[t] = arr(o.notes).map(str)[0] || ''; }
  return { ...(prevTiers || {}), on: true, names: { good: 'Good', better: 'Better', best: 'Best', ...names }, blurbs, overrides: { good: { a: {}, p: {} }, best: { a: {}, p: {} } }, cvsOptions: map, addons: [] };
}
function cvsRecord(pkg, plan, prev = {}) {
  const d = pkg.design || {};
  return {
    ...prev, designId: String(d.id), module: str(pkg.source && pkg.source.module), pack: plan.preview.pack, appVersion: str(pkg.source && pkg.source.appVersion), createdAt: str(pkg.source && pkg.source.createdAt),
    company: { id: pkg.company && pkg.company.id || null, name: str(pkg.company && pkg.company.name), role: str(pkg.company && pkg.company.role) }, conceptNotice: pkg.company && pkg.company.conceptNotice != null ? String(pkg.company.conceptNotice) : null,
    design: { title: str(d.title), summary: str(d.summary), url: d.url || null, pictures: arr(d.pictures).map((p) => ({ url: str(p.url), kind: str(p.kind), caption: str(p.caption) })), scope: arr(d.scope).map(str), notes: arr(d.notes).map(str) },
    options: arr(pkg.options).map((o) => ({ id: o.id, name: str(o.name), tier: o.tier || null, band: o.band || null, picture: o.picture || null, shoppingList: arr(o.shoppingList), priceBookRefs: arr(o.priceBookRefs), notes: arr(o.notes).map(str), total: o.total != null && Number.isFinite(Number(o.total)) ? Number(o.total) : null, workItems: arr(o.workItems).length, checklist: arr(o.checklist).filter((c) => c && c.id && c.text).map((c) => ({ id: str(c.id), text: str(c.text), phase: str(c.phase), for: c.for == null ? null : str(c.for) })) })),
    replaces: (PACK_MAP[plan.preview.pack] && PACK_MAP[plan.preview.pack].meta.cvsReplaces) || [],
    pkg, companySupplierId: plan.companySupplier ? plan.companySupplier.id : null, laborChoice: prev.laborChoice || {}, activeOption: prev.activeOption || null, priceLaborSeparately: !!prev.priceLaborSeparately,
    importedAt: new Date().toISOString(), revisions: [...(prev.revisions || []), { at: new Date().toISOString(), changes: plan.diff ? plan.diff.length : 0 }],
  };
}

/**
 * The one way in. Validates, then returns a plan to show the contractor; nothing is created until apply().
 * state: { settings, projects }. Result: { ok:false, error } | { ok:true, preview, mode: 'new'|'update'|'change-order', existing, diff, apply(state) }
 */
export function importCvsPackage(obj, state) {
  const v = validatePackage(obj); if (!v.ok) return v;
  const pkg = v.pkg; const settings = state.settings; const preview = previewPackage(pkg);
  const existing = (state.projects || []).find((p) => p.cvs && p.cvs.designId === String(pkg.design.id)) || null;
  // a supplier's package names that supplier; a contractor's own package never makes the contractor its own supplier
  const cs = !isContractorPkg(pkg) && (pkg.company && pkg.company.role === 'supplier' || arr(pkg.options).some((o) => arr(o.materials).some((m) => m.from === 'supplier'))) ? companySupplier(settings, pkg.company) : { supplier: null, created: false };
  const diff = existing ? diffPackages(existing.cvs.pkg, pkg) : null;
  const signed = !!(existing && existing.estimate.signature);
  const plan = { ok: true, pkg, preview, existing, diff, mode: existing ? (signed ? 'change-order' : 'update') : 'new', companySupplier: cs.supplier, createsSupplier: cs.created };
  plan.apply = (st, { keepEdits = true, newProject } = {}) => applyPlan(plan, st, { keepEdits, newProject });
  return plan;
}

function ensureSupplier(plan, settings) {
  if (!plan.createsSupplier || !plan.companySupplier) return;
  const list = Array.isArray(settings.suppliers) && settings.suppliers.length ? settings.suppliers : (settings.suppliers = suppliersOf(settings).map((s) => ({ ...s })));
  if (!list.some((s) => s.id === plan.companySupplier.id)) list.push({ ...plan.companySupplier });
}

function applyPlan(plan, state, { keepEdits, newProject }) {
  const settings = state.settings; const pkg = plan.pkg; ensureSupplier(plan, settings);
  if (plan.mode === 'change-order') {
    const p = plan.existing; const co = changeOrderFromDiff(p, pkg, plan.diff, settings);
    p.changeOrders = p.changeOrders || []; p.changeOrders.push(co);
    p.cvs.pendingPkg = pkg; // the signed design stays the contract until the change order is approved
    return { project: p, changeOrder: co };
  }
  if (plan.mode === 'update') {
    const p = plan.existing; const prevCvs = p.cvs;
    if (!keepEdits) { for (const l of allCvsLines(p.estimate)) if (l.locked) { delete l.locked; delete l.edited; } }
    p.cvs = cvsRecord(pkg, plan, prevCvs); measurementsInto(p, pkg); p.estimate.cvsReplaces = p.cvs.replaces;
    const t = tiersFor(pkg, p.estimate.tiers); if (t) p.estimate.tiers = t; else if (p.estimate.tiers && p.estimate.tiers.cvsOptions) p.estimate.tiers = { ...p.estimate.tiers, on: false, cvsOptions: null };
    if (!arr(pkg.options).some((o) => o.id === p.cvs.activeOption)) p.cvs.activeOption = null;
    rebuildCvsLines(p, settings); p.updatedAt = new Date().toISOString();
    return { project: p };
  }
  const p = newProject ? newProject() : blankProject(state);
  const c = pkg.customer || null; const d = pkg.design || {};
  p.name = str(d.title) || p.name; if (c) p.client = { ...p.client, name: str(c.name), address: str(c.address), email: str(c.email), phone: str(c.phone) };
  p.photos = p.photos || []; p.cvs = cvsRecord(pkg, plan); measurementsInto(p, pkg);
  p.estimate.scopeText = arr(d.scope).map(str).join('\n'); p.estimate.notes = [str(d.summary), ...arr(d.notes).map(str)].filter(Boolean).join('\n');
  p.estimate.cvsReplaces = p.cvs.replaces; p.estimate.assemblies = (p.estimate.assemblies || []).filter((a) => !p.cvs.replaces.includes(a.key));
  const t = tiersFor(pkg, null); if (t) p.estimate.tiers = t;
  const mid = t ? t.cvsOptions.better || Object.values(t.cvsOptions)[0] : null; p.cvs.activeOption = mid || arr(pkg.options)[0].id;
  rebuildCvsLines(p, settings);
  return { project: p };
}
function blankProject(state) {
  const p = { id: Math.random().toString(36).slice(2, 10), name: 'Design job', client: { name: '', address: '', phone: '', email: '' }, folder: '', status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rooms: [], photos: [], changeOrders: [], estimate: { number: 'EST-CVS', date: new Date().toISOString(), validDays: 30, scopeText: '', assemblies: [], items: [], removedKeys: [], notes: '', adj: {}, products: [], terms: '', signature: null, sentAt: null, invoice: null } };
  state.projects = state.projects || []; state.projects.unshift(p); return p;
}

/** After a design change order is approved, the new design becomes the job's design. */
export function adoptPendingDesign(project, settings) {
  if (!project.cvs || !project.cvs.pendingPkg) return false;
  const pkg = project.cvs.pendingPkg; delete project.cvs.pendingPkg;
  project.cvs.pkg = pkg; rebuildCvsLines(project, settings); return true;
}

/** Labor level or sub lump sum for one trade, then rebuild. choice: 'low' | 'mid' | 'high' | { sub: amount, name } */
export function setLaborChoice(project, trade, choice, settings) {
  project.cvs.laborChoice = { ...(project.cvs.laborChoice || {}), [trade]: choice }; rebuildCvsLines(project, settings);
}
export function setActiveOption(project, optId, settings) { project.cvs.activeOption = optId; rebuildCvsLines(project, settings); }
/** Per job: add the pack's own labor on top of priced work items (off by default: the installed price covers labor). */
export function setPriceLaborSeparately(project, on, settings) { project.cvs.priceLaborSeparately = !!on; rebuildCvsLines(project, settings); }
export const hasWorkItems = (project) => arr(project.cvs && project.cvs.pkg && project.cvs.pkg.options).some((o) => arr(o.workItems).length > 0);

/**
 * Each option's price in Fullbid beside the total on the contractor's own bid (option.total). Fullbid's price is before
 * tax, priced the way this estimate prices. warn: they differ by more than 1%.
 */
export function optionPrices(project, totalsFn) {
  const est = project.estimate; syncActiveCvs(est); const other = (est.items || []).filter((i) => !isJobLine(i));
  return arr(project.cvs && project.cvs.options).map((o) => {
    const lines = (est.cvsLines && est.cvsLines[o.id]) || [];
    const ours = Math.round(totalsFn({ items: [...other, ...lines], adj: est.adj || {} }).preTax * 100) / 100;
    const theirs = o.total; const diff = theirs == null ? null : Math.round((ours - theirs) * 100) / 100;
    const pct = theirs ? Math.abs(diff) / Math.abs(theirs) * 100 : diff ? 100 : 0;
    return { id: o.id, name: o.name, ours, theirs, diff, pct: theirs == null ? null : Math.round(pct * 100) / 100, warn: theirs != null && pct > 1 };
  });
}
export const cvsTrades = (project) => [...new Set(arr(project.cvs && project.cvs.pkg && project.cvs.pkg.options).flatMap((o) => arr(o.labor).map((l) => str(l.trade) || 'carpentry')))];

// ---------------------------------------------------------------- transport (section 4.2)
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const b64url = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
/** The same encoding as share links: 'd:' + base64url(deflate-raw(JSON)), or 'j:' + base64url(JSON). */
export async function encodeCvsPackage(obj) {
  const text = JSON.stringify(obj);
  if (typeof CompressionStream === 'function') { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(text)); w.close(); return 'd:' + b64url(await new Response(cs.readable).arrayBuffer()); }
  return 'j:' + b64url(new TextEncoder().encode(text));
}
export async function decodeCvsPayload(enc) {
  enc = decodeURIComponent(enc); const bytes = unb64url(enc.slice(2)); let text;
  if (enc.startsWith('d:')) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); text = await new Response(ds.readable).text(); }
  else if (enc.startsWith('j:')) text = new TextDecoder().decode(bytes);
  else throw new Error('This design link is not complete.');
  return JSON.parse(text);
}
/** Origins #cvs-url= links may load from: the defaults (CVS on Vercel) plus any the contractor added. */
export const cvsOrigins = (settings) => { const o = settings && settings.cvs && settings.cvs.origins; return [...new Set([...DEFAULT_CVS_ORIGINS, ...(Array.isArray(o) ? o.filter((x) => typeof x === 'string' && x) : [])])]; };
export function originAllowed(url, settings) {
  let u; try { u = new URL(url); } catch { return false; }
  return u.protocol === 'https:' && cvsOrigins(settings).some((o) => { try { return new URL(o).origin === u.origin; } catch { return false; } });
}
/** Read a package from a #cvs= or #cvs-url= hash. Returns { obj } | { error } | null when the hash has neither. */
export async function packageFromHash(hash, settings, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  const h = String(hash || '');
  const inl = /[#&]cvs=([^&]+)/.exec(h);
  if (inl) { try { return { obj: await decodeCvsPayload(inl[1]) }; } catch { return { error: 'This design link could not be read. Ask the designer to send it again.' }; } }
  // the package URL may carry its own query (?id=…&token=…), so it runs to the end of the hash; encoded or not
  const ref = /[#&]cvs-url=(.+)$/.exec(h);
  if (ref) {
    let url = ref[1]; if (/^https?%3A/i.test(url)) { try { url = decodeURIComponent(url); } catch { /* keep as sent */ } }
    if (!originAllowed(url, settings)) return { error: 'This design link points to a site Fullbid does not take designs from.' };
    try { const r = await fetchImpl(url, { headers: { accept: 'application/json' } }); if (!r.ok) return { error: `The design could not be loaded (${r.status}).` }; return { obj: await r.json() }; }
    catch { return { error: 'The design could not be loaded. Check the connection and try again.' }; }
  }
  return null;
}

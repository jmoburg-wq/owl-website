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
  return { ok: true, pkg: obj };
}

// ---------------------------------------------------------------- preview
export function previewPackage(pkg) {
  const opts = arr(pkg.options);
  const matIds = new Set(), labIds = new Set(), typIds = new Set();
  for (const o of opts) {
    for (const m of arr(o.materials)) { matIds.add(m.id); if (m.typical) typIds.add(m.id); }
    for (const l of arr(o.labor)) labIds.add(l.id);
  }
  const title = str(pkg.design && pkg.design.title) || 'Untitled design';
  const company = str(pkg.company && pkg.company.name) || 'a CVS designer';
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const pack = projectPack(pkg);
  const text = `Import '${title}' from ${company}: ${n(matIds.size, 'material')}, ${n(labIds.size, 'labor item')}, ${n(opts.length, 'option')}.` + (typIds.size ? ` ${typIds.size} line${typIds.size === 1 ? ' uses' : 's use'} typical sizes.` : '');
  return { title, company, materials: matIds.size, labor: labIds.size, options: opts.length, typical: typIds.size, pack, packName: (PACK_MAP[pack] && PACK_MAP[pack].meta.name) || 'General', module: str(pkg.source && pkg.source.module), text };
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
/** Find the supplier record for the package's company by name, or describe one to create. */
export function companySupplier(settings, company) {
  const name = str(company && company.name).trim(); if (!name) return { supplier: null, created: false };
  const lc = name.toLowerCase();
  const found = suppliersOf(settings).find((s) => [s.name, s.short].some((x) => str(x).toLowerCase() === lc) || (company.id && s.cvsCompanyId === company.id));
  if (found) return { supplier: found, created: false };
  return { supplier: { id: `cvs-${slugify(name) || 'company'}`, name, short: name, domain: '', classes: [], factor: 1, delivery: 0, notes: 'Added from a design package', cvsCompanyId: company.id || null }, created: true };
}
function homeCenterFor(settings, cls) {
  const pref = supplierFor(settings, cls); if (isHomeCenter(pref)) return pref;
  return suppliersOf(settings).find(isHomeCenter) || pref;
}
/** Where a line is bought → { supplierId, noOrder, needsSupplier, fromNote }. */
export function supplierForLine(m, cls, settings, companySup) {
  const from = str(m.from) || 'contractor';
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
  const p = m.price;
  if (p && Number.isFinite(Number(p.unit)) && /^E[0-5]$/.test(str(p.tier))) return { unitCost: r2(Number(p.unit)), evidence: p.tier, priceSource: p.source || 'design package', priceAt: p.seenOn || null };
  return { unitCost: null, evidence: null, priceSource: 'needs a price' };
}

// ---------------------------------------------------------------- mapping (section 4.5)
export const LEVELS = ['low', 'mid', 'high'];
const hoursAt = (h, level) => { const lo = Number(h && h[0]) || 0, hi = Number(h && h[1] != null ? h[1] : lo) || 0; return level === 'low' ? lo : level === 'high' ? hi : (lo + hi) / 2; };
export const tradeLabel = (t) => (SHARED_TRADES[t] && SHARED_TRADES[t].label) || (LABOR_TRADES[fullbidTrade(t)] || {}).label || str(t);

/**
 * Lines for one package option. `prev` (key → previous line) keeps the contractor's edits and prices;
 * `shared` (cvsId → priced line) lets a price typed on one option fill the same material in the others.
 */
export function linesForOption(pkg, opt, settings, { laborChoice = {}, companySup = null, prev = new Map(), shared = new Map(), pack = projectPack(pkg) } = {}) {
  const out = [];
  for (const m of arr(opt.materials)) {
    const key = `cvs|${opt.id}|m|${m.id}`;
    const cls = classForGroup(m.group, m.item);
    const sup = supplierForLine(m, cls, settings, companySup);
    const name = str(m.item) + (m.finish ? `, ${m.finish}` : '');
    const base = {
      id: key, key, origin: 'cvs', cvsId: String(m.id), cvsOption: opt.id, custom: true, cat: 'material',
      assembly: 'cvs', assemblyName: str(m.group) || 'Design materials', trade: str(m.group) || 'Design materials',
      pack: m.area ? packForModule(str(pkg.source && pkg.source.module), `${str(m.area)} ${str(m.group)}`) : pack,
      roomId: null, roomName: str(m.area), name, item: str(m.item), finish: m.finish == null ? '' : str(m.finish), maker: m.maker == null ? '' : str(m.maker), collection: m.collection == null ? '' : str(m.collection),
      sku: m.sku == null ? '' : str(m.sku), qty: Number(m.qty) || 0, unit: unitFromText(m.unit), unitText: str(m.unit), cls, ...sup,
      note: m.how == null ? '' : str(m.how), notes: arr(m.notes).map(str), typical: !!m.typical, designItem: !!m.designItem, group: str(m.group), from: str(m.from) || 'contractor', fromLabel: m.fromLabel == null ? '' : str(m.fromLabel),
      taxable: true, supplierPinned: !!sup.supplierId,
    };
    const p = prev.get(key);
    const priced = p && p.unitCost != null && p.evidence !== null ? { unitCost: p.unitCost, evidence: p.evidence, priceSource: p.priceSource } : priceMaterial(base, m, settings, shared.get(String(m.id)));
    let line = { ...base, ...priced, baseCost: priced.unitCost };
    if (p) {
      if (p.accepted) line.accepted = true;
      if (p.supplierPinned && p.supplierId && p.supplierId !== line.supplierId && !line.noOrder) line.supplierId = p.supplierId;
      if (p.locked) line = { ...line, locked: true, qty: p.qty, name: p.name, unit: p.unit, note: p.note, edited: p.edited || { qty: p.qty, name: p.name } };
      if (p.recompute) line.recompute = true;
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
      let line = { id: key, key, origin: 'cvs', cvsId: String(l.id), cvsOption: opt.id, cvsTrade: trade, custom: true, cat: 'labor', assembly: 'cvs', assemblyName: 'Labor', trade: 'Labor', roomId: null, roomName: str(l.area), name: str(l.name) || tradeLabel(trade), unit: 'hr', qty: hours, hours, hoursRange: arr(l.hours).map(Number), units, level, ltrade, unitCost: rate, baseCost: rate, evidence, priceSource: evidence === 'E2' ? 'your rate' : 'starter rate', note: l.why == null ? '' : str(l.why), size: l.size == null ? '' : str(l.size), taxable: false };
      if (p) { if (p.accepted && p.evidence === line.evidence) line.accepted = true; if (p.priceLocked) line = { ...line, unitCost: p.unitCost, evidence: 'E2', priceSource: 'your rate', priceLocked: true }; }
      out.push(line);
    }
  }
  return out;
}

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
  for (const l of est.items || []) if (l.origin === 'cvs') prevAll.set(l.key, l);
  const shared = new Map(); for (const l of prevAll.values()) if (l.cat === 'material' && l.unitCost != null && l.cvsId && /^E[2-5]$/.test(str(l.evidence))) shared.set(l.cvsId, l);
  const lines = {};
  for (const opt of arr(pkg.options)) lines[opt.id] = linesForOption(pkg, opt, settings, { laborChoice: cvs.laborChoice || {}, companySup, prev: prevAll, shared, pack: cvs.pack });
  est.cvsLines = lines;
  const active = cvs.activeOption && lines[cvs.activeOption] ? cvs.activeOption : arr(pkg.options)[0].id;
  cvs.activeOption = active; est.cvsActive = active;
  est.items = [...(est.items || []).filter((i) => i.origin !== 'cvs'), ...lines[active].map((l) => ({ ...l }))];
  return est.items;
}

/** Swap the CVS lines on an estimate to the option on `tierKey` (used by Good/Better/Best pricing). */
export function swapCvsOption(est, tierKey) {
  const optId = est.tiers && est.tiers.cvsOptions && est.tiers.cvsOptions[tierKey];
  if (!optId || !est.cvsLines || !est.cvsLines[optId]) return est;
  syncActiveCvs(est); est.cvsActive = optId;
  est.items = [...(est.items || []).filter((i) => i.origin !== 'cvs'), ...est.cvsLines[optId].map((l) => ({ ...l }))];
  return est;
}

/** Every CVS line on the job: the visible option from the estimate (it carries the latest edits), the others from storage. */
export function allCvsLines(est) {
  const active = est.cvsActive; const out = (est.items || []).filter((i) => i.origin === 'cvs');
  for (const [id, lines] of Object.entries(est.cvsLines || {})) if (id !== active) out.push(...lines);
  return out;
}
/** Copy the visible option's lines (with edits) back into storage. */
export function syncActiveCvs(est) { if (est.cvsActive && est.cvsLines && est.cvsLines[est.cvsActive]) est.cvsLines[est.cvsActive] = (est.items || []).filter((i) => i.origin === 'cvs').map((l) => ({ ...l })); }

// ---------------------------------------------------------------- price readiness (section 7)
/** Lines that stop a proposal from going out: no price, or a starter price (E0/E1) not yet accepted. */
export function sendReadiness(project) {
  const est = project.estimate; const lines = [...(est.items || []).filter((i) => i.origin !== 'cvs'), ...allCvsLines(est)];
  const unpriced = lines.filter((i) => i.unitCost == null || (i.origin === 'cvs' && !Number.isFinite(Number(i.unitCost))));
  const starter = lines.filter((i) => i.unitCost != null && /^E[01]$/.test(str(i.evidence)) && !i.accepted);
  return { ok: !unpriced.length && !starter.length, unpriced, starter, message: !unpriced.length && !starter.length ? '' : [unpriced.length ? `${unpriced.length} line${unpriced.length === 1 ? ' needs a price' : 's need a price'}` : '', starter.length ? `${starter.length} starter price${starter.length === 1 ? '' : 's'} to accept or replace` : ''].filter(Boolean).join(' and ') };
}
/** Contractor accepts every remaining starter (E0/E1) price on this job. */
export function acceptStarterPrices(project) {
  const est = project.estimate; let n = 0;
  for (const l of [...(est.items || []).filter((i) => i.origin !== 'cvs'), ...allCvsLines(est)]) if (l.unitCost != null && /^E[01]$/.test(str(l.evidence)) && !l.accepted) { l.accepted = true; n++; }
  return n;
}
/** Price one CVS material (by its CVS id, across every option) as the contractor's own price (E2). */
export function setCvsPrice(project, cvsId, unitCost) {
  const est = project.estimate; const v = unitCost === '' || unitCost == null ? null : r2(Number(unitCost)); let n = 0;
  for (const l of allCvsLines(est)) if (l.cvsId === String(cvsId) && l.cat === 'material') { l.unitCost = v; l.baseCost = v; l.evidence = v == null ? null : 'E2'; l.priceSource = v == null ? 'needs a price' : 'your price'; l.accepted = false; n++; }
  return n;
}
export const needsPrice = (l) => l && l.unitCost == null;

// ---------------------------------------------------------------- measurements (section 3.3, 5)
/** Add a measurement to the job; a higher-ranked number wins. Typical-size CVS lines are marked for recompute. */
export function addMeasurement(project, m) {
  project.measurements = project.measurements || [];
  const r = mergeMeasurement(project.measurements, { kind: m.kind, value: Number(m.value), unit: m.unit || '', source: m.source || 'measured', takenAt: m.takenAt || new Date().toISOString(), note: m.note || '' });
  if ((r.action === 'added' || r.action === 'replaced') && rankOf(m.source || 'measured') >= 5 && project.cvs) {
    const est = project.estimate; let n = 0;
    for (const l of allCvsLines(est)) if (l.typical) { if (!l.recompute) n++; l.recompute = true; }
    project.cvs.recompute = { kinds: [...new Set([...((project.cvs.recompute && project.cvs.recompute.kinds) || []), m.kind])], at: new Date().toISOString() };
    r.marked = n;
  }
  return r;
}

// ---------------------------------------------------------------- re-import diff (section 4.6)
const matKey = (m) => ({ item: str(m.item), finish: m.finish == null ? '' : str(m.finish), qty: Number(m.qty) || 0, unit: str(m.unit) });
/** Differences between two packages, per option: added, removed, qty changed, finish changed. */
export function diffPackages(oldPkg, newPkg) {
  const out = []; const oldOpts = new Map(arr(oldPkg && oldPkg.options).map((o) => [o.id, o]));
  for (const o of arr(newPkg.options)) {
    const prev = oldOpts.get(o.id);
    if (!prev) { out.push({ type: 'option-added', optionId: o.id, name: str(o.name) }); continue; }
    const pm = new Map(arr(prev.materials).map((m) => [String(m.id), m])); const nm = new Map(arr(o.materials).map((m) => [String(m.id), m]));
    for (const [id, m] of nm) {
      const p = pm.get(id);
      if (!p) { out.push({ type: 'added', optionId: o.id, id, cat: 'material', name: str(m.item), to: matKey(m) }); continue; }
      const a = matKey(p), b = matKey(m);
      if (a.finish !== b.finish || a.item !== b.item) out.push({ type: 'finish', optionId: o.id, id, cat: 'material', name: b.item, from: a.finish || a.item, to: b.finish || b.item, qty: b.qty, unit: b.unit });
      if (a.qty !== b.qty) out.push({ type: 'qty', optionId: o.id, id, cat: 'material', name: b.item + (b.finish ? `, ${b.finish}` : ''), from: a.qty, to: b.qty, unit: b.unit });
    }
    for (const [id, m] of pm) if (!nm.has(id)) out.push({ type: 'removed', optionId: o.id, id, cat: 'material', name: str(m.item) + (m.finish ? `, ${m.finish}` : ''), from: matKey(m) });
    const pl = new Map(arr(prev.labor).map((l) => [String(l.id), l])); const nl = new Map(arr(o.labor).map((l) => [String(l.id), l]));
    for (const [id, l] of nl) { const p = pl.get(id); if (!p) out.push({ type: 'added', optionId: o.id, id, cat: 'labor', name: str(l.name) }); else if (JSON.stringify(arr(p.hours)) !== JSON.stringify(arr(l.hours)) || Number(p.units || 1) !== Number(l.units || 1)) out.push({ type: 'hours', optionId: o.id, id, cat: 'labor', name: str(l.name), from: arr(p.hours), to: arr(l.hours) }); }
    for (const [id, l] of pl) if (!nl.has(id)) out.push({ type: 'removed', optionId: o.id, id, cat: 'labor', name: str(l.name) });
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
  const signedLines = new Map(((est.cvsLines && est.cvsLines[optId]) || est.items.filter((i) => i.origin === 'cvs')).map((l) => [l.key, l]));
  const newOpt = arr(newPkg.options).find((o) => o.id === optId);
  const companySup = project.cvs.companySupplierId ? suppliersOf(settings).find((s) => s.id === project.cvs.companySupplierId) || null : null;
  const fresh = newOpt ? new Map(linesForOption(newPkg, newOpt, settings, { laborChoice: project.cvs.laborChoice || {}, companySup, prev: signedLines, pack: project.cvs.pack }).map((l) => [l.key, l])) : new Map();
  const items = [];
  const base = (l, extra) => ({ id: `co|${Math.random().toString(36).slice(2, 9)}`, key: '', origin: 'cvs', cvsId: l.cvsId, cat: l.cat, name: l.name, unit: l.unit, unitText: l.unitText, qty: l.qty, unitCost: l.unitCost, evidence: l.evidence, priceSource: l.priceSource, supplierId: l.supplierId || null, noOrder: !!l.noOrder, taxable: l.cat === 'material', hours: l.cat === 'labor' ? l.hours : 0, ltrade: l.ltrade, ...extra });
  for (const d of diffs.filter((x) => x.optionId === optId)) {
    const k = `cvs|${optId}|${d.cat === 'labor' ? 'l' : 'm'}|${d.id}`; const old = signedLines.get(k); const nu = fresh.get(k);
    if (d.type === 'added' && nu) items.push(base(nu, { note: 'Added in the design' }));
    else if (d.type === 'removed' && old) items.push(base(old, { qty: -Math.abs(old.qty), hours: old.cat === 'labor' ? -Math.abs(old.hours || 0) : 0, name: `Credit: ${old.name}`, note: 'Removed from the design' }));
    else if (d.type === 'qty' && nu && old) items.push(base(nu, { qty: r2(d.to - d.from), name: `${nu.name} (quantity ${d.from} → ${d.to})`, unitCost: old.unitCost, evidence: old.evidence, note: 'Quantity changed in the design' }));
    else if (d.type === 'finish' && nu && old) items.push(base(nu, { qty: nu.qty, name: `Swap: ${d.from || old.name} → ${d.to}`, unitCost: nu.unitCost != null && old.unitCost != null && nu.evidence && /^E[2-5]$/.test(nu.evidence) ? r2(nu.unitCost - old.unitCost) : null, evidence: null, priceSource: 'needs a price', note: `Price the difference per ${nu.unit}` }));
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
    options: arr(pkg.options).map((o) => ({ id: o.id, name: str(o.name), tier: o.tier || null, band: o.band || null, picture: o.picture || null, shoppingList: arr(o.shoppingList), priceBookRefs: arr(o.priceBookRefs), notes: arr(o.notes).map(str) })),
    replaces: (PACK_MAP[plan.preview.pack] && PACK_MAP[plan.preview.pack].meta.cvsReplaces) || [],
    pkg, companySupplierId: plan.companySupplier ? plan.companySupplier.id : null, laborChoice: prev.laborChoice || {}, activeOption: prev.activeOption || null,
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
  const cs = pkg.company && pkg.company.role === 'supplier' || arr(pkg.options).some((o) => arr(o.materials).some((m) => m.from === 'supplier')) ? companySupplier(settings, pkg.company) : { supplier: null, created: false };
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
export const cvsOrigins = (settings) => { const o = settings && settings.cvs && settings.cvs.origins; return Array.isArray(o) && o.length ? o : DEFAULT_CVS_ORIGINS; };
export function originAllowed(url, settings) {
  let u; try { u = new URL(url); } catch { return false; }
  return u.protocol === 'https:' && cvsOrigins(settings).some((o) => { try { return new URL(o).origin === u.origin; } catch { return false; } });
}
/** Read a package from a #cvs= or #cvs-url= hash. Returns { obj } | { error } | null when the hash has neither. */
export async function packageFromHash(hash, settings, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  const h = String(hash || '');
  const inl = /[#&]cvs=([^&]+)/.exec(h);
  if (inl) { try { return { obj: await decodeCvsPayload(inl[1]) }; } catch { return { error: 'This design link could not be read. Ask the designer to send it again.' }; } }
  const ref = /[#&]cvs-url=([^&]+)/.exec(h);
  if (ref) {
    const url = decodeURIComponent(ref[1]);
    if (!originAllowed(url, settings)) return { error: 'This design link points to a site Fullbid does not take designs from.' };
    try { const r = await fetchImpl(url, { headers: { accept: 'application/json' } }); if (!r.ok) return { error: `The design could not be loaded (${r.status}).` }; return { obj: await r.json() }; }
    catch { return { error: 'The design could not be loaded. Check the connection and try again.' }; }
  }
  return null;
}

// CVS job packages, addendum 3 (docs/FULLBID-DIRECTION-ADDENDUM-3.md): the job's whole list, beside the customer's picks.
// Pure functions only (no DOM). Reads the lines importCvsPackage() put on the estimate (the active option's) and the
// stored package: job materials by phase, labor by trade with crew days, the confirm-on-site checklist, the customer
// bid (only the customer's picks with their pictures, allowances, labor as the contractor shows it, the total) and the
// material order sheet (every line, picks and job materials, grouped by where it's bought). No prices are made up:
// a line with no price from the contractor's price book or the design stays "needs a price".
import { isJobLine, tradeLabel } from './import.js';
import { totals, lineTotal } from '../pricing/estimator.js';
import { supplierById } from '../pricing/suppliers.js';
import { JOB_PHASES } from '../trades/bath/pack.js';

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v == null ? '' : String(v));
const r2 = (v) => Math.round(v * 100) / 100;
const halfDay = (h) => (h > 0 ? Math.max(0.5, Math.ceil(h / 8 / 0.5 - 1e-9) * 0.5) : 0);

/** For packages made before addendum 3 (no `phase` on a line): the phase by the line's kind of material */
const PHASE_OF_GROUP = {
  'Lumber and framing': 'framing', Drywall: 'drywall', 'Plumbing rough-in': 'plumbing', Electrical: 'electrical',
  'Waterproofing and setting materials': 'substrate', 'Tile and flooring': 'setting', 'Paint and finishing': 'finish', 'Demo and protection': 'protection',
};

/** The job's phases in order: the package's own list, else the bath pack's */
export function phasesOf(project) {
  const own = arr(project && project.cvs && project.cvs.pkg && project.cvs.pkg.phases).filter((p) => p && p.id && p.name);
  return own.length ? own.map((p) => ({ id: str(p.id), name: str(p.name) })) : JOB_PHASES.map((p) => ({ ...p }));
}

/** A line's phase id: its own (addendum 3), else by its group, else "other" */
export const phaseOfLine = (l) => str(l && l.phase) || PHASE_OF_GROUP[str(l && l.group)] || 'other';

const activeLines = (project) => {
  const est = project.estimate; const active = project.cvs && project.cvs.activeOption;
  return (est.items || []).filter((l) => isJobLine(l) && l.origin === 'cvs' && (!active || l.cvsOption === active));
};
const activeOpt = (project) => arr(project.cvs && project.cvs.pkg && project.cvs.pkg.options).find((o) => o.id === project.cvs.activeOption) || arr(project.cvs && project.cvs.pkg && project.cvs.pkg.options)[0] || null;

/** The customer's picks (designItem materials and priced work), kept apart from the job materials */
export const pickLines = (project) => activeLines(project).filter((l) => (l.cat === 'material' || l.cat === 'work') && l.designItem);
/** The contractor's job materials (everything that isn't a pick) */
export const jobLines = (project) => activeLines(project).filter((l) => l.cat === 'material' && !l.designItem);

/**
 * Job materials by phase, in the job's order: [{ id, name, lines, priced, unpriced }]. Each line keeps its
 * quantity (editable), its price and evidence tier (blank when unknown), how the design counted it and the kit
 * that added it.
 */
export function jobMaterialsByPhase(project) {
  const phases = phasesOf(project); const lines = jobLines(project);
  const out = phases.map((p) => ({ id: p.id, name: p.name, lines: [] }));
  const other = { id: 'other', name: 'Other materials', lines: [] };
  for (const l of lines) (out.find((g) => g.id === phaseOfLine(l)) || other).lines.push(l);
  return [...out, other].filter((g) => g.lines.length).map((g) => ({ ...g, priced: g.lines.filter((l) => l.unitCost != null).length, unpriced: g.lines.filter((l) => l.unitCost == null).length, cost: r2(g.lines.reduce((s, l) => s + (l.unitCost == null ? 0 : lineTotal(l)), 0)) }));
}

/** Labor by trade for the active option: hours as chosen, crew days (8-hour days for one person, to the half day), the design's range */
export function laborByTrade(project) {
  const by = new Map();
  for (const l of activeLines(project).filter((x) => x.cat === 'labor')) {
    const t = str(l.cvsTrade) || 'carpentry';
    if (!by.has(t)) by.set(t, { trade: t, label: tradeLabel(t), hours: 0, cost: 0, sub: false, lines: [], designDays: [0, 0] });
    const g = by.get(t); g.lines.push(l); g.cost += l.unitCost == null ? 0 : lineTotal(l);
    if (l.sub) g.sub = true; else g.hours += Number(l.hours) || 0;
    if (Array.isArray(l.crewDays)) { g.designDays[0] += Number(l.crewDays[0]) || 0; g.designDays[1] += Number(l.crewDays[1]) || 0; }
  }
  return [...by.values()].map((g) => ({ ...g, hours: r2(g.hours), cost: r2(g.cost), crewDays: g.sub ? null : halfDay(g.hours) }));
}

/** What the contractor confirms on site (the active option's), with what's been checked off */
export function siteChecklist(project) {
  const done = (project.cvs && project.cvs.checks) || {};
  const o = activeOpt(project); const phases = phasesOf(project);
  return arr(o && o.checklist).filter((c) => c && c.id && c.text).map((c) => ({ id: str(c.id), text: str(c.text), phase: str(c.phase), phaseName: (phases.find((p) => p.id === c.phase) || {}).name || '', for: c.for == null ? null : str(c.for), done: !!done[c.id] }));
}
export function setCheck(project, id, on) { project.cvs.checks = { ...(project.cvs.checks || {}), [id]: !!on }; if (!on) delete project.cvs.checks[id]; }

/** Change a job line's quantity on site: it's marked "edited from the design" and kept on re-import */
export function setJobQty(project, key, qty) {
  const v = Number(qty); if (!Number.isFinite(v) || v < 0) return false;
  const l = (project.estimate.items || []).find((x) => x.key === key && isJobLine(x)); if (!l) return false;
  l.qty = r2(v); l.locked = true; l.edited = { qty: l.qty, name: l.name }; return true;
}

/** Bid a pick as an allowance (its amount prints in "Your selections still to make"), or back as a line */
export function setAllowance(project, cvsId, on) {
  for (const l of project.estimate.items || []) if (isJobLine(l) && l.cvsId === cvsId && l.designItem) { if (on) l.allowance = true; else delete l.allowance; }
  project.cvs.allowances = { ...(project.cvs.allowances || {}), [cvsId]: !!on }; if (!on) delete project.cvs.allowances[cvsId];
}

export const BID_LABOR = ['by-trade', 'total', 'hidden'];

/**
 * The customer bid for the active option: the customer's picks with their pictures (the design's shopping list, no
 * unit prices), the picks bid as allowances with their amounts, labor as the contractor shows it (by trade, one
 * total, or left inside the price), and the total. Job materials never print here.
 */
export function customerBid(project, { labor = (project.cvs && project.cvs.bidLabor) || 'by-trade' } = {}) {
  const est = project.estimate; const T = totals(est); const o = activeOpt(project);
  const sell = T.sellFactor || 1; const lab = laborByTrade(project);
  const picks = arr(o && o.shoppingList).flatMap((s) => arr(s.rows).map((r) => ({ group: str(s.group), name: str(r.name), maker: r.maker == null ? '' : str(r.maker), finish: str(r.finish), qty: str(r.qty), picture: r.picture || null })));
  const allowances = pickLines(project).filter((l) => l.allowance).map((l) => ({ name: l.name, amount: l.unitCost == null ? null : r2(lineTotal(l) * sell), cvsId: l.cvsId }));
  const laborRows = labor === 'hidden' ? [] : labor === 'total' ? (lab.length ? [{ label: 'Labor', amount: r2(lab.reduce((s, g) => s + g.cost, 0) * sell), days: lab.reduce((s, g) => s + (g.crewDays || 0), 0) }] : []) : lab.map((g) => ({ label: g.label, amount: r2(g.cost * sell), days: g.crewDays }));
  return {
    title: str(project.cvs && project.cvs.design && project.cvs.design.title) || project.name, option: o ? str(o.name) : '', picture: (o && o.picture) || ((project.cvs && project.cvs.design && project.cvs.design.pictures) || [])[0]?.url || null,
    scope: arr(project.cvs && project.cvs.design && project.cvs.design.scope).map(str), picks, allowances, labor: laborRows, laborMode: labor,
    total: r2(T.total), tax: r2(T.tax), needsPrices: activeLines(project).some((l) => l.unitCost == null), conceptNotice: (project.cvs && project.cvs.conceptNotice) || null,
  };
}

/**
 * The material order sheet for the active option: every material line (the customer's picks and the job materials),
 * grouped by where it's bought, with quantities. The contractor's own stock and allowances come last, marked "no order".
 */
export function materialOrderSheet(project, settings) {
  const groups = new Map(); const companyId = project.cvs && project.cvs.companySupplierId;
  const phases = phasesOf(project); const pname = (id) => (phases.find((p) => p.id === id) || {}).name || '';
  for (const l of activeLines(project).filter((x) => x.cat === 'material')) {
    let key, name, order = 2;
    if (l.noOrder) { key = '_stock'; name = 'Your own stock and allowances (no order)'; order = 4; }
    else if (l.supplierId) { const s = supplierById(settings, l.supplierId); key = l.supplierId; name = s ? s.name : l.supplierId; order = l.supplierId === companyId ? 0 : 1; }
    else { key = `_pick:${str(l.fromLabel) || 'supplier'}`; name = `${str(l.fromLabel) || 'A supplier'} (pick a supplier)`; order = 3; }
    if (!groups.has(key)) groups.set(key, { key, name, order, lines: [] });
    groups.get(key).lines.push({ key: l.key, name: l.name, qty: l.qty, unit: l.unitText || l.unit, sku: l.sku || '', designItem: !!l.designItem, phase: pname(phaseOfLine(l)), confirm: !!l.confirmSupplier });
  }
  return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map((g) => ({ ...g, lines: g.lines.sort((a, b) => Number(b.designItem) - Number(a.designItem)) }));
}

/** The order sheet as plain text, one block per place */
export function orderSheetText(project, sheet) {
  const out = [`Material order: ${project.name}`];
  for (const g of sheet) { out.push('', `${g.name}:`); for (const l of g.lines) out.push(`- ${l.qty} ${l.unit}: ${l.name}${l.sku ? ` (SKU ${l.sku})` : ''}${l.designItem ? ' [customer pick]' : ''}`); }
  return out.join('\n');
}

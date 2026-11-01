// Product systems — "I'm installing THIS; what else does the job need?"
// Each system turns one configured product (from a manufacturer or supply house) into the complete job:
// required parts, recommended parts, optional upgrades, labor hours by trade, disposal/permit fees and field notes.
// Costs are national averages (the estimator applies supplier factors, price lists and regional indexes);
// a price the contractor types in for the main product is used as-is.
import { LABOR_BASE } from './profile.js';
import { ALL_PRODUCTS } from '../trades/index.js';

const sel = (key, label, values, dflt) => ({ key, label, type: 'select', values: values.map(([v, l]) => ({ v, label: l })), default: dflt });
const bool = (key, label, dflt) => ({ key, label, type: 'bool', default: dflt });
const num = (key, label, dflt, hint) => ({ key, label, type: 'number', default: dflt, hint });
const P = (name, unit, qty, cost, cls, why, need = 'required', extra = {}) => ({ cat: 'material', kind: 'part', name, unit, qty, unitCost: cost, cls, why, need, ...extra });
const LAB = (name, hours, ltrade, why = '') => ({ cat: 'labor', kind: 'labor', name, unit: 'hr', qty: Math.round(hours * 100) / 100, unitCost: LABOR_BASE, ltrade, why, need: 'required' });
const FEE = (name, unit, qty, cost, why, need = 'required') => ({ cat: 'fee', kind: 'fee', name, unit, qty, unitCost: cost, why, need });
const ceil = Math.ceil;
const TIER = sel('tier', 'Product tier', [['good', 'Good'], ['better', 'Better'], ['best', 'Best']], 'better');
const T = (a, g, b, x) => ({ good: g, better: b, best: x })[a.tier || 'better'];

export const SYSTEMS = ALL_PRODUCTS; // definitions live in js/trades/<pack>/pack.js
export const SYSTEM_MAP = Object.fromEntries(SYSTEMS.map((s) => [s.key, s]));
export const GROUPS = [...new Set(SYSTEMS.map((s) => s.group))];

export const defaultAttrs = (sys) => Object.fromEntries((sys.attrs || []).map((o) => [o.key, o.default]));
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

/** New configured-product instance. */
export function newProduct(key, overrides = {}) {
  const sys = SYSTEM_MAP[key];
  return { id: Math.random().toString(36).slice(2, 9), key, attrs: sys ? defaultAttrs(sys) : {}, qty: sys && sys.measure ? 0 : 1, areaId: null, price: null, productName: '', sku: '', url: '', supplierId: null, on: {}, off: {}, createdAt: new Date().toISOString(), ...overrides };
}

/** Compile an instance into raw estimate lines (national costs; estimator applies supplier/region/labor rates).
 *  `geo` is the imperial takeoff context of the linked area (or {}). */
export function compileProduct(inst, geo = {}) {
  const sys = inst.ai ? aiSystem(inst.ai) : SYSTEM_MAP[inst.key]; if (!sys) return { lines: [], notes: [], sys: null };
  const a = { ...defaultAttrs(sys), ...(inst.attrs || {}) };
  const qty = Number(inst.qty) > 0 ? Number(inst.qty) : 0;
  const built = sys.build({ qty, a, geo }) || {};
  const label = inst.productName ? `${sys.name} — ${inst.productName}` : sys.name;
  const mainQty = built.main && built.main.qty != null ? built.main.qty : qty;
  const fixed = Number(inst.price) > 0;
  let main = { cat: 'material', kind: 'product', name: label, unit: sys.unit, qty: Math.round(mainQty * 100) / 100, unitCost: fixed ? Number(inst.price) : sys.price(a), cls: sys.cls, why: inst.ai ? 'The product you described' : 'The product you selected', need: 'required', note: (built.main && built.main.note) || '', sku: inst.sku || '', fixedCost: fixed, supplierId: inst.supplierId || null };
  const keep = (l) => (l.need === 'optional' ? !!(inst.on || {})[slug(l.name)] : l.need === 'recommended' ? !(inst.off || {})[slug(l.name)] : true);
  const live = inst.prices || {}; const applyLive = (l, k) => { const pr = live[k]; return pr && pr.unitCost > 0 ? { ...l, unitCost: pr.unitCost, fixedCost: true, priceSource: 'live', priceUrl: pr.url || '', priceAt: pr.at || '' } : l; };
  const all = [...(built.parts || []), ...(built.labor || []), ...(built.fees || [])].map((l) => (l.cat === 'material' ? applyLive(l, slug(l.name)) : l));
  if (!fixed) main = applyLive(main, 'main');
  const lines = [main, ...all.filter(keep)].filter((l) => Number(l.qty) > 0);
  return { lines, all: [main, ...all], notes: built.notes || [], sys, label, attrs: a };
}

/** Wrap an AI-generated product description (see ai-prompt CONFIGURE_SCHEMA) as a system. */
export function aiSystem(ai) {
  return { key: 'ai', name: ai.productName || 'Custom product', group: ai.category || 'Custom', cls: ai.supplierClass || 'building', unit: ai.unit || 'ea', attrs: [], price: () => Number(ai.unitPrice) || 0,
    build: ({ qty }) => { const scale = qty && ai.baseQty ? qty / ai.baseQty : 1; const s = (v) => Math.round(Number(v) * scale * 100) / 100;
      return { parts: (ai.parts || []).map((p) => P(p.name, p.unit, s(p.qty), Number(p.unitCost) || 0, p.supplierClass || 'building', p.why || '', p.need || 'required')), labor: (ai.labor || []).map((l) => LAB(l.task, s(l.hours), l.trade || 'carpenter', l.why || '')), fees: (ai.fees || []).map((f) => FEE(f.name, f.unit || 'ea', s(f.qty), Number(f.unitCost) || 0, f.why || '', f.need || 'required')), notes: ai.notes || [] }; } };
}

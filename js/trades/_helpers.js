// Shared builders for pack definitions. Work items (assemblies) and product systems use different option shapes.
import { LABOR_BASE } from '../pricing/profile.js';
// ---- work items
export const M = (name, unit, qty, unitCost, extra = {}) => ({ cat: 'material', name, unit, qty, unitCost, taxable: true, ...extra });
export const L = (name, unit, qty, unitCost, extra = {}) => ({ cat: 'labor', name, unit, qty, unitCost, taxable: false, ...extra });
export const F = (name, unit, qty, unitCost, extra = {}) => ({ cat: 'fee', name, unit, qty, unitCost, taxable: false, ...extra });
export const up = (v, step = 1) => Math.ceil(v / step) * step;
export const sel = (key, label, values, dflt) => ({ key, label, type: 'select', values, default: dflt });
export const num = (key, label, dflt, hint) => ({ key, label, type: 'number', default: dflt, hint });
export const bool = (key, label, dflt) => ({ key, label, type: 'bool', default: dflt });
// ---- product systems
export const psel = (key, label, values, dflt) => ({ key, label, type: 'select', values: values.map(([v, l]) => ({ v, label: l })), default: dflt });
export const pbool = (key, label, dflt) => ({ key, label, type: 'bool', default: dflt });
export const pnum = (key, label, dflt, hint) => ({ key, label, type: 'number', default: dflt, hint });
export const P = (name, unit, qty, cost, cls, why, need = 'required', extra = {}) => ({ cat: 'material', kind: 'part', name, unit, qty, unitCost: cost, cls, why, need, ...extra });
export const LAB = (name, hours, ltrade, why = '') => ({ cat: 'labor', kind: 'labor', name, unit: 'hr', qty: Math.round(hours * 100) / 100, unitCost: LABOR_BASE, ltrade, why, need: 'required' });
export const FEE = (name, unit, qty, cost, why, need = 'required') => ({ cat: 'fee', kind: 'fee', name, unit, qty, unitCost: cost, why, need });
export const ceil = Math.ceil;
export const TIER = psel('tier', 'Product tier', [['good', 'Good'], ['better', 'Better'], ['best', 'Best']], 'better');
export const T = (a, g, b, x) => ({ good: g, better: b, best: x })[a.tier || 'better'];

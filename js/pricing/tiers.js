// Good / Better / Best: one estimate, three price points. The current scope is "Better"; Good and Best swap each
// quality option (grade, tier, material, finish…) to its cheapest / most expensive value by actually pricing it.
import { ASSEMBLY_MAP } from './catalog.js';
import { SYSTEM_MAP, compileProduct, defaultAttrs } from './products.js';
import { recompute, totals, buildCtx, measureQty } from './estimator.js';
import { kindOf } from '../geometry.js';

export const TIER_KEYS = ['good', 'better', 'best'];
const QUALITY = new Set(['grade', 'tier', 'profile', 'decking', 'finish', 'type', 'material', 'core', 'insul', 'hp']);
const sumCost = (lines) => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);
const isQualityOpt = (o, defKey) => o.type === 'select' && QUALITY.has(o.key) && !String(defKey).startsWith('demo_') && o.values.length > 1;

function assemblyCost(def, opts, ctxAreas) { const ctx = buildCtx(ctxAreas, { ...opts, __def: def }); try { return sumCost(def.items(ctx) || []); } catch { return 0; } }
function productCost(inst, attrs, geo) { const r = compileProduct({ ...inst, attrs, qty: Number(inst.qty) > 0 ? inst.qty : 1, price: null }, geo); return sumCost(r.lines); }
const ladder = (values, costOf) => values.map((v) => ({ v: v.v, label: v.label, cost: costOf(v.v) })).sort((a, b) => a.cost - b.cost);

/** Build tier overrides from the estimate's current scope. */
export function generateTiers(project) {
  const est = project.estimate; const rooms = project.rooms || []; const ov = { good: { a: {}, p: {} }, best: { a: {}, p: {} } };
  for (const sel of est.assemblies || []) {
    const def = ASSEMBLY_MAP[sel.key]; if (!def || def.scope === 'project') continue;
    const areas = rooms.filter((r) => (def.kinds || ['room']).includes(kindOf(r))); const ctxAreas = areas.length ? areas : [];
    for (const o of (def.options || []).filter((x) => isQualityOpt(x, def.key))) {
      const base = { ...(sel.opts || {}) }; const lad = ladder(o.values, (v) => assemblyCost(def, { ...base, [o.key]: v }, ctxAreas));
      if (lad[0].cost === lad[lad.length - 1].cost) continue;
      (ov.good.a[sel.key] ||= {})[o.key] = lad[0].v; (ov.best.a[sel.key] ||= {})[o.key] = lad[lad.length - 1].v;
    }
  }
  for (const inst of est.products || []) {
    const sys = SYSTEM_MAP[inst.key]; if (!sys) continue; const attrs = { ...defaultAttrs(sys), ...(inst.attrs || {}) };
    const area = inst.areaId ? rooms.find((r) => r.id === inst.areaId) : null; const geo = area ? buildCtx([area]) : {};
    const sized = { ...inst, qty: Number(inst.qty) > 0 ? inst.qty : area ? measureQty(sys, geo) || 1 : 1 };
    for (const o of (sys.attrs || []).filter((x) => isQualityOpt(x, sys.key))) {
      const lad = ladder(o.values, (v) => productCost(sized, { ...attrs, [o.key]: v }, geo)); if (lad[0].cost === lad[lad.length - 1].cost) continue;
      (ov.good.p[inst.id] ||= {})[o.key] = lad[0].v; (ov.best.p[inst.id] ||= {})[o.key] = lad[lad.length - 1].v;
    }
  }
  const prev = est.tiers || {};
  return { on: true, names: { good: 'Good', better: 'Better', best: 'Best', ...(prev.names || {}) }, blurbs: prev.blurbs || { good: 'Solid, budget-friendly materials', better: 'Our most popular choice', best: 'Premium materials and finishes' }, overrides: ov, addons: prev.addons || [], chosen: null, chosenAddons: [] };
}

function applyOverrides(est, tierKey, addonKeys = []) {
  const ov = (est.tiers && est.tiers.overrides && est.tiers.overrides[tierKey]) || { a: {}, p: {} };
  est.assemblies = (est.assemblies || []).map((s) => (ov.a[s.key] ? { ...s, opts: { ...(s.opts || {}), ...ov.a[s.key] } } : s));
  est.products = (est.products || []).map((p) => (ov.p[p.id] ? { ...p, attrs: { ...(p.attrs || {}), ...ov.p[p.id] }, price: null } : p));
  for (const k of addonKeys) if (!est.assemblies.some((s) => s.key === k) && ASSEMBLY_MAP[k]) est.assemblies.push({ key: k, opts: {} });
  return est;
}

/** Price a tier (and optional add-ons) without touching the real estimate. */
export function variant(project, settings, tierKey = 'better', addonKeys = []) {
  const clone = structuredClone(project); applyOverrides(clone.estimate, tierKey, addonKeys); recompute(clone, settings);
  return { est: clone.estimate, totals: totals(clone.estimate) };
}

/** Human-readable differences between a tier and Better. */
function diffs(project, tierKey) {
  const est = project.estimate; const ov = est.tiers && est.tiers.overrides && est.tiers.overrides[tierKey]; if (!ov) return [];
  const out = [];
  for (const [key, opts] of Object.entries(ov.a)) { const def = ASSEMBLY_MAP[key]; if (!def) continue; for (const [k, v] of Object.entries(opts)) { const o = def.options.find((x) => x.key === k); const lab = o && o.values.find((x) => String(x.v) === String(v)); if (lab) out.push(`${def.name}: ${lab.label}`); } }
  for (const [id, attrs] of Object.entries(ov.p)) { const inst = (est.products || []).find((p) => p.id === id); const sys = inst && SYSTEM_MAP[inst.key]; if (!sys) continue; for (const [k, v] of Object.entries(attrs)) { const o = sys.attrs.find((x) => x.key === k); const lab = o && o.values.find((x) => String(x.v) === String(v)); if (lab) out.push(`${sys.name}${inst.productName ? ` (${inst.productName})` : ''}: ${lab.label}`); } }
  return out;
}

export function tierSummary(project, settings) {
  const est = project.estimate; const names = (est.tiers && est.tiers.names) || {}; const blurbs = (est.tiers && est.tiers.blurbs) || {};
  return TIER_KEYS.map((k) => { const v = variant(project, settings, k); return { key: k, name: names[k] || k, blurb: blurbs[k] || '', total: v.totals.total, deposit: v.totals.deposit, preTax: v.totals.preTax, grossMargin: v.totals.grossMargin, diffs: k === 'better' ? [] : diffs(project, k) }; });
}

export function addonPrices(project, settings, tierKey = 'better') {
  const base = variant(project, settings, tierKey).totals.total;
  return ((project.estimate.tiers && project.estimate.tiers.addons) || []).map((a) => ({ ...a, price: Math.max(0, variant(project, settings, tierKey, [a.key]).totals.total - base) }));
}

/** Client chose a tier (+ add-ons): bake it into the estimate. */
export function applyChoice(project, settings, tierKey, addonKeys = []) {
  const est = project.estimate; applyOverrides(est, tierKey, addonKeys);
  est.tiers = { ...(est.tiers || {}), chosen: tierKey, chosenAddons: addonKeys, overrides: { good: { a: {}, p: {} }, best: { a: {}, p: {} } }, on: false, history: [...((est.tiers && est.tiers.history) || []), { tier: tierKey, addons: addonKeys, at: new Date().toISOString() }] };
  recompute(project, settings); return est;
}

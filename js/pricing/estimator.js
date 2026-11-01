// Estimator engine: quantity takeoff (work items + configured products) → supplier-priced, labor-rated lines →
// totals priced the way the contractor prices → change-order ledger and job plan.
import { ASSEMBLY_MAP } from './catalog.js';
import { regionIndex } from './regional.js';
import { metrics, toSF, toFT, kindOf, roofMetrics, flatMetrics, linearMetrics, reflexCorners } from '../geometry.js';
import { LABOR_BASE, laborIndex, profileOf, finishPrice } from './profile.js';
import { supplierFor, supplierById, matchPriceRow, groupBySupplier } from './suppliers.js';
import { SYSTEM_MAP, compileProduct, slug } from './products.js';

const r2 = (v) => Math.round(v * 100) / 100;

export function regionFor(settings) {
  if (settings.pricing && settings.pricing.autoRegion === false) return { label: 'Custom index', material: settings.pricing.materialIndex || 1, labor: settings.pricing.laborIndex || 1, state: settings.region.state, metro: null };
  return regionIndex({ zip: settings.region.zip, state: settings.region.state });
}

/** Imperial takeoff context for one or more measured areas of any kind. */
export function buildCtx(areas, opts = {}) {
  const agg = { sf: 0, ceilSf: 0, wallSf: 0, wallSfGross: 0, perimLf: 0, baseLf: 0, crownLf: 0, casingLf: 0, winTrimLf: 0, doors: 0, windows: 0, H: 8, rooms: areas.length, outsideCorners: 0, insideCorners: 0,
    roofSq: 0, roofSf: 0, eaveLf: 0, rakeLf: 0, ridgeLf: 0, hipLf: 0, valleyLf: 0, pitch: 0, stories: 1, layers: 0,
    flatSf: 0, flatPerimLf: 0, flatW: 0, flatD: 0, thicknessIn: 4, heightFt: 0, attachedLf: 0, linLf: 0, gates: 0, turns: 0, fenceHeightFt: 6 };
  for (const a of areas) {
    const k = kindOf(a);
    if (k === 'roof') { const m = roofMetrics(a); agg.roofSq += m.squares; agg.roofSf += toSF(m.roofArea); agg.eaveLf += toFT(m.eave); agg.rakeLf += toFT(m.rake); agg.ridgeLf += toFT(m.ridge); agg.hipLf += toFT(m.hip); agg.valleyLf += toFT(m.valley); agg.pitch = Math.max(agg.pitch, m.pitch); agg.stories = Math.max(agg.stories, m.stories); agg.layers = Math.max(agg.layers, m.layers); continue; }
    if (k === 'flat') { const m = flatMetrics(a); agg.flatSf += toSF(m.area); agg.flatPerimLf += toFT(m.perimeter); agg.flatW = Math.max(agg.flatW, toFT(Math.max(m.bounds.w, m.bounds.d))); agg.flatD = Math.max(agg.flatD, toFT(Math.min(m.bounds.w, m.bounds.d))); agg.thicknessIn = m.thicknessIn; agg.heightFt = m.heightFt; agg.attachedLf += m.attachedLf; continue; }
    if (k === 'linear') { const m = linearMetrics(a); agg.linLf += toFT(m.length); agg.gates += m.gates; agg.turns += m.turns; agg.fenceHeightFt = m.heightFt; continue; }
    const m = metrics(a);
    agg.sf += toSF(m.floorArea); agg.ceilSf += toSF(m.ceilingArea); agg.wallSf += toSF(m.wallAreaNet); agg.wallSfGross += toSF(m.wallAreaGross);
    agg.perimLf += toFT(m.perimeter); agg.baseLf += toFT(m.baseboardLF); agg.crownLf += toFT(m.crownLF); agg.casingLf += toFT(m.doorCasingLF); agg.winTrimLf += toFT(m.windowTrimLF);
    agg.doors += m.doorCount; agg.windows += m.windowCount; agg.H = toFT(m.H);
    if (k === 'exterior' && a.corners && a.corners.length > 2) { const rf = reflexCorners(a.corners); agg.outsideCorners += a.corners.length - rf; agg.insideCorners += rf; }
  }
  const def = opts.__def;
  return { ...agg, opts, opt: (k) => { if (opts[k] !== undefined && opts[k] !== null && opts[k] !== '') return opts[k]; const o = def && def.options && def.options.find((x) => x.key === k); return o ? o.default : undefined; }, n: (k, dflt) => { const v = opts[k]; const num = v === '' || v === null || v === undefined ? NaN : Number(v); return Number.isFinite(num) && num >= 0 ? num : dflt; } };
}

/** Quantity a configured product gets from its linked area. */
export function measureQty(sys, ctx) {
  const m = sys && sys.measure; if (!m) return 0;
  return { sf: ctx.flatSf || ctx.sf, roofSq: ctx.roofSq, wallSq: ctx.wallSf / 100, gutterLf: ctx.eaveLf || ctx.linLf, linLf: ctx.linLf }[m.metric] || 0;
}

/** Turn a national-cost line into a priced line for this contractor: supplier, price list, region, own labor rates. */
function priceLine(ln, env, key) {
  const { settings, reg } = env; const out = { ...ln };
  if (ln.cat === 'material') {
    const pinned = env.pins[key];
    const sup = (pinned && supplierById(settings, pinned)) || (ln.supplierId && supplierById(settings, ln.supplierId)) || supplierFor(settings, ln.cls || 'building');
    out.supplierId = sup.id; out.supplierPinned = !!pinned;
    if (ln.fixedCost) { out.unitCost = r2(ln.unitCost); out.priceSource = ln.priceSource || 'your price'; }
    else { out.unitCost = r2(ln.unitCost * reg.material * (Number(sup.factor) || 1)); out.priceSource = 'catalog';
      const row = matchPriceRow(ln, env.priceList, sup.id); if (row) { out.unitCost = r2(row.price); out.priceSource = 'price list'; out.sku = out.sku || row.sku; out.priceAt = row.updatedAt; } }
  } else if (ln.cat === 'labor') {
    const idx = laborIndex(ln.ltrade || 'laborer', settings, reg); out.unitCost = r2(ln.unitCost * idx);
    out.hours = r2(ln.unit === 'hr' ? Number(ln.qty) : (Number(ln.qty) * Number(ln.unitCost)) / LABOR_BASE);
  } else out.unitCost = r2(ln.unitCost);
  return out;
}

function envFor(project, settings, pins = {}) { return { settings, reg: regionFor(settings), priceList: (settings && settings.priceList) || [], pins }; }

/** Work-item lines (assemblies × measured areas). */
export function takeoff(project, settings, env = envFor(project, settings)) {
  const est = project.estimate; const rooms = project.rooms || []; const out = [];
  for (const sel of est.assemblies || []) {
    const def = ASSEMBLY_MAP[sel.key]; if (!def) continue;
    const opts = { ...(sel.opts || {}), __def: def }; const kinds = def.kinds || ['room'];
    const eligible = rooms.filter((r) => kinds.includes(kindOf(r)) && (!sel.roomIds || sel.roomIds.includes(r.id)));
    const targets = def.scope === 'project' || !rooms.length ? [null] : eligible;
    const multi = targets.length > 1;
    for (const room of targets) {
      const ctx = buildCtx(room ? [room] : rooms, opts);
      let lines; try { lines = def.items(ctx) || []; } catch (e) { console.warn('assembly failed', sel.key, e); continue; }
      lines.forEach((ln, idx) => {
        if (!(ln.qty > 0) && ln.qty !== 0) return;
        const key = `${sel.key}|${room ? room.id : 'p'}|${idx}`;
        const raw = { ...ln, cls: ln.cls || def.cls, ltrade: ln.ltrade || def.ltrade };
        const priced = priceLine(raw, env, key);
        out.push({ ...priced, id: key, key, assembly: sel.key, assemblyName: def.name, trade: def.trade, roomId: room ? room.id : null, roomName: room ? room.name : '', name: multi && room ? `${ln.name} — ${room.name}` : ln.name, qty: r2(ln.qty), baseCost: r2(ln.unitCost), taxable: ln.taxable !== false, note: ln.note || '', locked: false });
      });
    }
  }
  return out;
}

/** Configured-product lines (the "what else does it need" engine). */
export function productLines(project, settings, env = envFor(project, settings)) {
  const est = project.estimate; const rooms = project.rooms || []; const out = [];
  for (const inst of est.products || []) {
    const sys = inst.ai ? null : SYSTEM_MAP[inst.key]; const area = inst.areaId ? rooms.find((r) => r.id === inst.areaId) : null;
    const geo = area ? buildCtx([area]) : {};
    const qty = Number(inst.qty) > 0 ? Number(inst.qty) : sys && area ? measureQty(sys, geo) : Number(inst.qty) || 0;
    const { lines, label } = compileProduct({ ...inst, qty }, geo);
    for (const ln of lines) {
      const key = `prod|${inst.id}|${ln.kind === 'product' ? 'main' : slug(ln.name)}`;
      const priced = priceLine(ln, env, key);
      out.push({ ...priced, id: key, key, assembly: 'product', productId: inst.id, assemblyName: label, trade: (sys && sys.group) || 'Product', roomId: area ? area.id : null, roomName: area ? area.name : '', qty: r2(ln.qty), baseCost: r2(ln.unitCost), taxable: ln.cat === 'material', note: ln.note || '', locked: false });
    }
  }
  return out;
}

/** Recompute generated lines, preserving user edits (locked), pinned suppliers, locked prices, removals and custom lines. */
export function recompute(project, settings) {
  const est = project.estimate; const prev = new Map((est.items || []).map((i) => [i.key, i]));
  const removed = new Set(est.removedKeys || []);
  const pins = {}; for (const p of est.items || []) if (p.supplierPinned && p.supplierId) pins[p.key] = p.supplierId;
  const env = envFor(project, settings, pins);
  const fresh = [...takeoff(project, settings, env), ...productLines(project, settings, env)].filter((i) => !removed.has(i.key)).map((i) => {
    const p = prev.get(i.key); if (!p) return i;
    if (p.locked) return { ...i, name: p.name, qty: p.qty, unitCost: p.unitCost, unit: p.unit, note: p.note, cat: p.cat, locked: true, hours: p.cat === 'labor' ? r2(i.hours * (p.qty / (i.qty || 1))) : i.hours, priceSource: 'edited' };
    if (p.priceLocked) return { ...i, unitCost: p.unitCost, priceSource: p.priceSource, priceUrl: p.priceUrl, priceAt: p.priceAt, priceLocked: true };
    return i;
  });
  const custom = (est.items || []).filter((i) => i.custom);
  est.items = [...fresh, ...custom];
  return est.items;
}

export function customItem({ name, cat = 'material', unit = 'ea', qty = 1, unitCost = 0, note = '', supplierId = null, hours = null, ltrade = null }) {
  const id = 'custom|' + Math.random().toString(36).slice(2, 9);
  return { id, key: id, assembly: 'custom', assemblyName: 'Custom items', trade: 'Custom', roomId: null, roomName: '', name, cat, unit, qty, baseCost: unitCost, unitCost, taxable: cat === 'material', note, locked: true, custom: true, supplierId, hours: cat === 'labor' ? (hours != null ? hours : unit === 'hr' ? qty : r2((qty * unitCost) / LABOR_BASE)) : null, ltrade: ltrade || (cat === 'labor' ? 'carpenter' : null), priceSource: 'manual' };
}

export const lineTotal = (i) => r2((Number(i.qty) || 0) * (Number(i.unitCost) || 0));
export const lineHours = (i) => (i.cat !== 'labor' ? 0 : Number.isFinite(Number(i.hours)) && i.hours != null ? Number(i.hours) : i.unit === 'hr' ? Number(i.qty) || 0 : lineTotal(i) / LABOR_BASE);

/** Totals, priced by the estimate's method: 'stack' (legacy markup stack), 'markup', 'margin' or 'rate'. */
export function totals(est) {
  const a = est.adj || {}; const items = est.items || [];
  const sum = (cat) => items.filter((i) => i.cat === cat).reduce((s, i) => s + lineTotal(i), 0);
  const materials = sum('material'), labor = sum('labor'), fees = sum('fee'); const cost = materials + labor + fees;
  const laborHours = items.reduce((s, i) => s + lineHours(i), 0);
  const method = a.method || 'stack'; const discount = Number(a.discount) || 0;
  let materialMarkup = 0, laborMarkup = 0, subtotal = cost, overhead = 0, profit = 0, contingency = 0, raw;
  if (method === 'margin') {
    const m = Math.min(95, Math.max(0, Number(a.targetMargin) || 0)) / 100; const sell = cost / (1 - m);
    contingency = sell * (Number(a.contingency) || 0) / 100; subtotal = sell; raw = Math.max(0, sell + contingency - discount);
  } else if (method === 'rate') {
    materialMarkup = materials * (Number(a.materialMarkup) || 0) / 100;
    const laborSell = laborHours > 0 && Number(a.billRate) > 0 ? laborHours * Number(a.billRate) : labor * (1 + (Number(a.laborMarkup) || 0) / 100);
    laborMarkup = laborSell - labor; subtotal = cost + materialMarkup + laborMarkup;
    contingency = subtotal * (Number(a.contingency) || 0) / 100; raw = Math.max(0, subtotal + contingency - discount);
  } else {
    materialMarkup = materials * (Number(a.materialMarkup) || 0) / 100; laborMarkup = labor * (Number(a.laborMarkup) || 0) / 100;
    subtotal = cost + materialMarkup + laborMarkup; overhead = subtotal * (Number(a.overhead) || 0) / 100; profit = (subtotal + overhead) * (Number(a.profit) || 0) / 100;
    contingency = subtotal * (Number(a.contingency) || 0) / 100; raw = Math.max(0, subtotal + overhead + profit + contingency - discount);
  }
  const fin = finishPrice(raw, a); const preTax = cost > 0 || fin.price > 0 ? fin.price : 0;
  if (method === 'margin' || method === 'rate') { overhead = preTax * (Number(a.overheadPct) || 0) / 100; profit = preTax - cost - overhead - contingency + discount; }
  const sellFactor = cost > 0 ? preTax / cost : 1; // uniform gross-up so inline sell prices reconcile to preTax
  const taxBase = a.taxMaterialsOnly ? items.filter((i) => i.cat === 'material' && i.taxable !== false).reduce((s, i) => s + lineTotal(i), 0) * sellFactor : preTax;
  const tax = taxBase * (Number(a.taxRate) || 0) / 100; const total = preTax + tax; const deposit = total * (Number(a.depositPct) || 0) / 100;
  const grossProfit = preTax - cost; const grossMargin = preTax > 0 ? (grossProfit / preTax) * 100 : 0; const markupOnCost = cost > 0 ? (grossProfit / cost) * 100 : 0;
  const overheadAlloc = preTax * (Number(a.overheadPct ?? a.overhead) || 0) / 100; const net = grossProfit - overheadAlloc; const netPct = preTax > 0 ? (net / preTax) * 100 : 0;
  return { method, materials, labor, fees, cost, laborHours, materialMarkup, laborMarkup, subtotal, overhead, profit, contingency, discount, adjustment: fin.adjustment, minApplied: fin.minApplied, preTax, sellFactor, taxBase, tax, total, deposit, markupTotal: preTax + discount - cost, grossProfit, grossMargin, markupOnCost, overheadAlloc, net, netPct, count: items.length };
}

export function projectAreaSF(project) { return (project.rooms || []).filter((r) => kindOf(r) === 'room').reduce((s, r) => s + toSF(metrics(r).floorArea), 0); }

// ---- change orders: priced with the estimate's method, tax and rounding (no minimum/trip fee)
export function coTotals(co, est) { const t = totals({ items: co.items || [], adj: { ...(est.adj || {}), discount: 0, minJob: 0, tripFee: 0, depositPct: 0 } }); if (!co.credit) return t; return { ...t, preTax: -t.preTax, tax: -t.tax, total: -t.total, cost: -t.cost }; }
/** Contract ledger: original (frozen at signing) + approved change orders = revised contract. */
export function ledger(project) {
  const est = project.estimate; const original = Number.isFinite(est.signedTotal) ? est.signedTotal : totals(est).total;
  const cos = project.changeOrders || []; const sumCo = (st) => cos.filter((c) => c.status === st).reduce((s, c) => s + coTotals(c, est).total, 0);
  const approved = sumCo('approved'), pending = sumCo('sent') + sumCo('draft');
  const paid = est.invoice ? (est.invoice.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0) : 0;
  const revised = original + approved; return { original, approved, pending, revised, paid, balance: Math.max(0, revised - paid), count: cos.length };
}
export function invoiceTotals(project) { const L = ledger(project); const t = totals(project.estimate); return { total: L.revised, original: L.original, changeOrders: L.approved, paid: L.paid, balance: L.balance, deposit: t.deposit }; }

export function itemsByGroup(items) {
  const groups = new Map();
  for (const i of items) { const k = i.assemblyName || 'Other'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  return [...groups.entries()].map(([name, list]) => ({ name, items: list, total: list.reduce((s, i) => s + lineTotal(i), 0), hours: list.reduce((s, i) => s + lineHours(i), 0) }));
}

/** Contractor planning view: labor hours by trade, crew-days, materials by supplier, money. */
export function jobPlan(project, settings) {
  const est = project.estimate; const p = profileOf(settings); const T = totals(est); const byTrade = new Map();
  for (const i of est.items || []) if (i.cat === 'labor') { const k = i.ltrade || 'laborer'; const cur = byTrade.get(k) || { trade: k, hours: 0, cost: 0 }; cur.hours += lineHours(i); cur.cost += lineTotal(i); byTrade.set(k, cur); }
  const trades = [...byTrade.values()].map((t) => ({ ...t, hours: r2(t.hours), cost: r2(t.cost) })).sort((a, b) => b.hours - a.hours);
  const crew = Math.max(1, Number(p.crewSize) || 2), day = Math.max(1, Number(p.hoursPerDay) || 8);
  return { trades, laborHours: r2(T.laborHours), crewSize: crew, crewDays: Math.ceil((T.laborHours / (crew * day)) * 2) / 2, suppliers: groupBySupplier(est.items, settings), totals: T };
}

export function toCSV(project) {
  const rows = [['Group', 'Item', 'Type', 'Area', 'Qty', 'Unit', 'Unit cost', 'Line total', 'Labor hours', 'Supplier', 'Price source', 'Note']];
  for (const i of project.estimate.items) rows.push([i.assemblyName, i.name, i.cat, i.roomName, i.qty, i.unit, i.unitCost, lineTotal(i), i.cat === 'labor' ? r2(lineHours(i)) : '', i.supplierId || '', i.priceSource || '', i.note]);
  const t = totals(project.estimate);
  rows.push([], ['Materials', '', '', '', '', '', '', r2(t.materials)], ['Labor', '', '', '', '', '', '', r2(t.labor), r2(t.laborHours)], ['Fees', '', '', '', '', '', '', r2(t.fees)], ['Markup, overhead & profit', '', '', '', '', '', '', r2(t.markupTotal)], ['Tax', '', '', '', '', '', '', r2(t.tax)], ['Total', '', '', '', '', '', '', r2(t.total)]);
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

/** QuickBooks Online invoice-import CSV (one row per line at client sell price). */
export function quickBooksCSV(project, { invoiceNo, date, dueDate } = {}) {
  const est = project.estimate; const T = totals(est); const f = est.adj && est.adj.inlineMarkup === false ? 1 : T.sellFactor; const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const d = (iso) => { const x = new Date(iso || Date.now()); return `${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}/${x.getFullYear()}`; };
  const no = invoiceNo || (est.invoice && est.invoice.number) || est.number; const rows = [['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Item(Product/Service)', 'ItemDescription', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'Taxable']];
  for (const i of est.items) rows.push([no, project.client.name || project.name, d(date || (est.invoice && est.invoice.date)), d(dueDate || (est.invoice && est.invoice.dueDate)), i.cat === 'labor' ? 'Labor' : i.cat === 'fee' ? 'Fees' : 'Materials', i.name, i.qty, r2(i.unitCost * f), r2(lineTotal(i) * f), i.cat === 'material' ? 'Y' : 'N']);
  for (const co of project.changeOrders || []) if (co.status === 'approved') rows.push([no, project.client.name || project.name, d(date), d(dueDate), 'Change order', `CO #${co.n}: ${co.title}`, 1, r2(coTotals(co, est).preTax), r2(coTotals(co, est).preTax), 'N']);
  return rows.map((r) => r.map(q).join(',')).join('\n');
}

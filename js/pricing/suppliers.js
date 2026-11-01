// Suppliers, preferred sources per material class, price lists, and material orders grouped by supplier.

export const CLASSES = {
  building: 'Building materials', lumber: 'Lumber & millwork', paint: 'Paint & sundries', flooring: 'Flooring & tile', electrical: 'Electrical',
  plumbing: 'Plumbing', kitchen: 'Cabinets & counters', hvac: 'HVAC', windows_doors: 'Windows & doors', roofing: 'Roofing & gutters',
  siding: 'Siding & exteriors', masonry: 'Concrete & masonry', paving: 'Asphalt & paving', fence: 'Fencing', hardware: 'Hardware & fasteners',
};
const ALL_BIGBOX = ['building', 'lumber', 'paint', 'flooring', 'electrical', 'plumbing', 'kitchen', 'windows_doors', 'roofing', 'siding', 'masonry', 'fence', 'hardware'];

// factor = your account price vs. the national catalog (0.95 = 5% contractor discount); delivery = typical fee.
export const DEFAULT_SUPPLIERS = [
  { id: 'homedepot', name: 'The Home Depot', short: 'Home Depot', domain: 'homedepot.com', classes: ALL_BIGBOX, factor: 1.0, delivery: 79, notes: 'Pro Xtra volume pricing on large orders' },
  { id: 'lowes', name: "Lowe's", short: "Lowe's", domain: 'lowes.com', classes: ALL_BIGBOX, factor: 1.0, delivery: 79, notes: 'MVPs Pro pricing' },
  { id: 'menards', name: 'Menards', short: 'Menards', domain: 'menards.com', classes: ALL_BIGBOX, factor: 0.98, delivery: 69, notes: 'Midwest; rebates not included' },
  { id: 'ace', name: 'Ace Hardware', short: 'Ace', domain: 'acehardware.com', classes: ['hardware', 'paint', 'electrical', 'plumbing'], factor: 1.08, delivery: 0, notes: 'Neighborhood pick-up for small parts' },
  { id: 'ferguson', name: 'Ferguson', short: 'Ferguson', domain: 'ferguson.com', classes: ['plumbing', 'hvac', 'kitchen'], factor: 0.95, delivery: 0, notes: 'Trade counter; account pricing' },
  { id: 'abc', name: 'ABC Supply', short: 'ABC Supply', domain: 'abcsupply.com', classes: ['roofing', 'siding', 'windows_doors'], factor: 0.95, delivery: 0, notes: 'Roof-top delivery on roofing orders' },
  { id: 'yard', name: 'Local lumber yard', short: 'Lumber yard', domain: '', classes: ['lumber', 'building', 'windows_doors', 'fence'], factor: 0.97, delivery: 50, notes: 'Edit the name to your yard' },
  { id: 'plant', name: 'Local asphalt / concrete plant', short: 'Plant', domain: '', classes: ['paving', 'masonry'], factor: 1.0, delivery: 0, notes: 'Ready-mix and hot-mix by the ton/yard' },
];
export const DEFAULT_PREFS = { building: 'homedepot', lumber: 'yard', paint: 'homedepot', flooring: 'homedepot', electrical: 'homedepot', plumbing: 'ferguson', kitchen: 'homedepot', hvac: 'ferguson', windows_doors: 'abc', roofing: 'abc', siding: 'abc', masonry: 'homedepot', paving: 'plant', fence: 'homedepot', hardware: 'homedepot' };

export const suppliersOf = (settings) => (settings && Array.isArray(settings.suppliers) && settings.suppliers.length ? settings.suppliers : DEFAULT_SUPPLIERS);
export const supplierById = (settings, id) => suppliersOf(settings).find((s) => s.id === id) || null;
export function supplierFor(settings, cls) {
  const list = suppliersOf(settings); const prefs = { ...DEFAULT_PREFS, ...((settings && settings.supplierPrefs) || {}) };
  return list.find((s) => s.id === prefs[cls]) || list.find((s) => (s.classes || []).includes(cls)) || list[0];
}

// ---- CSV
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false; const s = String(text || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
const HEAD = { sku: /^(sku|item ?#?|item ?no\.?|item number|model|part ?#?|part number|upc|product ?id|internet ?#?)$/i, name: /^(description|desc|name|product|item ?name|item ?description|title)$/i, unit: /^(unit|uom|u\/m|unit of measure)$/i, price: /^(price|cost|unit ?price|unit ?cost|net|net ?price|your ?price|each|sell)$/i, supplier: /^(supplier|vendor|store|source)$/i };
/** Parse a supplier price sheet (CSV/TSV exported from a quote, cart or account portal). */
export function parsePriceList(text, supplierId) {
  const rows = parseCSV(text); if (!rows.length) return [];
  const head = rows[0].map((h) => String(h).trim()); const idx = {}; for (const [k, re] of Object.entries(HEAD)) idx[k] = head.findIndex((h) => re.test(h));
  const hasHeader = idx.name >= 0 || idx.price >= 0; const body = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) { idx.sku = -1; idx.name = 0; idx.price = rows[0].length - 1; idx.unit = -1; idx.supplier = -1; }
  const now = new Date().toISOString();
  return body.map((r) => { const price = Number(String(r[idx.price] ?? '').replace(/[$,\s]/g, '')); return { supplierId: (idx.supplier >= 0 && r[idx.supplier] ? String(r[idx.supplier]).trim().toLowerCase().replace(/[^a-z0-9]+/g, '') : '') || supplierId, sku: idx.sku >= 0 ? String(r[idx.sku] || '').trim() : '', name: String(r[idx.name] || '').trim(), unit: idx.unit >= 0 ? String(r[idx.unit] || '').trim().toLowerCase() : '', price, updatedAt: now }; }).filter((x) => x.name && Number.isFinite(x.price) && x.price > 0);
}
const STOP = new Set(['the', 'and', 'or', 'with', 'for', 'of', 'a', 'an', 'in', 'to', 'ft', 'in.', 'ea', 'each', 'pack', 'pk', 'ct', 'count', 'new', 'standard']);
export const tokens = (s) => [...new Set(String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9/.]+/g, ' ').split(' ').filter((t) => t.length > 1 && !STOP.has(t)))];
const UNIT_ALIASES = { ea: ['ea', 'each', 'pc', 'piece', ''], sf: ['sf', 'sqft', 'sq ft', 'ft2'], lf: ['lf', 'ft', 'linear ft'], gal: ['gal', 'gallon'], box: ['box', 'bx', 'carton', 'ctn'], bag: ['bag', 'bg'], roll: ['roll', 'rl'], bundle: ['bundle', 'bdl', 'bd'], sheet: ['sheet', 'sht', 'ea'], tube: ['tube', 'ea'], ton: ['ton', 'tn'], cy: ['cy', 'yd', 'cu yd'], pail: ['pail', 'bucket', 'ea'] };
const unitOk = (a, b) => !b || a === b || (UNIT_ALIASES[a] || [a]).includes(b);
/** Best price-list row for a line: exact SKU first, else ≥ 60% token overlap with a compatible unit. */
export function matchPriceRow(line, rows, supplierId) {
  const pool = (rows || []).filter((r) => !supplierId || !r.supplierId || r.supplierId === supplierId);
  if (line.sku) { const hit = pool.find((r) => r.sku && r.sku.toLowerCase() === String(line.sku).toLowerCase()); if (hit) return hit; }
  const lt = tokens(line.name); if (!lt.length) return null; let best = null, bestScore = 0;
  for (const r of pool) { if (!unitOk(line.unit, r.unit)) continue; const rtl = tokens(r.name); const rt = new Set(rtl); const hit = lt.filter((t) => rt.has(t)).length; if (hit < Math.min(2, lt.length, rtl.length)) continue; const score = hit / Math.max(1, Math.min(lt.length, rtl.length)) + hit / 1000; if (score > bestScore) { best = r; bestScore = score; } }
  return bestScore >= 0.75 ? best : null;
}

/** Group material lines by supplier for ordering. */
export function groupBySupplier(items, settings) {
  const groups = new Map();
  for (const i of items || []) { if (i.cat !== 'material') continue; const sup = supplierById(settings, i.supplierId) || supplierFor(settings, i.cls || 'building'); if (!groups.has(sup.id)) groups.set(sup.id, { supplier: sup, lines: [], subtotal: 0 }); const g = groups.get(sup.id); g.lines.push(i); g.subtotal += (Number(i.qty) || 0) * (Number(i.unitCost) || 0); }
  return [...groups.values()].map((g) => ({ ...g, subtotal: Math.round(g.subtotal * 100) / 100, delivery: Number(g.supplier.delivery) || 0 })).sort((a, b) => b.subtotal - a.subtotal);
}
export function materialOrderCSV(groups, { project } = {}) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; const rows = [['Supplier', 'SKU', 'Item', 'Qty', 'Unit', 'Est. unit cost', 'Est. total', 'Price source', 'For']];
  for (const g of groups) for (const l of g.lines) rows.push([g.supplier.name, l.sku || '', l.name, l.qty, l.unit, l.unitCost, Math.round(l.qty * l.unitCost * 100) / 100, l.priceSource || 'catalog', project ? project.name : '']);
  return rows.map((r) => r.map(q).join(',')).join('\n');
}
export function materialOrderText(group, project) {
  const lines = group.lines.map((l) => `• ${l.qty} ${l.unit} — ${l.name}${l.sku ? ` (SKU ${l.sku})` : ''}`);
  return `Material order for ${project ? project.name : 'job'}${project && project.client && project.client.address ? `\nDeliver to: ${project.client.address}` : ''}\n\n${lines.join('\n')}\n\nPlease confirm pricing and availability. Thank you!`;
}

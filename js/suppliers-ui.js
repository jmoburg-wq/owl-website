// Suppliers & price lists — where you buy each kind of material, your account pricing, and imported price sheets.
import { store } from './store.js';
import { CLASSES, DEFAULT_SUPPLIERS, DEFAULT_PREFS, suppliersOf, supplierFor, parsePriceList } from './pricing/suppliers.js';
import { el, h, $, $$, toast, panel, sheet, icons, esc, confirmDialog, fmtDate } from './ui.js';

const ensureList = (s) => { if (!Array.isArray(s.suppliers) || !s.suppliers.length) s.suppliers = structuredClone(DEFAULT_SUPPLIERS); return s.suppliers; };

export function openSuppliersPanel({ onDone } = {}) {
  const s = store.settings; s.supplierPrefs = s.supplierPrefs || {}; s.priceList = s.priceList || [];
  const pn = panel({ title: 'Suppliers & price lists', onClose: () => onDone && onDone() }); const B = pn.body; const save = () => store.update(() => {}, 'settings');
  const draw = () => {
    B.innerHTML = ''; const list = suppliersOf(s);
    B.append(el(`<p class="muted small mt8">Every material line is sourced from the supplier you pick for its category, priced at your account level, and replaced by your own price-list price whenever an item matches.</p>`));
    // where you buy
    const wb = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Where you buy</h3></div>`));
    for (const [cls, label] of Object.entries(CLASSES)) { const cur = supplierFor(s, cls); const row = el(`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span class="small">${esc(label)}</span><select data-cls="${cls}" style="max-width:56%;min-height:36px;padding:6px 8px">${list.map((x) => `<option value="${x.id}" ${x.id === cur.id ? 'selected' : ''}>${esc(x.short || x.name)}${(x.classes || []).includes(cls) ? '' : ' (not usual)'}</option>`).join('')}</select></div>`); wb.append(row); }
    wb.addEventListener('change', (e) => { const cls = e.target.dataset.cls; if (!cls) return; s.supplierPrefs[cls] = e.target.value; save(); toast(`${CLASSES[cls]} → ${list.find((x) => x.id === e.target.value).short}`); });
    B.append(wb);
    // suppliers
    const sc = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Your suppliers</h3><button class="btn xs secondary" data-act="add">${icons.plus} Add</button></div>`));
    const counts = {}; for (const r of s.priceList) counts[r.supplierId] = (counts[r.supplierId] || 0) + 1;
    for (const x of list) { const disc = Math.round((1 - (Number(x.factor) || 1)) * 1000) / 10; sc.append(el(`<button class="item" data-edit="${x.id}" style="text-align:left;width:100%;display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><div class="grow"><b>${esc(x.name)}</b><div class="dim small">${disc > 0 ? `${disc}% below catalog` : disc < 0 ? `${-disc}% above catalog` : 'Catalog pricing'} · delivery ${x.delivery ? `$${x.delivery}` : 'free / pickup'}${counts[x.id] ? ` · ${counts[x.id]} price-list items` : ''}</div><div class="dim tiny">${(x.classes || []).map((c) => CLASSES[c]).filter(Boolean).slice(0, 4).join(', ')}${(x.classes || []).length > 4 ? '…' : ''}</div></div><span class="chev">${icons.chevron}</span></button>`)); }
    B.append(sc);
    // price lists
    const pl = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Price lists</h3><span class="dim small">${s.priceList.length} items</span></div>`));
    pl.append(el(`<p class="dim small">Export a quote, cart or account price sheet as CSV from Home Depot Pro, Ferguson, ABC Supply or your yard, then import it here. Columns like <i>SKU / Item #</i>, <i>Description</i>, <i>Unit</i>, <i>Price</i> are detected automatically.</p>`));
    pl.append(el(`<div class="btn-grid mt8"><button class="btn secondary" data-act="import">${icons.download} Import CSV</button><button class="btn neutral" data-act="paste">Paste rows</button></div>`));
    const bySup = Object.entries(counts); if (bySup.length) { const ul = h('div', { class: 'list mt8' }); for (const [id, n] of bySup) { const sup = list.find((x) => x.id === id); const last = s.priceList.filter((r) => r.supplierId === id).map((r) => r.updatedAt).sort().pop(); ul.append(el(`<div class="item" style="padding:8px 0"><div class="grow"><b>${esc(sup ? sup.short || sup.name : id)}</b><div class="dim small">${n} items · updated ${fmtDate(last)}</div></div><button class="btn xs danger" data-clear="${esc(id)}">Clear</button></div>`)); } pl.append(ul); }
    B.append(pl);
    B.append(el(`<button class="btn neutral block mt12" data-act="reset">Reset suppliers to defaults</button>`));
  };
  const importRows = async (text, supplierId) => { const rows = parsePriceList(text, supplierId); if (!rows.length) return toast('No priced rows found — check the columns'); const keyOf = (r) => `${r.supplierId}|${(r.sku || r.name).toLowerCase()}`; const map = new Map(s.priceList.map((r) => [keyOf(r), r])); for (const r of rows) map.set(keyOf(r), r); s.priceList = [...map.values()]; save(); toast(`Imported ${rows.length} prices`); draw(); };
  const pickSupplier = (title) => new Promise((resolve) => { const list = suppliersOf(s); const body = el(`<div><div class="field"><label>These prices are from</label><select>${list.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div></div>`); sheet({ title, body, onClose: (r) => resolve(r || null), actions: [{ label: 'Continue', onClick: () => $('select', body).value }, { label: 'Cancel', cls: 'neutral', onClick: () => null }] }); });
  B.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],[data-edit],[data-clear]'); if (!t) return;
    if (t.dataset.clear) { if (await confirmDialog('Remove this supplier’s imported prices?', { okLabel: 'Clear', danger: true })) { s.priceList = s.priceList.filter((r) => r.supplierId !== t.dataset.clear); save(); draw(); } return; }
    if (t.dataset.edit) return editSupplier(t.dataset.edit);
    const act = t.dataset.act;
    if (act === 'add') return editSupplier(null);
    if (act === 'reset') { if (await confirmDialog('Restore the default supplier list and preferences? Imported prices are kept.', { okLabel: 'Reset' })) { s.suppliers = null; s.supplierPrefs = {}; save(); draw(); } }
    if (act === 'import') { const sid = await pickSupplier('Import price list'); if (!sid) return; const inp = el(`<input type="file" accept=".csv,.tsv,text/csv,text/plain" hidden>`); document.body.append(inp); inp.addEventListener('change', async () => { if (inp.files[0]) await importRows(await inp.files[0].text(), sid); inp.remove(); }); inp.click(); }
    if (act === 'paste') { const sid = await pickSupplier('Paste price rows'); if (!sid) return; const body = el(`<div><textarea style="min-height:160px" placeholder="SKU,Description,Unit,Price&#10;1001234,Wax ring with horn,EA,5.98"></textarea></div>`); sheet({ title: 'Paste rows', body, actions: [{ label: 'Import', onClick: () => importRows($('textarea', body).value, sid) }, { label: 'Cancel', cls: 'neutral' }] }); }
  });
  function editSupplier(id) {
    const list = ensureList(s); const x = id ? list.find((y) => y.id === id) : { id: 'sup' + Math.random().toString(36).slice(2, 7), name: '', short: '', domain: '', classes: ['building'], factor: 1, delivery: 0, notes: '' };
    const disc = Math.round((1 - (Number(x.factor) || 1)) * 1000) / 10;
    const body = el(`<div><div class="field"><label>Name</label><input data-f="name" type="text" value="${esc(x.name)}" placeholder="e.g. Neenan Supply"></div><div class="inline-fields"><div class="field"><label>Short name</label><input data-f="short" type="text" value="${esc(x.short || '')}"></div><div class="field"><label>Website (for live prices)</label><input data-f="domain" type="text" value="${esc(x.domain || '')}" placeholder="example.com"></div></div><div class="inline-fields"><div class="field"><label>Your discount vs catalog</label><div class="unit-input"><input data-f="disc" type="number" step="0.5" value="${disc}"><span>%</span></div></div><div class="field"><label>Delivery fee</label><div class="unit-input"><input data-f="delivery" type="number" step="5" value="${x.delivery || 0}"><span>$</span></div></div></div><div class="field"><label>Sells</label><div class="chips" data-role="cls">${Object.entries(CLASSES).map(([k, v]) => `<button class="chip ${(x.classes || []).includes(k) ? 'on' : ''}" data-k="${k}">${esc(v)}</button>`).join('')}</div></div><div class="field"><label>Notes</label><input data-f="notes" type="text" value="${esc(x.notes || '')}"></div></div>`);
    $('[data-role="cls"]', body).addEventListener('click', (e) => { const c = e.target.closest('[data-k]'); if (c) c.classList.toggle('on'); });
    const actions = [{ label: 'Save', onClick: () => { const name = $('[data-f="name"]', body).value.trim(); if (!name) { toast('Name the supplier'); return false; } Object.assign(x, { name, short: $('[data-f="short"]', body).value.trim() || name, domain: $('[data-f="domain"]', body).value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), factor: Math.round((1 - (Number($('[data-f="disc"]', body).value) || 0) / 100) * 1000) / 1000, delivery: Number($('[data-f="delivery"]', body).value) || 0, notes: $('[data-f="notes"]', body).value.trim(), classes: $$('[data-role="cls"] .chip.on', body).map((c) => c.dataset.k) }); if (!id) list.push(x); save(); draw(); return true; } }];
    if (id && !DEFAULT_SUPPLIERS.some((d) => d.id === id)) actions.push({ label: 'Delete supplier', cls: 'danger', onClick: () => { s.suppliers = list.filter((y) => y.id !== id); for (const k of Object.keys(s.supplierPrefs)) if (s.supplierPrefs[k] === id) delete s.supplierPrefs[k]; save(); draw(); return true; } });
    actions.push({ label: 'Cancel', cls: 'neutral' });
    sheet({ title: id ? x.name : 'Add supplier', body, actions });
  }
  draw(); return pn;
}
export { DEFAULT_PREFS };

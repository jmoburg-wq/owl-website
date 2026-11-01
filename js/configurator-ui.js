// Build tab — configure the product you're installing and see everything else the job needs:
// parts (required / recommended / optional, each with a reason), labor hours by trade, fees, supplier and cost.
import { store } from './store.js';
import { SYSTEMS, SYSTEM_MAP, GROUPS, newProduct, defaultAttrs, slug, compileProduct } from './pricing/products.js';
import { recompute, totals, lineTotal, lineHours, buildCtx, measureQty } from './pricing/estimator.js';
import { suppliersOf, supplierFor, supplierById, groupBySupplier, CLASSES } from './pricing/suppliers.js';
import { TRADES, METHOD_LABELS } from './pricing/profile.js';
import { runConfigure, runLivePrices, livePricesAvailable, aiStatus } from './pricing/ai.js';
import { kindOf, KINDS, areaSummary } from './geometry.js';
import { el, h, $, $$, toast, sheet, panel, icons, esc, switchEl, segEl, fmtMoney, fmtNum, money0, pct, readFileAsDataURL, confirmDialog, bind, debounce } from './ui.js';

const ICON = (k) => icons[k] || icons.cube;
let filter = { q: '', where: 'all' };

export function renderBuild(root, { navigate }) {
  const s = store.settings; const project = store.activeProject(); root.innerHTML = '';
  root.append(el(`<div class="hero"><h2>What are you installing?</h2><p>Pick the product — from any manufacturer or supply house. Fullbid lists everything else the job needs, where to buy it, what it costs, and the labor to put it in.</p></div>`));
  const bar = h('div', { class: 'row mt12', style: { gap: '8px' } }, el(`<input type="search" class="grow" placeholder="Search toilet, window, roof, deck…" value="${esc(filter.q)}" data-role="q">`)); root.append(bar);
  const seg = segEl([{ value: 'all', label: 'All' }, { value: 'interior', label: 'Inside' }, { value: 'exterior', label: 'Outside' }], filter.where, (v) => { filter.where = v; drawGrid(); }); seg.classList.add('mt8'); root.append(seg);
  const grid = h('div'); root.append(grid);
  const drawGrid = () => { grid.innerHTML = ''; const q = filter.q.toLowerCase();
    const ai = el(`<button class="prod-card ai" data-ai="1" style="grid-column:1/-1;width:100%"><div class="row"><div class="ic">${icons.sparkle}</div><div class="grow"><b>Something else? Describe it</b><div class="dim">Paste the product name, model, SKU or specs (or snap the box) and AI lists everything the install needs.${aiStatus(s).ready ? '' : ' Set up AI assist in Settings.'}</div></div></div></button>`);
    const g0 = h('div', { class: 'prod-grid' }, ai); grid.append(g0);
    for (const g of GROUPS) { const list = SYSTEMS.filter((x) => x.group === g && (filter.where === 'all' || x.where === filter.where) && (!q || `${x.name} ${x.group} ${x.vendors || ''}`.toLowerCase().includes(q))); if (!list.length) continue;
      grid.append(el(`<div class="group-head">${esc(g)}</div>`)); const gg = h('div', { class: 'prod-grid', style: { marginTop: '4px' } });
      for (const x of list) gg.append(el(`<button class="prod-card" data-sys="${x.key}"><div class="ic">${ICON(x.icon)}</div><b>${esc(x.name)}</b><div class="dim">${esc(x.vendors || '')}</div></button>`)); grid.append(gg); } };
  drawGrid();
  $('[data-role="q"]', root).addEventListener('input', debounce((e) => { filter.q = e.target.value.trim(); drawGrid(); }, 120));
  // on this job
  const job = h('div', { class: 'card' }); root.append(job);
  if (!project) job.append(el(`<p class="muted small">Products are added to the active job. Open or create one from <b>Jobs</b> first — or just configure to see the full list and cost.</p>`));
  else { const prods = project.estimate.products || []; job.append(el(`<div class="card-title"><h3>On ${esc(project.name)}</h3><span class="dim small">${prods.length} product${prods.length === 1 ? '' : 's'}</span></div>`));
    if (!prods.length) job.append(el(`<p class="dim small">Nothing configured yet. Pick a product above.</p>`));
    const items = project.estimate.items || [];
    for (const p of prods) { const lines = items.filter((i) => i.productId === p.id); const sys = p.ai ? null : SYSTEM_MAP[p.key]; const name = (sys ? sys.name : p.ai ? p.ai.productName : 'Product') + (p.productName ? ` — ${p.productName}` : ''); job.append(el(`<button class="item" data-inst="${p.id}" style="text-align:left;width:100%;display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><div class="lead">${ICON(sys ? sys.icon : 'sparkle')}</div><div class="grow"><b>${esc(name)}</b><div class="dim small">${lines.length} lines · ${fmtNum(lines.reduce((a, l) => a + lineHours(l), 0), 1)} labor hrs</div></div><b class="mono">${money0(lines.reduce((a, l) => a + lineTotal(l), 0))}</b></button>`)); }
    if (prods.length) job.append(el(`<button class="btn block mt12" data-go="estimate">${icons.doc} Open the bid ${icons.chevron}</button>`)); }
  bind(root, 'click', async (e) => {
    const t = e.target.closest('[data-sys],[data-ai],[data-inst],[data-go]'); if (!t) return;
    if (t.dataset.go) return navigate(t.dataset.go);
    if (t.dataset.sys) return openConfigurator(newProduct(t.dataset.sys, autoArea(t.dataset.sys, store.activeProject())), { isNew: true, onDone: () => renderBuild(root, { navigate }), navigate });
    if (t.dataset.inst) { const p = store.activeProject(); const inst = p && p.estimate.products.find((x) => x.id === t.dataset.inst); if (inst) openConfigurator(structuredClone(inst), { isNew: false, onDone: () => renderBuild(root, { navigate }), navigate }); return; }
    if (t.dataset.ai) return describeSheet({ onDone: () => renderBuild(root, { navigate }), navigate });
  });
}

/** For area-measured products, link the first matching measured area automatically. */
function autoArea(key, project) { const sys = SYSTEM_MAP[key]; if (!sys || !sys.measure || !project) return {}; const area = (project.rooms || []).find((r) => sys.measure.kinds.includes(kindOf(r))); return area ? { areaId: area.id, qty: null } : {}; }

function previewFor(inst, project, settings) {
  const temp = { rooms: (project && project.rooms) || [], estimate: { assemblies: [], products: [inst], items: [], removedKeys: [], adj: (project && project.estimate.adj) || { method: 'margin', targetMargin: 35 } } };
  recompute(temp, settings); return { items: temp.estimate.items, totals: totals(temp.estimate) };
}

export function openConfigurator(inst, { isNew = true, onDone, navigate } = {}) {
  const s = store.settings; const project = store.activeProject();
  const sys = inst.ai ? null : SYSTEM_MAP[inst.key]; const name = sys ? sys.name : (inst.ai && inst.ai.productName) || 'Product';
  inst.attrs = { ...(sys ? defaultAttrs(sys) : {}), ...(inst.attrs || {}) }; inst.on = inst.on || {}; inst.off = inst.off || {}; inst.prices = inst.prices || {};
  const pn = panel({ title: name, action: { label: isNew ? 'Add' : 'Save', onClick: () => save() }, onClose: () => onDone && onDone() });
  const B = pn.body; const sups = suppliersOf(s);
  const save = () => { let p = store.activeProject(); if (!p) { p = store.createProject({ name: `${name} job` }); } const est = p.estimate; est.products = est.products || []; const i = est.products.findIndex((x) => x.id === inst.id); if (i >= 0) est.products[i] = inst; else est.products.push(inst); recompute(p, s); store.update(() => {}, 'estimate'); toast(isNew ? `${name} added to ${p.name}` : 'Saved'); return true; };
  const refreshSoon = debounce(() => refresh(), 250);
  // --- your product
  const you = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Your product</h3>${sys && sys.vendors ? `<span class="dim tiny">${esc(sys.vendors)}</span>` : ''}</div>`));
  const mainCls = sys ? sys.cls : (inst.ai && inst.ai.supplierClass) || 'building'; const defSup = supplierFor(s, mainCls);
  you.append(el(`<div class="field"><label>Brand / model</label><input data-f="productName" type="text" value="${esc(inst.productName || '')}" placeholder="${sys ? 'e.g. ' + ({ toilet: 'Kohler Cimarron K-3851', window: 'Pella 250 double-hung 36×60', roof_system: 'GAF Timberline HDZ', water_heater: 'Rheem Performance Plus 50 gal', entry_door: 'Therma-Tru Classic-Craft' }[inst.key] || 'manufacturer and model') : ''}"></div>`));
  you.append(h('div', { class: 'inline-fields' }, el(`<div class="field"><label>SKU / item #</label><input data-f="sku" type="text" value="${esc(inst.sku || '')}"></div>`), el(`<div class="field"><label>Price you were quoted (per ${esc(sys ? sys.unit : (inst.ai && inst.ai.unit) || 'ea')})</label><div class="unit-input"><input data-f="price" type="number" step="0.01" inputmode="decimal" value="${inst.price ?? ''}" placeholder="catalog"><span>$</span></div></div>`)));
  you.append(el(`<div class="field"><label>Buying it from</label><select data-f="supplierId"><option value="">${esc(defSup.name)} (your default for ${esc(CLASSES[mainCls] || mainCls)})</option>${sups.map((x) => `<option value="${x.id}" ${inst.supplierId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`));
  B.append(you);
  you.addEventListener('input', (e) => { const f = e.target.dataset.f; if (!f) return; inst[f] = f === 'price' ? (e.target.value === '' ? null : Number(e.target.value)) : f === 'supplierId' ? e.target.value || null : e.target.value; refreshSoon(); });
  you.addEventListener('change', (e) => { if (e.target.dataset.f === 'supplierId') { inst.supplierId = e.target.value || null; refresh(); } });
  // --- configure
  if (sys && sys.attrs.length) { const cf = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Configure</h3></div>`));
    for (const o of sys.attrs) { if (o.type === 'select') { const f = el(`<div class="field"><label>${esc(o.label)}</label><select>${o.values.map((v) => `<option value="${esc(String(v.v))}" ${String(inst.attrs[o.key]) === String(v.v) ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>`); $('select', f).addEventListener('change', (e) => { const m = o.values.find((v) => String(v.v) === e.target.value); inst.attrs[o.key] = m ? m.v : e.target.value; refresh(); }); cf.append(f); }
      else if (o.type === 'bool') { const r = h('div', { class: 'row between mt12' }, el(`<span>${esc(o.label)}</span>`)); r.append(switchEl(!!inst.attrs[o.key], (v) => { inst.attrs[o.key] = v; refresh(); })); cf.append(r); }
      else { const f = el(`<div class="field"><label>${esc(o.label)}</label><input type="number" inputmode="decimal" value="${inst.attrs[o.key] ?? ''}" placeholder="${o.default ?? 'auto'}">${o.hint ? `<div class="dim tiny">${esc(o.hint)}</div>` : ''}</div>`); $('input', f).addEventListener('input', (e) => { inst.attrs[o.key] = e.target.value === '' ? null : Number(e.target.value); refreshSoon(); }); cf.append(f); } }
    B.append(cf); }
  // --- quantity
  const qc = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Quantity</h3></div>`)); B.append(qc);
  const drawQty = () => { qc.querySelectorAll('.field,.dim,.row').forEach((n) => n.remove());
    const areas = sys && sys.measure && project ? project.rooms.filter((r) => sys.measure.kinds.includes(kindOf(r))) : [];
    if (sys && sys.measure) { const f = el(`<div class="field"><label>From a measured area</label><select data-q="area"><option value="">None — enter quantity</option>${areas.map((a) => `<option value="${a.id}" ${inst.areaId === a.id ? 'selected' : ''}>${esc(a.name)} · ${esc(areaSummary(a, s.units))}</option>`).join('')}</select></div>`); qc.append(f);
      if (!areas.length) qc.append(el(`<div class="dim small mt8">No ${sys.measure.kinds.map((k) => KINDS[k].label.toLowerCase()).join(' or ')} measured on this job yet. Measure one for exact quantities, or type a quantity.</div>`)); }
    const auto = sys && sys.measure && inst.areaId && project ? measureQty(sys, buildCtx(project.rooms.filter((r) => r.id === inst.areaId))) : null;
    qc.append(el(`<div class="field"><label>${sys && sys.measure ? `Quantity (${esc({ sf: 'sq ft', roofSq: 'roof squares', wallSq: 'wall squares', gutterLf: 'linear ft', linLf: 'linear ft' }[sys.measure.metric] || sys.unit)})` : `How many (${esc(sys ? sys.unit : (inst.ai && inst.ai.unit) || 'ea')})`}</label><input data-q="qty" type="number" inputmode="decimal" step="0.1" value="${Number(inst.qty) > 0 ? inst.qty : ''}" placeholder="${auto != null ? fmtNum(auto, 1) + ' (from measurement)' : '1'}"></div>`)); };
  drawQty();
  qc.addEventListener('change', (e) => { if (e.target.dataset.q === 'area') { inst.areaId = e.target.value || null; inst.qty = null; drawQty(); refresh(); } });
  qc.addEventListener('input', (e) => { if (e.target.dataset.q === 'qty') { inst.qty = e.target.value === '' ? null : Number(e.target.value); refreshSoon(); } });
  if (!sys && (inst.qty == null || inst.qty === 0)) inst.qty = (inst.ai && inst.ai.baseQty) || 1;
  if (sys && !sys.measure && !(Number(inst.qty) > 0)) inst.qty = 1;
  // --- everything this job needs
  const needs = h('div', { class: 'card' }); B.append(needs);
  const sumCard = h('div', { class: 'card' }); B.append(sumCard);
  const whereCard = h('div', { class: 'card' }); B.append(whereCard);
  const notesCard = h('div', { class: 'card' }); B.append(notesCard);
  const actions = h('div', { class: 'col mt12' }); B.append(actions);
  function refresh() {
    const { items, totals: T } = previewFor(inst, project, s); const compiled = compileProduct({ ...inst, qty: Number(inst.qty) > 0 ? inst.qty : 1 }, {});
    const supName = (id) => { const x = supplierById(s, id); return x ? x.short || x.name : ''; };
    const byKey = new Map(items.map((i) => [i.key.split('|').pop(), i]));
    needs.innerHTML = `<div class="card-title"><h3>Everything this job needs</h3><span class="dim small">${items.length} lines</span></div>`;
    const groups = [['Your product', (l) => l.kind === 'product'], ['Required parts', (l) => l.kind === 'part' && l.need === 'required'], ['Recommended', (l) => l.kind === 'part' && l.need === 'recommended'], ['Optional upgrades', (l) => l.kind === 'part' && l.need === 'optional'], ['Labor', (l) => l.kind === 'labor'], ['Disposal, permits & fees', (l) => l.kind === 'fee']];
    for (const [label, fn] of groups) { const list = compiled.all.filter(fn); if (!list.length) continue; needs.append(el(`<div class="need-head"><span>${esc(label)}</span></div>`));
      for (const l of list) { const k = l.kind === 'product' ? 'main' : slug(l.name); const priced = byKey.get(k); const toggle = l.need === 'recommended' || l.need === 'optional'; const on = l.need === 'optional' ? !!inst.on[k] : l.need === 'recommended' ? !inst.off[k] : true;
        const row = el(`<div class="need-line ${on ? '' : 'off'}"><div class="tg"></div><div><div><b>${esc(l.kind === 'product' ? compiled.label : l.name)}</b></div>${l.why ? `<div class="why">${esc(l.why)}</div>` : ''}<div class="meta">${priced ? `${fmtNum(priced.qty, 2)} ${esc(priced.unit)}${l.kind === 'labor' ? ` · ${esc((TRADES[l.ltrade] || {}).label || l.ltrade)} @ ${fmtMoney(priced.unitCost)}/hr` : ` × ${fmtMoney(priced.unitCost)}`}${priced.supplierId ? ` · ${esc(supName(priced.supplierId))}` : ''} ${srcBadge(priced)}` : `${fmtNum(l.qty, 2)} ${esc(l.unit)} · not included`}${priced && priced.note ? ` · ${esc(priced.note)}` : ''}</div></div><div class="amt">${priced ? money0(lineTotal(priced)) : '—'}</div></div>`);
        if (toggle) $('.tg', row).append(switchEl(on, (v) => { if (l.need === 'optional') inst.on[k] = v; else inst.off[k] = !v; refresh(); }));
        needs.append(row); } }
    const t = T; sumCard.innerHTML = `<div class="card-title"><h3>Cost & your price</h3><span class="dim small">${esc(METHOD_LABELS[t.method] || 'Markup on cost')}</span></div><div class="kpi"><div class="stat"><div class="v">${money0(t.materials)}</div><div class="k">materials</div></div><div class="stat"><div class="v">${money0(t.labor)}</div><div class="k">labor · ${fmtNum(t.laborHours, 1)} hrs</div></div><div class="stat"><div class="v">${money0(t.cost)}</div><div class="k">your cost${t.fees ? ` (incl. ${money0(t.fees)} fees)` : ''}</div></div><div class="stat"><div class="v">${money0(t.preTax)}</div><div class="k">your price · ${pct(t.grossMargin, 0)} margin</div></div></div>`;
    const groupsS = groupBySupplier(items, s); whereCard.innerHTML = `<div class="card-title"><h3>Where to buy it</h3></div>` + groupsS.map((g) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${esc(g.supplier.name)}</b><div class="dim small">${g.lines.length} item${g.lines.length === 1 ? '' : 's'}${g.delivery ? ` · delivery ~$${g.delivery}` : ''}</div></div><b class="mono">${money0(g.subtotal)}</b></div>`).join('') + `<p class="dim tiny mt8">Change where each category comes from in Settings → Suppliers. Import your price sheets there to replace catalog prices.</p>`;
    notesCard.innerHTML = (compiled.notes || []).length ? `<div class="card-title"><h3>Before you order</h3></div>` + compiled.notes.map((n) => `<div class="flag info">${icons.info}<div>${esc(n)}</div></div>`).join('') : '';
    notesCard.classList.toggle('hidden', !(compiled.notes || []).length);
    pn._items = items;
  }
  actions.append(el(`<button class="btn block" data-a="save">${icons.check} ${isNew ? 'Add to this job' : 'Save changes'}</button>`));
  actions.append(el(`<button class="btn secondary block" data-a="live">${icons.sparkle} Check live supplier prices${livePricesAvailable(s) ? '' : ' (needs your API key)'}</button>`));
  if (!isNew) actions.append(el(`<button class="btn danger block" data-a="remove">${icons.trash} Remove from job</button>`));
  actions.addEventListener('click', async (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') { save(); pn.close(true); }
    if (a === 'remove') { if (await confirmDialog(`Remove ${name} and its parts and labor from the job?`, { okLabel: 'Remove', danger: true })) { const p = store.activeProject(); p.estimate.products = p.estimate.products.filter((x) => x.id !== inst.id); recompute(p, s); store.update(() => {}, 'estimate'); pn.close(true); } }
    if (a === 'live') { if (!livePricesAvailable(s)) { toast('Add your Anthropic API key in Settings → AI assist to search supplier sites for live prices', 4500); return; } const btn = e.target.closest('button'); btn.disabled = true; btn.innerHTML = `${icons.sparkle} Searching supplier sites…`;
      try { const mats = (pn._items || []).filter((i) => i.cat === 'material' && !(i.kind === 'product' && Number(inst.price) > 0)); const out = await runLivePrices({ items: mats, settings: s }); let n = 0; const now = new Date().toISOString();
        for (const pr of out.prices || []) { if (!pr.found || !(pr.price > 0)) continue; const line = mats.find((m) => m.key === pr.id); if (!line) continue; const k = line.key.split('|').pop(); inst.prices[k] = { unitCost: Math.round(pr.price * 100) / 100, url: pr.url, at: now, supplier: pr.supplier }; n++; }
        toast(`${n} of ${mats.length} items priced live${out.cost ? ` · ≈ ${fmtMoney(out.cost)}` : ''}`, 4500); refresh(); }
      catch (err) { toast(err.message || 'Live price check failed', 4500); }
      finally { btn.disabled = false; btn.innerHTML = `${icons.sparkle} Check live supplier prices`; } } });
  refresh(); return pn;
}

export function srcBadge(i) { const s = i.priceSource; if (!s || s === 'catalog') return ''; const cls = s === 'price list' ? 'list' : s === 'live' ? 'live' : s === 'edited' ? 'edited' : 'yours'; return `<span class="src ${cls}">${esc(s)}</span>`; }

function describeSheet({ onDone, navigate }) {
  const s = store.settings; const project = store.activeProject(); const photos = [];
  const body = el(`<div><p class="muted small">Paste what you’re installing — the product name, model and SKU, the specs, or the text of the supplier’s product page. Add a photo of the box or spec label if you have it.</p><div class="field"><label>Product</label><textarea data-f="d" placeholder="e.g. Pella Lifestyle Series double-hung, 36 × 60, white interior, replacing old wood windows in a 1960s ranch"></textarea></div><div class="inline-fields"><div class="field"><label>Quantity</label><input data-f="q" type="number" value="1" inputmode="decimal"></div><div class="field"><label>Where</label><select data-f="w"><option value="inside">Inside</option><option value="outside">Outside</option></select></div></div><label class="btn sm secondary mt8">${icons.camera} Add photo<input type="file" accept="image/*" capture="environment" multiple hidden></label><div class="dim small mt8" data-role="ph"></div></div>`);
  $('input[type=file]', body).addEventListener('change', async (e) => { for (const f of e.target.files) photos.push(await readFileAsDataURL(f, 1200)); $('[data-role="ph"]', body).textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} attached`; });
  if (!aiStatus(s).ready) { sheet({ title: 'Turn on AI assist', body: `<p class="muted">Describing any product needs AI assist: your own Anthropic API key (stored only on this device) or a server endpoint. Set it in <b>Settings → AI assist</b>.</p>`, actions: [{ label: 'Open Settings', onClick: () => navigate && navigate('settings') }, { label: 'Not now', cls: 'neutral' }] }); return; }
  sheet({ title: 'Describe the product', body, actions: [{ label: 'List everything it needs', keepOpen: true, onClick: async (_, close) => { const d = $('[data-f="d"]', body).value.trim(); if (!d && !photos.length) return toast('Describe the product or add a photo'); const btn = $$('.sheet .btn', document)[0]; if (btn) { btn.disabled = true; btn.textContent = 'Asking Claude…'; }
      try { const q = Number($('[data-f="q"]', body).value) || 1; const out = await runConfigure({ description: d, photos, qty: q, where: $('[data-f="w"]', body).value, settings: s }); close(); const inst = newProduct('ai', { ai: out.ai, qty: out.ai.baseQty || q, productName: '' }); toast(`${out.ai.parts.length} parts, ${out.ai.labor.length} labor tasks${out.cost != null ? ` · ≈ ${fmtMoney(out.cost)}` : ''}`); openConfigurator(inst, { isNew: true, onDone, navigate }); }
      catch (err) { toast(err.message || 'AI failed', 4500); if (btn) { btn.disabled = false; btn.textContent = 'List everything it needs'; } } } }, { label: 'Cancel', cls: 'neutral' }] });
}

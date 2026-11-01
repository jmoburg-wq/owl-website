// Change orders: photo + reason + priced lines → client signature → contract ledger updates itself.
import { store } from './store.js';
import { ASSEMBLIES, ASSEMBLY_MAP, UNITS, ITEM_LIBRARY } from './pricing/catalog.js';
import { takeoff, customItem, coTotals, ledger, lineTotal, recompute } from './pricing/estimator.js';
import { runConfigure, aiStatus } from './pricing/ai.js';
import { kindOf, KINDS } from './geometry.js';
import { openCODocument } from './document.js';
import { el, h, $, $$, toast, sheet, panel, icons, esc, segEl, switchEl, fmtMoney, fmtNum, money0, readFileAsDataURL, confirmDialog, debounce } from './ui.js';

const commit = () => store.update(() => {}, 'project');

export function openChangeOrder(project, coId, { onDone } = {}) {
  const s = store.settings; project.changeOrders = project.changeOrders || []; const est = project.estimate;
  let co = coId ? project.changeOrders.find((c) => c.id === coId) : null; const isNew = !co;
  if (!co) co = { id: Math.random().toString(36).slice(2, 9), n: project.changeOrders.reduce((m, c) => Math.max(m, c.n), 0) + 1, title: '', reason: '', photo: '', items: [], status: 'draft', scheduleDays: 0, credit: false, createdAt: new Date().toISOString() };
  const save = () => { if (!project.changeOrders.includes(co)) project.changeOrders.push(co); commit(); };
  const pn = panel({ title: `Change order #${co.n}`, action: { label: 'Save', onClick: () => { if (!co.title.trim()) { toast('Give the change a title'); return false; } save(); toast('Change order saved'); return true; } }, onClose: () => onDone && onDone() });
  const B = pn.body;
  const head = el(`<div class="card"><div class="field"><label>What changed</label><input data-f="title" type="text" value="${esc(co.title)}" placeholder="e.g. Replace rotted subfloor at tub"></div><div class="field"><label>Why (shown to the client)</label><textarea data-f="reason" placeholder="What you found, and what it takes to fix it">${esc(co.reason)}</textarea></div><div class="inline-fields"><div class="field"><label>Schedule impact (days)</label><input data-f="scheduleDays" type="number" value="${co.scheduleDays || 0}"></div><div class="field"><label>Type</label><div data-role="credit"></div></div></div><div class="row mt8" style="gap:8px"><label class="btn sm secondary">${icons.camera} ${co.photo ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/*" capture="environment" hidden></label>${co.photo ? `<img src="${co.photo}" style="height:48px;border-radius:8px">` : ''}</div></div>`);
  $('[data-role="credit"]', head).append(segEl([{ value: 'add', label: 'Add' }, { value: 'credit', label: 'Credit' }], co.credit ? 'credit' : 'add', (v) => { co.credit = v === 'credit'; draw(); }));
  head.addEventListener('input', (e) => { const f = e.target.dataset.f; if (!f) return; co[f] = f === 'scheduleDays' ? Number(e.target.value) || 0 : e.target.value; });
  $('input[type=file]', head).addEventListener('change', async (e) => { if (e.target.files[0]) { co.photo = await readFileAsDataURL(e.target.files[0], 1000); toast('Photo attached'); } });
  B.append(head);
  const linesCard = h('div', { class: 'card' }); const sumCard = h('div', { class: 'card' }); const actCard = h('div', { class: 'col mt12' }); B.append(linesCard, sumCard, actCard);
  function draw() {
    linesCard.innerHTML = `<div class="card-title"><h3>Priced lines</h3><span class="dim small">${co.items.length}</span></div>`;
    if (!co.items.length) linesCard.append(el(`<p class="dim small">Add a work item (quantities from your measurements), a custom line, or let AI draft the parts and labor from your description.</p>`));
    co.items.forEach((it, i) => linesCard.append(el(`<div class="line"><div><div class="name">${esc(it.name)}</div><div class="meta"><span class="pill ${it.cat}">${it.cat}</span><span>${fmtNum(it.qty, 2)} ${esc(it.unit)} × ${fmtMoney(it.unitCost)}</span></div></div><div class="row" style="gap:6px"><div class="amt">${fmtMoney(lineTotal(it))}</div><button class="btn xs danger" data-del="${i}">${icons.x}</button></div></div>`)));
    linesCard.append(el(`<div class="btn-grid mt8"><button class="btn sm secondary" data-a="work">${icons.plus} Work item</button><button class="btn sm secondary" data-a="custom">${icons.plus} Custom line</button></div>`), el(`<button class="btn sm block mt8 ${aiStatus(s).ready ? 'success' : 'neutral'}" data-a="ai">${icons.sparkle} Draft lines with AI from the description${aiStatus(s).ready ? '' : ' · set up'}</button>`));
    const t = coTotals(co, est); const L = ledger(project); const after = co.status === 'approved' ? L.revised : L.revised + t.total;
    sumCard.innerHTML = `<div class="card-title"><h3>This change</h3><span class="pill ${co.status === 'approved' ? 'signed' : co.status === 'sent' ? 'sent' : 'draft'}">${esc(co.status)}</span></div><div class="totals"><div class="trow sub"><span>Your cost</span><span>${fmtMoney(Math.abs(t.cost))}</span></div><div class="trow sub"><span>Price before tax</span><span>${fmtMoney(t.preTax)}</span></div><div class="trow sub"><span>Tax</span><span>${fmtMoney(t.tax)}</span></div><div class="trow grand"><span>${co.credit ? 'Credit' : 'Change order'}</span><span>${fmtMoney(t.total)}</span></div><div class="trow sub mt8"><span>Contract now</span><span>${fmtMoney(L.revised)}</span></div><div class="trow"><b>Contract if approved</b><b>${fmtMoney(after)}</b></div></div>`;
    actCard.innerHTML = '';
    if (co.status !== 'approved') actCard.append(el(`<button class="btn success block" data-a="doc">${icons.sign} Review with client, sign or share</button>`));
    else actCard.append(el(`<button class="btn secondary block" data-a="doc">${icons.doc} View approved change order</button>`));
    if (co.status !== 'approved') actCard.append(el(`<button class="btn neutral block" data-a="decline">Mark declined</button>`));
    if (!isNew || project.changeOrders.includes(co)) actCard.append(el(`<button class="btn danger block" data-a="delete">${icons.trash} Delete</button>`));
  }
  B.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]'); if (del) { co.items.splice(Number(del.dataset.del), 1); draw(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'custom') customLine();
    if (a === 'work') workItem();
    if (a === 'ai') aiDraft(e.target.closest('button'));
    if (a === 'doc') { if (!co.title.trim()) return toast('Give the change a title first'); save(); openCODocument(project, co, { onChange: draw }); }
    if (a === 'decline') { co.status = 'declined'; save(); draw(); toast('Marked declined'); }
    if (a === 'delete') { if (await confirmDialog(`Delete change order #${co.n}?`, { okLabel: 'Delete', danger: true })) { project.changeOrders = project.changeOrders.filter((c) => c.id !== co.id); commit(); pn.close(); } }
  });
  function customLine() {
    const body = el(`<div><div class="chips" data-role="lib">${ITEM_LIBRARY.map((L2, i) => `<button class="chip" data-i="${i}">${esc(L2.name)}</button>`).join('')}</div><div class="field"><label>Item</label><input data-f="name" type="text"></div><div class="inline-fields three"><div class="field"><label>Qty</label><input data-f="qty" type="number" step="0.01" value="1"></div><div class="field"><label>Unit</label><select data-f="unit">${UNITS.map((u) => `<option>${u}</option>`).join('')}</select></div><div class="field"><label>Your cost / unit</label><input data-f="cost" type="number" step="0.01" value="0"></div></div><div class="field"><label>Type</label><select data-f="cat"><option value="material">Material</option><option value="labor">Labor</option><option value="fee">Fee</option></select></div></div>`);
    $('[data-role="lib"]', body).addEventListener('click', (e) => { const c = e.target.closest('[data-i]'); if (!c) return; const L2 = ITEM_LIBRARY[Number(c.dataset.i)]; $('[data-f="name"]', body).value = L2.name; $('[data-f="unit"]', body).value = L2.unit; $('[data-f="cost"]', body).value = L2.unitCost; $('[data-f="cat"]', body).value = L2.cat; });
    sheet({ title: 'Custom line', body, actions: [{ label: 'Add', onClick: () => { const name = $('[data-f="name"]', body).value.trim(); if (!name) { toast('Name the item'); return false; } co.items.push(customItem({ name, cat: $('[data-f="cat"]', body).value, unit: $('[data-f="unit"]', body).value, qty: Number($('[data-f="qty"]', body).value) || 1, unitCost: Number($('[data-f="cost"]', body).value) || 0 })); draw(); return true; } }, { label: 'Cancel', cls: 'neutral' }] });
  }
  function workItem() {
    const areas = project.rooms || []; const body = el(`<div><div class="field"><label>Work item</label><select data-f="asm">${ASSEMBLIES.map((x) => `<option value="${x.key}">${esc(x.trade)} — ${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Area</label><select data-f="area">${areas.map((r) => `<option value="${r.id}">${esc(r.name)} (${esc(KINDS[kindOf(r)].short)})</option>`).join('')}<option value="">No measured area (enter quantities after)</option></select></div><p class="dim small">Quantities come from the area's measurements and are priced with your suppliers and labor rates. Edit lines afterwards if the change covers only part of it.</p></div>`);
    sheet({ title: 'Add a work item', body, actions: [{ label: 'Add lines', onClick: () => { const key = $('[data-f="asm"]', body).value; const areaId = $('[data-f="area"]', body).value; const temp = { rooms: areaId ? areas.filter((r) => r.id === areaId) : [], estimate: { assemblies: [{ key, opts: {} }], products: [], items: [], removedKeys: [], adj: est.adj } }; const lines = takeoff(temp, s); if (!lines.length) { toast(`${ASSEMBLY_MAP[key].name} needs a ${ASSEMBLY_MAP[key].kinds.map((k) => KINDS[k].label.toLowerCase()).join(' or ')}`); return false; } for (const l of lines) co.items.push({ ...customItem({ name: l.name, cat: l.cat, unit: l.unit, qty: l.qty, unitCost: l.unitCost, supplierId: l.supplierId, hours: l.hours, ltrade: l.ltrade }) }); draw(); toast(`${lines.length} lines added`); return true; } }, { label: 'Cancel', cls: 'neutral' }] });
  }
  async function aiDraft(btn) {
    if (!aiStatus(s).ready) return toast('Set up AI assist in Settings to draft lines', 3500);
    const desc = `${co.title}\n${co.reason}`.trim(); if (!desc) return toast('Describe the change first');
    btn.disabled = true; btn.textContent = 'Asking Claude…';
    try { const out = await runConfigure({ description: `Change order on an active job: ${desc}`, photos: co.photo ? [co.photo] : [], qty: 1, settings: s });
      const r = out.ai; if (r.unitPrice > 0) co.items.push(customItem({ name: r.productName, cat: 'material', unit: r.unit, qty: r.baseQty || 1, unitCost: r.unitPrice }));
      for (const p of r.parts.filter((x) => x.need !== 'optional')) co.items.push(customItem({ name: p.name, cat: 'material', unit: p.unit, qty: p.qty, unitCost: p.unitCost }));
      for (const l of r.labor) co.items.push(customItem({ name: l.task, cat: 'labor', unit: 'hr', qty: l.hours, unitCost: 60, ltrade: l.trade }));
      for (const f of r.fees.filter((x) => x.need === 'required')) co.items.push(customItem({ name: f.name, cat: 'fee', unit: f.unit, qty: f.qty, unitCost: f.unitCost }));
      toast(`AI drafted ${co.items.length} lines — review before sending`, 4000); draw(); }
    catch (err) { toast(err.message || 'AI failed', 4000); } finally { btn.disabled = false; }
  }
  draw(); return pn;
}

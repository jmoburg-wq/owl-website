// Design jobs from Contractor Visual Studio: import preview, the design card on the bid, and the send check.
import { store } from './store.js';
import { importCvsPackage, describeDiff, packageFromHash, sendReadiness, acceptStarterPrices, setCvsPrice, setLaborChoice, setActiveOption, cvsTrades, tradeLabel, LEVELS, adoptPendingDesign, addMeasurement, setWorkPrice, optionPrices, hasWorkItems, setPriceLaborSeparately, isJobLine } from './cvs/import.js';
import { totals } from './pricing/estimator.js';
import { deriveMeasurements, fillFromAreas, outgoingMeasurements, measurementPacket, designLinkWithMeasurements } from './cvs/measure-out.js';
import { MEASURE_KINDS, MEASURE_NAMES, SOURCE_NAMES } from './shared/vocab.js';
import { PACK_MAP } from './trades/index.js';
import { el, h, $, $$, toast, sheet, icons, esc, fmtMoney, fmtNum, confirmDialog, promptDialog, panel, shareOrCopy, download } from './ui.js';
import { jobMaterialsByPhase, laborByTrade, siteChecklist, setCheck, setJobQty, setAllowance, pickLines, customerBid, materialOrderSheet, orderSheetText, BID_LABOR } from './cvs/job.js';

const commit = (tag = 'project') => store.update(() => {}, tag);

/** Run a package (from a file, link or drop) through the one importer, show the preview, create on confirm. */
export async function startCvsImport(obj, { navigate } = {}) {
  const plan = importCvsPackage(obj, { settings: store.settings, projects: store.projects() });
  if (!plan.ok) { await new Promise((res) => sheet({ title: 'Could not import this design', body: `<p>${esc(plan.error)}</p>`, onClose: res, actions: [{ label: 'OK' }] })); return null; }
  const pv = plan.preview; const body = h('div');
  body.append(el(`<div class="card flat"><b>${esc(pv.text)}</b><div class="dim small mt8">Trade: ${esc(pv.packName)}${plan.createsSupplier ? ` · adds “${esc(plan.companySupplier.name)}” to your suppliers` : ''}</div></div>`));
  let keepEdits = true;
  if (plan.mode === 'new') {
    const notes = [];
    if (pv.work) notes.push('Priced work comes in at your bid’s prices and prints on the client’s bid. The takeoff materials become the order list and your cost; they are not added to the price again.');
    else notes.push('Materials come in without prices unless the design carries one (each shows “needs a price” until you price it from your price list or type your price).');
    if (pv.labor) notes.push('Labor comes in by trade at your rates.');
    else if (pv.fillsLabor) notes.push(`The design sends no labor hours, so ${esc(pv.packName)} hours are worked out from the measurements${pv.needs.length ? `; enter the ${esc(pv.needs.map((n) => n.label.toLowerCase()).join(' and '))} to finish them` : ''}.`);
    notes.push('Nothing is created until you tap Import.');
    body.append(el(`<p class="muted small mt12">${notes.join(' ')}</p>`));
  }
  else {
    const d = plan.diff || [];
    body.append(el(`<p class="mt12"><b>${esc(plan.existing.name)}</b> is already on this device. ${plan.mode === 'change-order' ? 'It is signed, so these differences become a change order draft for the client to sign.' : 'These are the differences from what you have:'}</p>`));
    body.append(d.length ? el(`<div class="list mt8">${d.map((x) => `<div class="flag info">${icons.info}<div>${esc(describeDiff(x))}</div></div>`).join('')}</div>`) : el(`<p class="dim small mt8">No differences.</p>`));
    if (plan.mode === 'update' && d.length) { const row = el(`<label class="row mt12" style="gap:8px"><input type="checkbox" checked data-role="keep"> Keep lines I edited (uncheck to take the design's values)</label>`); row.querySelector('input').addEventListener('change', (e) => (keepEdits = e.target.checked)); body.append(row); }
  }
  const label = plan.mode === 'new' ? 'Import' : plan.mode === 'update' ? 'Apply changes' : 'Create change order draft';
  const go = await new Promise((res) => sheet({ title: plan.mode === 'new' ? 'Import a design' : 'Updated design', body, onClose: (r) => res(r === true), actions: [{ label, cls: 'success', onClick: () => true }, { label: 'Cancel', cls: 'neutral', onClick: () => false }] }));
  if (!go) return null;
  const result = plan.apply(store.state, { keepEdits, newProject: () => store.createProject({}) });
  store.update((st) => { st.activeProjectId = result.project.id; st.activeRoomId = null; }, 'project');
  toast(plan.mode === 'new' ? 'Design imported' : plan.mode === 'update' ? 'Design changes applied' : 'Change order draft created');
  if (navigate) navigate('estimate');
  return result;
}

/** #cvs=d:… or #cvs-url=… */
export async function handleCvsHash(hash, { navigate } = {}) {
  if (!/[#&]cvs(-url)?=/.test(hash || '')) return false;
  history.replaceState(null, '', location.pathname + '#/home');
  const r = await packageFromHash(hash, store.settings);
  if (!r) return false;
  if (r.error) { toast(r.error, 4000); return true; }
  await startCvsImport(r.obj, { navigate }); return true;
}

export async function importCvsFile(file, opts) {
  let obj; try { obj = JSON.parse(await file.text()); } catch { toast('That file is not a design package.'); return null; }
  return startCvsImport(obj, opts);
}

/** Drop a .json design package anywhere on the Jobs screen. */
export function enableCvsDrop(root, opts) {
  if (root.__cvsDrop) return; root.__cvsDrop = true;
  root.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === 'file')) { e.preventDefault(); root.classList.add('dropping'); } });
  root.addEventListener('dragleave', () => root.classList.remove('dropping'));
  root.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])].find((x) => /\.json$/i.test(x.name) || x.type === 'application/json'); root.classList.remove('dropping'); if (!f) return; e.preventDefault(); importCvsFile(f, opts); });
}

// ---- on the bid
export const cvsLineBadges = (it) => !isJobLine(it) ? '' : `${it.unitCost == null ? '<span class="src needs">needs a price</span>' : it.evidence && /^E[01]$/.test(it.evidence) && !it.accepted ? '<span class="src starter">starter price: replace with yours</span>' : it.evidence ? `<span class="src yours">${esc(it.evidence)}</span>` : ''}${it.seenOn ? `<span class="dim">· seen ${esc(it.seenOn)}, not a quote</span>` : ''}${it.typical ? `<span class="src typical">${it.recompute ? 'typical size · re-measured' : 'typical size'}</span>` : ''}${it.origin === 'pack' ? '<span class="src typical">worked out by Fullbid</span>' : ''}${(it.needsMeasure || []).length ? '<span class="src needs">needs a measurement</span>' : ''}${it.orderOnly ? '<span class="dim">· order list only, not in the price</span>' : ''}${it.noOrder ? '<span class="dim">· your stock</span>' : ''}${it.needsSupplier ? '<span class="dim">· pick a supplier</span>' : ''}${it.confirmSupplier ? '<span class="src starter">Confirm supplier</span>' : ''}`;
export const lineAmount = (it, fmt) => (it.unitCost == null ? '<span class="needs-price">Needs a price</span>' : fmt);

export function cvsCard(project, rerender) {
  const cvs = project.cvs; const est = project.estimate; const s = store.settings;
  const card = h('div', { class: 'card', 'data-role': 'cvs-card' });
  const ready = sendReadiness(project);
  const opts = cvs.options || [];
  card.append(el(`<div class="card-title"><h3>Design from ${esc(cvs.company.name || 'CVS')}</h3><span class="pill ${ready.ok ? 'signed' : 'draft'}">${ready.ok ? 'ready to send' : 'needs prices'}</span></div>`));
  if (cvs.design.summary) card.append(el(`<p class="small muted">${esc(cvs.design.summary)}</p>`));
  if (cvs.design.url) card.append(el(`<a class="btn xs secondary mt8" href="${esc(cvs.design.url)}" target="_blank" rel="noopener" data-role="open-design">${icons.back} Open the design in the Studio</a>`));
  if (opts.length > 1) {
    const chips = h('div', { class: 'chips mt8' });
    for (const o of opts) chips.append(el(`<button class="chip ${o.id === cvs.activeOption ? 'on' : ''}" data-cvs-opt="${esc(o.id)}">${esc(o.name)}${o.band ? ` <span class="dim">${esc(o.band)}</span>` : ''}</button>`));
    card.append(el(`<div class="dim small mt8">Options (shown to the client as ${opts.length === 3 ? 'Good / Better / Best' : 'choices'}):</div>`), chips);
  }
  const prices = opts.some((o) => o.total != null) ? optionPrices(project, totals) : [];
  if (prices.length) card.append(el(`<div class="mt8" data-role="cvs-totals">${prices.map((x) => `<div class="row between small" style="padding:3px 0"><span>${esc(x.name)}</span><span class="mono">${x.theirs == null ? '' : `your bid ${fmtMoney(x.theirs)} · `}Fullbid ${fmtMoney(x.ours)}</span></div>${x.warn ? `<div class="flag" data-role="cvs-total-warn">${icons.warn}<div>${esc(x.name)}: Fullbid's price (before tax) differs from your bid's total by ${fmtMoney(Math.abs(x.diff))} (${fmtNum(x.pct, 1)}%). Check for a line that needs a price, a markup, or a discount.</div></div>` : ''}`).join('')}</div>`));
  for (const n of cvs.needs || []) if (!(project.measurements || []).some((m) => m.kind === n.kind)) card.append(el(`<div class="flag mt8" data-role="cvs-need">${icons.warn}<div class="grow"><b>${esc(n.label)} needed.</b> ${esc(n.why || '')} Fullbid won't assume one.</div><button class="btn xs" data-cvs-need="${esc(n.kind)}" data-label="${esc(n.label)}" data-unit="${esc(n.unit || '')}">Enter</button></div>`));
  if (hasWorkItems(project)) { const row = el(`<label class="row mt8 small" style="gap:8px"><input type="checkbox" data-cvs-lab-sep ${cvs.priceLaborSeparately ? 'checked' : ''}> Price labor separately: add labor worked out from the measurements on top of the priced work (leave off when your installed prices include labor)</label>`); card.append(row); }
  if (!ready.ok) card.append(el(`<div class="flag mt8">${icons.warn}<div class="grow">${esc(ready.message)}. The proposal can't be sent until every line has a price or you accept the starter prices${ready.waiting && ready.waiting.length ? ', and the missing measurements are entered' : ''}.</div></div>`));
  const acts = h('div', { class: 'row wrap mt8', style: { gap: '8px' } });
  if (ready.unpriced.some((l) => l.cat === 'material' || l.cat === 'work')) acts.append(el(`<button class="btn sm" data-cvs="price">${icons.dollar} ${ready.unpriced.some((l) => l.cat === 'material') ? 'Price materials' : 'Price lines'}</button>`));
  if (ready.starter.length) acts.append(el(`<button class="btn sm secondary" data-cvs="accept">${icons.check} Accept starter prices</button>`));
  if (cvsTrades(project).length) acts.append(el(`<button class="btn sm secondary" data-cvs="labor">${icons.edit} Labor by trade</button>`));
  card.append(acts);
  if (cvs.recompute) card.append(el(`<div class="flag info mt8">${icons.info}<div>You measured ${esc(cvs.recompute.kinds.join(', '))}. Lines marked “typical size” rest on a standard size: send the measurements to the designer for a re-fitted design, or adjust those quantities.</div></div>`));
  if (cvs.pendingPkg) card.append(el(`<div class="flag info mt8">${icons.info}<div>An updated design is waiting on a change order. It becomes the job's design when the client approves it.</div></div>`));
  const refs = (opts.find((o) => o.id === cvs.activeOption) || {}).priceBookRefs || [];
  if (refs.length) card.append(el(`<div class="dim small mt8"><b>Reference notes from ${esc(cvs.company.name)}:</b> ${refs.map((r) => esc(`${r.item}${r.note ? ` (${r.note})` : ''}`)).join('; ')}</div>`));
  card.addEventListener('change', (e) => { if (e.target.matches('[data-cvs-lab-sep]')) { setPriceLaborSeparately(project, e.target.checked, s); commit(); rerender(); } });
  card.addEventListener('click', async (e) => {
    const nd = e.target.closest('[data-cvs-need]');
    if (nd) { const v = await promptDialog(`${nd.dataset.label}${nd.dataset.unit ? ` (${nd.dataset.unit})` : ''}`, { label: nd.dataset.unit === 'x/12' ? 'Rise in inches per 12 in. of run, as measured' : 'As measured on site', type: 'number', value: '' }); if (v === null || !(Number(v) > 0)) return; addMeasurement(project, { kind: nd.dataset.cvsNeed, value: Number(v), unit: nd.dataset.unit, source: 'measured' }, s); commit(); rerender(); return; }
    const o = e.target.closest('[data-cvs-opt]'); if (o) { setActiveOption(project, o.dataset.cvsOpt, s); commit(); rerender(); return; }
    const a = e.target.closest('[data-cvs]')?.dataset.cvs; if (!a) return;
    if (a === 'accept') { if (await confirmDialog(`Accept ${ready.starter.length} starter price${ready.starter.length === 1 ? '' : 's'} as they are? They are national figures adjusted for your region, not your prices.`, { okLabel: 'Accept', title: 'Starter prices' })) { acceptStarterPrices(project); commit(); rerender(); } }
    if (a === 'price') { await priceSheet(project); commit(); rerender(); }
    if (a === 'labor') { await laborSheet(project); commit(); rerender(); }
  });
  return card;
}

async function priceSheet(project) {
  const seen = new Set(); const unpriced = sendReadiness(project).unpriced; const rows = unpriced.filter((l) => l.cat === 'material' && l.origin === 'cvs' && l.cvsId && !seen.has(l.cvsId) && seen.add(l.cvsId));
  const work = unpriced.filter((l) => l.cat === 'work'); const optName = (id) => ((project.cvs.options || []).find((o) => o.id === id) || {}).name || '';
  const body = h('div');
  if (rows.length) body.append(el(`<p class="dim small">Your price per unit (what it costs you). A price you type here is used for this material in every option.</p>`));
  for (const l of rows) body.append(el(`<div class="field"><label>${esc(l.name)} <span class="dim">· ${fmtNum(l.qty, 2)} ${esc(l.unitText || l.unit)}</span></label><input type="number" step="0.01" inputmode="decimal" placeholder="Needs a price" data-cvs-id="${esc(l.cvsId)}"></div>`));
  if (work.length) body.append(el(`<p class="dim small mt8">Priced work: your installed price per unit, as the client sees it.</p>`));
  for (const l of work) body.append(el(`<div class="field"><label>${esc(l.name)} <span class="dim">· ${esc(optName(l.cvsOption))} · ${fmtNum(l.qty, 2)} ${esc(l.unitText || l.unit)}</span></label><input type="number" step="0.01" inputmode="decimal" placeholder="Needs a price" data-work-key="${esc(l.key)}"></div>`));
  await new Promise((res) => sheet({ title: rows.length ? 'Price materials' : 'Price lines', body, onClose: res, actions: [{ label: 'Save prices', onClick: () => { for (const inp of $$('[data-cvs-id]', body)) if (inp.value !== '') setCvsPrice(project, inp.dataset.cvsId, Number(inp.value)); for (const inp of $$('[data-work-key]', body)) if (inp.value !== '') setWorkPrice(project, inp.dataset.workKey, Number(inp.value)); return true; } }, { label: 'Cancel', cls: 'neutral' }] }));
}

async function laborSheet(project) {
  const s = store.settings; const choice = project.cvs.laborChoice || {}; const body = h('div');
  body.append(el(`<p class="dim small">Hours come from the design for one unit × units. Pick low, middle or high per trade, or give the trade to a sub for a lump sum.</p>`));
  for (const t of cvsTrades(project)) {
    const cur = choice[t] || 'mid'; const isSub = cur && typeof cur === 'object';
    body.append(el(`<div class="field"><label>${esc(tradeLabel(t))}</label><div class="row" style="gap:6px">${LEVELS.map((lv) => `<button class="chip ${!isSub && cur === lv ? 'on' : ''}" data-trade="${esc(t)}" data-level="${lv}">${lv === 'mid' ? 'middle' : lv}</button>`).join('')}<button class="chip ${isSub ? 'on' : ''}" data-trade="${esc(t)}" data-level="sub">${isSub ? `sub ${fmtMoney(cur.sub)}` : 'sub'}</button></div></div>`));
  }
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-level]'); if (!b) return; const t = b.dataset.trade; let v = b.dataset.level;
    if (v === 'sub') { const amt = await promptDialog(`${tradeLabel(t)}: sub's lump sum`, { label: 'Their price for this job ($)', type: 'number', value: '' }); if (amt === null || !(Number(amt) > 0)) return; v = { sub: Number(amt) }; }
    setLaborChoice(project, t, v, s); $$(`[data-trade="${CSS.escape(t)}"]`, body).forEach((x) => x.classList.toggle('on', x === b)); if (v && typeof v === 'object') b.textContent = `sub ${fmtMoney(v.sub)}`;
  });
  await new Promise((res) => sheet({ title: 'Labor by trade', body, onClose: res, actions: [{ label: 'Done' }] }));
}

/** Editing one imported line in the line sheet. */
export function saveCvsLineEdit(project, it, before, rawCost) {
  const v = rawCost === '' ? null : Number(rawCost);
  if (v !== before.unitCost) {
    if (it.cat === 'material' && it.origin === 'cvs') setCvsPrice(project, it.cvsId, v);
    else { it.unitCost = v; it.evidence = v == null ? null : 'E2'; it.priceSource = 'your rate'; it.priceLocked = true; it.accepted = false; }
  }
  if (it.qty !== before.qty || it.name !== before.name || it.unit !== before.unit) { it.locked = true; it.edited = { qty: it.qty, name: it.name }; }
}

/** Before the proposal goes out: refuse while lines need a price. Returns true when it may be sent. */
export async function checkReadyToSend(project) {
  if (!project.cvs) return true;
  const r = sendReadiness(project); if (r.ok) return true;
  await new Promise((res) => sheet({ title: 'Not ready to send', body: `<p>${esc(r.message)}.</p><p class="muted small mt8">Price each line (your price list, a supplier price, or your own number), or accept the starter prices on the bid screen. Nothing goes to the client at $0.</p>`, onClose: res, actions: [{ label: 'OK' }] }));
  return false;
}

/** When a design change order is approved, the new design becomes the job's design. */
export function onChangeOrderApproved(project, co) { if (co && co.origin === 'cvs' && project.cvs && project.cvs.pendingPkg) { adoptPendingDesign(project, store.settings); return true; } return false; }

// ---- measurements: what's on the job, and sending them back to the design (direction doc section 5)
const fmtM = (m) => `${fmtNum(Number(m.value), 2)} ${esc(m.unit || MEASURE_KINDS[m.kind] || '')}`;
export function measurementsCard(project, rerender) {
  const list = project.measurements || []; const out = outgoingMeasurements(project); const derived = deriveMeasurements(project);
  const card = h('div', { class: 'card', 'data-role': 'measure-card' });
  card.append(el(`<div class="card-title"><h3>Measurements</h3><span class="dim small">${list.length}</span></div>`));
  if (!list.length) card.append(el(`<p class="dim small">No measurements on this job yet. Add what you measured on site; the designer can re-fit the design to them.</p>`));
  for (const m of list) card.append(el(`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${esc(MEASURE_NAMES[m.kind] || m.kind)}</b><div class="dim small">${esc(SOURCE_NAMES[m.source] || m.source || '')}${m.from === 'cvs' ? ' · from the design' : ''}${m.replaced ? ` · replaced ${fmtNum(Number(m.replaced.value), 2)} (${esc(SOURCE_NAMES[m.replaced.source] || m.replaced.source)})` : ''}</div></div><div class="mono" style="white-space:nowrap">${fmtM(m)}</div></div>`));
  const acts = h('div', { class: 'row wrap mt8', style: { gap: '8px' } });
  acts.append(el(`<button class="btn sm secondary" data-m="add">${icons.plus} Add a measurement</button>`));
  if (derived.length) acts.append(el(`<button class="btn sm secondary" data-m="fill">${icons.check} Use my measured areas (${derived.length})</button>`));
  if (out.length) acts.append(el(`<button class="btn sm" data-m="send">${icons.share} Send ${out.length} to the designer</button>`));
  card.append(acts);
  if (out.length && !(project.cvs && project.cvs.design && project.cvs.design.url)) card.append(el(`<p class="dim small mt8">This design has no link back to the Studio. Send the file instead: the Studio opens it on the customer's Measurements card.</p>`));
  card.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-m]')?.dataset.m; if (!a) return;
    if (a === 'add') { if (await addMeasurementSheet(project)) { commit(); rerender(); } }
    if (a === 'fill') { const n = fillFromAreas(project); commit(); toast(n ? `${n} measurement${n === 1 ? '' : 's'} added from your measured areas` : 'Nothing new: the job already has these or better numbers'); rerender(); }
    if (a === 'send') { await sendMeasurementsSheet(project); }
  });
  return card;
}

async function addMeasurementSheet(project) {
  const pack = PACK_MAP[(project.cvs && project.cvs.pack) || 'general']; const first = new Set((pack && pack.meta.measurements) || []);
  const kinds = [...Object.keys(MEASURE_KINDS).filter((k) => first.has(k)), ...Object.keys(MEASURE_KINDS).filter((k) => !first.has(k))];
  const body = el(`<div><div class="field"><label>What</label><select data-f="kind">${kinds.map((k) => `<option value="${esc(k)}">${esc(MEASURE_NAMES[k] || k)} (${esc(MEASURE_KINDS[k])})</option>`).join('')}</select></div>
    <div class="field"><label>Number</label><input data-f="value" type="number" step="0.1" inputmode="decimal"></div>
    <div class="field"><label>Where it came from</label><select data-f="source">${['measured', 'report', 'satellite', 'photo', 'typed'].map((s) => `<option value="${s}">${esc(SOURCE_NAMES[s])}</option>`).join('')}</select></div>
    <div class="field"><label>Note (optional)</label><input data-f="note" type="text" placeholder="e.g. back wall, tape measure"></div></div>`);
  let res = null;
  await new Promise((done) => sheet({ title: 'Add a measurement', body, onClose: done, actions: [{ label: 'Add', onClick: () => {
    const v = Number($('[data-f="value"]', body).value); if (!(v > 0)) { toast('Enter a number'); return false; }
    const kind = $('[data-f="kind"]', body).value; res = addMeasurement(project, { kind, value: v, unit: MEASURE_KINDS[kind], source: $('[data-f="source"]', body).value, note: $('[data-f="note"]', body).value.trim() }, store.settings);
    if (res.action === 'kept') toast('Kept the better number already on the job'); return true; } }, { label: 'Cancel', cls: 'neutral' }] }));
  return !!res;
}

async function sendMeasurementsSheet(project) {
  const link = await designLinkWithMeasurements(project); const packet = link ? link.packet : measurementPacket(project);
  const body = el(`<div><p>${packet.measurements.length} measurement${packet.measurements.length === 1 ? '' : 's'} for <b>${esc(project.name)}</b>:</p><div class="list mt8">${packet.measurements.map((m) => `<div class="row between small"><span>${esc(MEASURE_NAMES[m.kind] || m.kind)} · ${esc(SOURCE_NAMES[m.source] || m.source)}</span><span class="mono" style="white-space:nowrap">${fmtM(m)}</span></div>`).join('')}</div>
    <p class="muted small mt12">${link ? 'Open the design with these numbers, or send the link to the designer. The Studio keeps a better-sourced number over a weaker one.' : 'Download the file and open it on the customer\'s Measurements card in the Studio.'}</p></div>`);
  const file = () => download(`${(project.name || 'job').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-measurements.json`, JSON.stringify(packet, null, 2), 'application/json');
  const actions = [];
  if (link) { actions.push({ label: 'Open the design with these numbers', cls: 'success', onClick: () => { window.open(link.href, '_blank', 'noopener'); return true; } }); actions.push({ label: 'Copy or share the link', cls: 'secondary', onClick: async () => { const r = await shareOrCopy({ title: `Measurements: ${project.name}`, text: `Measurements for ${project.name}`, url: link.href }); if (r === 'copied') toast('Link copied'); return true; } }); }
  actions.push({ label: 'Download (.json)', cls: link ? 'neutral' : 'success', onClick: () => { file(); return true; } });
  project.cvs.measurementsSentAt = new Date().toISOString(); commit();
  await new Promise((done) => sheet({ title: 'Send to the designer', body, onClose: done, actions }));
}

// ---- the job's whole list (addendum 3): job materials by phase, labor by trade, confirm on site, the bid and the order sheet
const tierBadge = (l) => (l.unitCost == null ? '<span class="src needs">needs a price</span>' : l.evidence ? `<span class="src ${/^E[01]$/.test(l.evidence) && !l.accepted ? 'starter' : 'yours'}">${esc(l.evidence)}</span>` : '');
const pictureHTML = (p) => {
  if (!p) return '<span class="pick-pic"></span>';
  if (p.kind === 'swatch') return `<span class="pick-pic" style="background:${esc(p.hex2 ? `linear-gradient(135deg, ${p.hex} 50%, ${p.hex2} 50%)` : p.hex)}"></span>`;
  if (p.kind === 'url' && /^https:\/\//.test(p.url || '')) return `<img class="pick-pic" src="${esc(p.url)}" alt="">`;
  return `<span class="pick-pic">${icons.photo}</span>`;
};

export function cvsJobCard(project, rerender) {
  const card = h('div', { class: 'card', 'data-role': 'cvs-job' });
  const phases = jobMaterialsByPhase(project); const lab = laborByTrade(project); const checks = siteChecklist(project); const picks = pickLines(project);
  const days = lab.reduce((t, g) => t + (g.crewDays || 0), 0);
  card.append(el(`<div class="card-title"><h3>The job's whole list</h3><span class="dim small">${phases.reduce((t, g) => t + g.lines.length, 0)} job materials · ${fmtNum(days, 1)} crew days</span></div>`));
  card.append(el(`<p class="dim small">The customer's picks stay on their bid with pictures. Job materials are yours: edit a quantity after you measure; prices come from your price list (tier shown), and a line with no price stays blank.</p>`));
  const acts = el(`<div class="row wrap mt8" style="gap:8px"><button class="btn sm" data-job="bid">${icons.doc} Customer bid</button><button class="btn sm secondary" data-job="order">${icons.layers} Material order sheet</button></div>`);
  card.append(acts);
  if (picks.length) {
    const d = el(`<details class="mt12" data-role="cvs-picks"><summary><b>Customer's picks</b> <span class="dim small">(${picks.length})</span></summary></details>`);
    for (const l of picks) d.append(el(`<div class="row between small" style="padding:4px 0;gap:8px"><span class="grow">${esc(l.name)}${l.maker ? ` <span class="dim">· ${esc(l.maker)}</span>` : ''}</span><label class="row tiny" style="gap:4px"><input type="checkbox" data-allow="${esc(l.cvsId)}" ${l.allowance ? 'checked' : ''}> allowance</label></div>`));
    card.append(d);
  }
  for (const g of phases) {
    const d = el(`<details class="mt8" data-role="cvs-phase" data-phase="${esc(g.id)}"><summary><b>${esc(g.name)}</b> <span class="dim small">(${g.lines.length}${g.unpriced ? `, ${g.unpriced} need a price` : ''})</span>${g.cost ? `<span class="mono small" style="float:right">${fmtMoney(g.cost)}</span>` : ''}</summary></details>`);
    for (const l of g.lines) d.append(el(`<div class="line" style="align-items:flex-start"><div class="grow"><div class="name">${esc(l.name)}${l.locked ? ' <span class="dim tiny">✎ edited</span>' : ''}</div><div class="meta">${tierBadge(l)}${l.unitCost != null ? ` <span class="mono">${fmtMoney(l.unitCost)}</span>` : ''}${l.kit ? ` <span class="dim">· ${esc(l.kit)}</span>` : ''}</div>${l.note ? `<div class="dim tiny">${esc(l.note)}${l.typical ? ' (typical size)' : ''}</div>` : ''}</div><div class="unit-input" style="width:120px"><input type="number" step="any" min="0" inputmode="decimal" value="${esc(String(l.qty))}" data-qty="${esc(l.key)}" aria-label="Quantity of ${esc(l.name)}"><span>${esc(l.unitText || l.unit)}</span></div></div>`));
    card.append(d);
  }
  if (lab.length) card.append(el(`<div class="mt12" data-role="cvs-labor"><div class="group-head"><span>Labor by trade</span><span>${fmtNum(lab.reduce((t, g) => t + g.hours, 0), 1)} hr</span></div>${lab.map((g) => `<div class="row between small" style="padding:3px 0"><span>${esc(g.label)}</span><span class="mono">${g.sub ? 'sub, lump sum' : `${fmtNum(g.hours, 1)} hr · ${fmtNum(g.crewDays, 1)} crew day${g.crewDays === 1 ? '' : 's'}`}</span></div>`).join('')}</div>`));
  if (checks.length) card.append(el(`<div class="mt12" data-role="cvs-checks"><div class="group-head"><span>Confirm on site</span><span>${checks.filter((c) => c.done).length} of ${checks.length}</span></div>${checks.map((c) => `<label class="row small" style="gap:8px;padding:4px 0;align-items:flex-start"><input type="checkbox" data-check="${esc(c.id)}" ${c.done ? 'checked' : ''}><span>${esc(c.text)}${c.phaseName ? ` <span class="dim tiny">· ${esc(c.phaseName)}</span>` : ''}</span></label>`).join('')}</div>`));
  card.addEventListener('change', (e) => {
    const q = e.target.closest('[data-qty]'); if (q) { if (setJobQty(project, q.dataset.qty, q.value)) { commit(); rerender(); } return; }
    const c = e.target.closest('[data-check]'); if (c) { setCheck(project, c.dataset.check, c.checked); commit(); const n = siteChecklist(project); const head = card.querySelector('[data-role="cvs-checks"] .group-head span:last-child'); if (head) head.textContent = `${n.filter((x) => x.done).length} of ${n.length}`; return; }
    const a = e.target.closest('[data-allow]'); if (a) { setAllowance(project, a.dataset.allow, a.checked); commit(); rerender(); }
  });
  card.addEventListener('click', (e) => { const a = e.target.closest('[data-job]')?.dataset.job; if (a === 'bid') openCustomerBid(project, rerender); if (a === 'order') openOrderSheet(project); });
  return card;
}

/** The customer bid: only their picks with pictures, allowances, labor as you show it, the total */
export function openCustomerBid(project, rerender) {
  const pn = panel({ title: 'Customer bid' }); const B = pn.body;
  const draw = () => {
    const b = customerBid(project); B.innerHTML = '';
    B.append(el(`<div class="chips mt8" data-role="bid-labor">${BID_LABOR.map((m) => `<button class="chip ${b.laborMode === m ? 'on' : ''}" data-mode="${m}">${m === 'by-trade' ? 'Labor by trade' : m === 'total' ? 'Labor as one line' : 'Labor inside the price'}</button>`).join('')}</div>`));
    const c = h('div', { class: 'card', 'data-role': 'customer-bid' });
    c.append(el(`<div class="card-title"><h3>${esc(b.title)}</h3>${b.option && b.option !== b.title ? `<span class="dim small">${esc(b.option)}</span>` : ''}</div>`));
    if (b.picture) c.append(el(`<img src="${esc(b.picture)}" alt="The design" style="width:100%;border-radius:8px">`));
    if (b.scope.length) c.append(el(`<ul class="small" style="padding-left:18px;margin:8px 0">${b.scope.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`));
    if (b.picks.length) c.append(el(`<div class="group-head mt8"><span>What you picked</span></div>`), el(`<div>${b.picks.map((p) => `<div class="row small" style="gap:8px;padding:4px 0" data-role="bid-pick">${pictureHTML(p.picture)}<span class="grow">${esc(p.name)}${p.maker || p.finish ? `<div class="dim tiny">${esc([p.maker, p.finish].filter(Boolean).join(' · '))}</div>` : ''}</span><span class="dim">${esc(p.qty)}</span></div>`).join('')}</div>`));
    if (b.allowances.length) c.append(el(`<div class="group-head mt8"><span>Your selections still to make</span></div>`), el(`<div>${b.allowances.map((a) => `<div class="row between small" style="padding:3px 0"><span>${esc(a.name)} allowance</span><span class="mono">${a.amount == null ? 'to be priced' : fmtMoney(a.amount)}</span></div>`).join('')}</div>`));
    if (b.labor.length) c.append(el(`<div class="group-head mt8"><span>Labor</span></div>`), el(`<div>${b.labor.map((l) => `<div class="row between small" style="padding:3px 0"><span>${esc(l.label)}${l.days ? ` <span class="dim">· about ${fmtNum(l.days, 1)} day${l.days === 1 ? '' : 's'}</span>` : ''}</span><span class="mono">${fmtMoney(l.amount)}</span></div>`).join('')}</div>`));
    c.append(el(`<div class="trow grand mt12"><span>Total</span><span data-role="bid-total">${b.needsPrices ? '<span class="needs-price">Needs prices</span>' : fmtMoney(b.total)}</span></div>`));
    if (b.conceptNotice) c.append(el(`<p class="dim tiny mt8">${esc(b.conceptNotice)}</p>`));
    B.append(c);
    B.append(el(`<button class="btn block mt12" data-a="print">${icons.print} Print</button>`));
  };
  draw();
  B.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { project.cvs.bidLabor = m.dataset.mode; commit(); draw(); return; }
    if (e.target.closest('[data-a="print"]')) window.print();
  });
  return pn;
}

/** The material order sheet: every line, picks and job materials, grouped by where it's bought */
export function openOrderSheet(project) {
  const sheetData = materialOrderSheet(project, store.settings); const pn = panel({ title: 'Material order sheet' }); const B = pn.body;
  B.append(el(`<p class="muted small mt8">Every line for this option, the customer's picks and your job materials, grouped by where you buy it. Quantities are the design's or your edits.</p>`));
  for (const g of sheetData) {
    const c = h('div', { class: 'card', 'data-role': 'order-group' }, el(`<div class="card-title"><h3>${esc(g.name)}</h3><span class="dim small">${g.lines.length} lines</span></div>`));
    for (const l of g.lines) c.append(el(`<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span class="grow"><b>${fmtNum(l.qty, 2)} ${esc(l.unit)}</b> ${esc(l.name)}${l.designItem ? ' <span class="pill tiny">pick</span>' : ''}${l.confirm ? ' <span class="dim tiny">· confirm supplier</span>' : ''}</span><span class="dim tiny">${esc(l.phase)}</span></div>`));
    B.append(c);
  }
  B.append(el(`<button class="btn block mt12" data-a="copy">${icons.copy} Copy the sheet</button>`));
  B.addEventListener('click', async (e) => { if (!e.target.closest('[data-a="copy"]')) return; try { await navigator.clipboard.writeText(orderSheetText(project, sheetData)); toast('Order sheet copied'); } catch { toast('Copy failed'); } });
  return pn;
}

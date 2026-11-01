// Design jobs from Contractor Visual Studio: import preview, the design card on the bid, and the send check.
import { store } from './store.js';
import { importCvsPackage, describeDiff, packageFromHash, sendReadiness, acceptStarterPrices, setCvsPrice, setLaborChoice, setActiveOption, cvsTrades, tradeLabel, LEVELS, adoptPendingDesign } from './cvs/import.js';
import { el, h, $, $$, toast, sheet, icons, esc, fmtMoney, fmtNum, confirmDialog, promptDialog } from './ui.js';

const commit = (tag = 'project') => store.update(() => {}, tag);

/** Run a package (from a file, link or drop) through the one importer, show the preview, create on confirm. */
export async function startCvsImport(obj, { navigate } = {}) {
  const plan = importCvsPackage(obj, { settings: store.settings, projects: store.projects() });
  if (!plan.ok) { await new Promise((res) => sheet({ title: 'Could not import this design', body: `<p>${esc(plan.error)}</p>`, onClose: res, actions: [{ label: 'OK' }] })); return null; }
  const pv = plan.preview; const body = h('div');
  body.append(el(`<div class="card flat"><b>${esc(pv.text)}</b><div class="dim small mt8">Trade: ${esc(pv.packName)}${plan.createsSupplier ? ` · adds “${esc(plan.companySupplier.name)}” to your suppliers` : ''}</div></div>`));
  let keepEdits = true;
  if (plan.mode === 'new') body.append(el(`<p class="muted small mt12">Materials come in without prices (each shows “needs a price” until you price it from your price list or type your price). Labor comes in by trade at your rates. Nothing is created until you tap Import.</p>`));
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
export const cvsLineBadges = (it) => it.origin !== 'cvs' ? '' : `${it.unitCost == null ? '<span class="src needs">needs a price</span>' : it.evidence && /^E[01]$/.test(it.evidence) && !it.accepted ? '<span class="src starter">starter price: replace with yours</span>' : it.evidence ? `<span class="src yours">${esc(it.evidence)}</span>` : ''}${it.typical ? `<span class="src typical">${it.recompute ? 'typical size · re-measured' : 'typical size'}</span>` : ''}${it.noOrder ? '<span class="dim">· your stock</span>' : ''}${it.needsSupplier ? '<span class="dim">· pick a supplier</span>' : ''}`;
export const lineAmount = (it, fmt) => (it.unitCost == null ? '<span class="needs-price">Needs a price</span>' : fmt);

export function cvsCard(project, rerender) {
  const cvs = project.cvs; const est = project.estimate; const s = store.settings;
  const card = h('div', { class: 'card', 'data-role': 'cvs-card' });
  const ready = sendReadiness(project);
  const opts = cvs.options || [];
  card.append(el(`<div class="card-title"><h3>Design from ${esc(cvs.company.name || 'CVS')}</h3><span class="pill ${ready.ok ? 'signed' : 'draft'}">${ready.ok ? 'ready to send' : 'needs prices'}</span></div>`));
  if (cvs.design.summary) card.append(el(`<p class="small muted">${esc(cvs.design.summary)}</p>`));
  if (opts.length > 1) {
    const chips = h('div', { class: 'chips mt8' });
    for (const o of opts) chips.append(el(`<button class="chip ${o.id === cvs.activeOption ? 'on' : ''}" data-cvs-opt="${esc(o.id)}">${esc(o.name)}${o.band ? ` <span class="dim">${esc(o.band)}</span>` : ''}</button>`));
    card.append(el(`<div class="dim small mt8">Options (shown to the client as ${opts.length === 3 ? 'Good / Better / Best' : 'choices'}):</div>`), chips);
  }
  if (!ready.ok) card.append(el(`<div class="flag mt8">${icons.warn}<div class="grow">${esc(ready.message)}. The proposal can't be sent until every line has a price or you accept the starter prices.</div></div>`));
  const acts = h('div', { class: 'row wrap mt8', style: { gap: '8px' } });
  if (ready.unpriced.some((l) => l.cat === 'material')) acts.append(el(`<button class="btn sm" data-cvs="price">${icons.dollar} Price materials</button>`));
  if (ready.starter.length) acts.append(el(`<button class="btn sm secondary" data-cvs="accept">${icons.check} Accept starter prices</button>`));
  acts.append(el(`<button class="btn sm secondary" data-cvs="labor">${icons.edit} Labor by trade</button>`));
  card.append(acts);
  if (cvs.recompute) card.append(el(`<div class="flag info mt8">${icons.info}<div>You measured ${esc(cvs.recompute.kinds.join(', '))}. Lines marked “typical size” rest on a standard size: send the measurements to the designer for a re-fitted design, or adjust those quantities.</div></div>`));
  if (cvs.pendingPkg) card.append(el(`<div class="flag info mt8">${icons.info}<div>An updated design is waiting on a change order. It becomes the job's design when the client approves it.</div></div>`));
  const refs = (opts.find((o) => o.id === cvs.activeOption) || {}).priceBookRefs || [];
  if (refs.length) card.append(el(`<div class="dim small mt8"><b>Reference notes from ${esc(cvs.company.name)}:</b> ${refs.map((r) => esc(`${r.item}${r.note ? ` (${r.note})` : ''}`)).join('; ')}</div>`));
  card.addEventListener('click', async (e) => {
    const o = e.target.closest('[data-cvs-opt]'); if (o) { setActiveOption(project, o.dataset.cvsOpt, s); commit(); rerender(); return; }
    const a = e.target.closest('[data-cvs]')?.dataset.cvs; if (!a) return;
    if (a === 'accept') { if (await confirmDialog(`Accept ${ready.starter.length} starter price${ready.starter.length === 1 ? '' : 's'} as they are? They are national figures adjusted for your region, not your prices.`, { okLabel: 'Accept', title: 'Starter prices' })) { acceptStarterPrices(project); commit(); rerender(); } }
    if (a === 'price') { await priceSheet(project); commit(); rerender(); }
    if (a === 'labor') { await laborSheet(project); commit(); rerender(); }
  });
  return card;
}

async function priceSheet(project) {
  const seen = new Set(); const rows = sendReadiness(project).unpriced.filter((l) => l.cat === 'material' && l.cvsId && !seen.has(l.cvsId) && seen.add(l.cvsId));
  const body = h('div');
  body.append(el(`<p class="dim small">Your price per unit (what it costs you). A price you type here is used for this material in every option.</p>`));
  for (const l of rows) body.append(el(`<div class="field"><label>${esc(l.name)} <span class="dim">· ${fmtNum(l.qty, 2)} ${esc(l.unitText || l.unit)}</span></label><input type="number" step="0.01" inputmode="decimal" placeholder="Needs a price" data-cvs-id="${esc(l.cvsId)}"></div>`));
  await new Promise((res) => sheet({ title: 'Price materials', body, onClose: res, actions: [{ label: 'Save prices', onClick: () => { for (const inp of $$('[data-cvs-id]', body)) if (inp.value !== '') setCvsPrice(project, inp.dataset.cvsId, Number(inp.value)); return true; } }, { label: 'Cancel', cls: 'neutral' }] }));
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
    if (it.cat === 'material') setCvsPrice(project, it.cvsId, v);
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

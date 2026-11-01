// app shell: routing, home (projects), settings, boot
import { store, DEFAULT_TERMS } from './store.js';
import { renderScan } from './scanner/scan.js';
import { renderModel, disposeViewer } from './model-ui.js';
import { renderEstimate, editClient } from './estimate-ui.js';
import { openDocument, decodeShareLink, applyResponse, openCODocument } from './document.js';
import { totals, projectAreaSF, recompute } from './pricing/estimator.js';
import { STATES, regionIndex } from './pricing/regional.js';
import { isARSupported } from './scanner/webxr-ar.js';
import { aiStatus, hasSampleRuntime } from './pricing/ai.js';
import { AI_MODELS, AI_MODEL_DEFAULT } from './pricing/ai-prompt.js';
import { el, h, $, $$, toast, sheet, icons, confirmDialog, promptDialog, fmtMoney, fmtNum, fmtDate, esc, segEl, switchEl, download, readFileAsDataURL, debounce, bind } from './ui.js';
import { fmtLen, parseLen } from './geometry.js';
import { BRAND } from './brand.js';
import { renderBuild } from './configurator-ui.js';
import { openPricingPanel } from './pricing-ui.js';
import { openSuppliersPanel } from './suppliers-ui.js';
import { profileOf, METHOD_LABELS, markupFromMargin } from './pricing/profile.js';
import { suppliersOf } from './pricing/suppliers.js';
import { handleCvsHash, importCvsFile, enableCvsDrop } from './cvs-ui.js';

const TABS = ['home', 'build', 'scan', 'model', 'estimate', 'settings'];
const TITLES = { home: BRAND.name, build: 'Build', scan: 'Measure', model: '3D & plan', estimate: 'Bid', settings: 'Settings' };
let current = 'home';

export function navigate(tab) {
  if (!TABS.includes(tab)) tab = 'home';
  if (current === 'model' && tab !== 'model') disposeViewer();
  current = tab; location.hash = `#/${tab}`;
  $$('.screen').forEach((sc) => sc.classList.toggle('active', sc.id === `screen-${tab}`));
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === (tab === 'model' ? 'scan' : tab)));
  $('[data-role="title"]').textContent = TITLES[tab];
  render(tab);
}
function render(tab = current) {
  const root = $(`#screen-${tab}`); const ctx = { navigate };
  if (tab === 'home') renderHome(root, ctx); if (tab === 'build') renderBuild(root, ctx); if (tab === 'scan') renderScan(root, ctx); if (tab === 'model') renderModel(root, ctx); if (tab === 'estimate') renderEstimate(root, ctx); if (tab === 'settings') renderSettings(root, ctx);
  root.scrollTop = 0;
}

function renderHome(root, { navigate }) {
  const s = store.settings; const projects = store.projects(); root.innerHTML = '';
  const pipeline = projects.filter((p) => p.status !== 'paid').reduce((a, p) => a + totals(p.estimate).total, 0); const signed = projects.filter((p) => ['signed', 'invoiced', 'paid'].includes(p.status)).length;
  root.append(el(`<div class="hero"><h2>${s.company.name ? esc(s.company.name) : esc(BRAND.tagline)}</h2><p>${projects.length ? `${projects.length} job${projects.length === 1 ? '' : 's'} · ${fmtMoney(pipeline, { cents: false })} open pipeline · ${signed} signed` : esc(BRAND.description)}</p><div class="row wrap" style="gap:8px"><button class="btn" data-act="new">${icons.plus} New job</button><button class="btn" data-act="scan" style="background:rgba(255,255,255,.2);color:#fff">${icons.ruler} Measure</button><button class="btn" data-act="build" style="background:rgba(255,255,255,.2);color:#fff">${icons.cube} Build</button></div></div>`));
  if (!profileOf(s).setupDone) root.append(el(`<div class="flag mt12">${icons.dollar}<div class="grow"><b>Set up how you price.</b> Two minutes: your overhead, margin and labor rates — then every bid lands on your number.</div><button class="btn xs" data-act="pricing">Set up</button></div>`));
  const embedded = window.self !== window.top;
  if (embedded || !window.isSecureContext) root.append(el(`<div class="flag mt12">${icons.warn}<div class="grow"><b>Preview mode.</b> ${embedded ? 'This page is running inside another site, which blocks the camera, AR, downloads and printing.' : 'This page is not on HTTPS, so the camera and motion sensors are blocked.'} Everything else works — try <b>Scan → Load demo room</b>. Install the app from your own HTTPS host for the full scanner.</div></div>`));
  if (!s.company.name) root.append(el(`<div class="flag info mt12">${icons.info}<div class="grow">Add your company name, logo and ZIP in <b>Settings</b> for branded, regionally priced estimates.</div><button class="btn xs neutral" data-act="settings">Go</button></div>`));
  root.append(el(`<div class="row mt12" style="gap:8px"><label class="btn sm secondary grow" data-role="cvs-import">${icons.download} Import a design (.json)<input type="file" accept="application/json,.json" hidden data-act="cvs-file"></label></div>`));
  enableCvsDrop(root, { navigate });
  const folders = [...new Set(projects.map((p) => p.folder).filter(Boolean))];
  const filters = h('div', { class: 'row mt12', style: { gap: '8px' } }, el(`<input type="search" placeholder="Search jobs, clients…" class="grow" data-role="q">`)); root.append(filters);
  if (folders.length) { const ch = h('div', { class: 'chips mt8' }, el(`<button class="chip on" data-folder="">All</button>`)); folders.forEach((f) => ch.append(el(`<button class="chip" data-folder="${esc(f)}">${icons.folder} ${esc(f)}</button>`))); root.append(ch); }
  const list = h('div', { class: 'card tight' }); root.append(list);
  let q = '', folder = '';
  const draw = () => {
    list.innerHTML = ''; const rows = projects.filter((p) => (!folder || p.folder === folder) && (!q || `${p.name} ${p.client.name} ${p.client.address} ${p.estimate.number}`.toLowerCase().includes(q)));
    if (!rows.length) { list.append(el(`<div class="empty">${icons.folder}<h3>${projects.length ? 'No matches' : 'No jobs yet'}</h3><p class="mt8 small">${projects.length ? 'Try a different search.' : 'Tap “Measure” to measure a room, roof or yard, or “Build” to configure a product and see everything it needs.'}</p></div>`)); return; }
    const l = h('div', { class: 'list' });
    for (const p of rows) { const T = totals(p.estimate); const sf = projectAreaSF(p); l.append(el(`<button class="item" data-open="${p.id}" style="text-align:left;width:100%"><div class="lead">${icons.doc}</div><div class="grow"><div class="row between"><b>${esc(p.name)}</b><b class="mono">${fmtMoney(T.total, { cents: false })}</b></div><div class="row between dim small"><span>${esc(p.client.name || 'No client')} · ${p.rooms.length} area${p.rooms.length === 1 ? '' : 's'}${sf ? ` · ${fmtNum(sf, 0)} sf` : ''}</span><span class="pill ${p.status || 'draft'}">${p.status || 'draft'}</span></div><div class="dim tiny">${esc(p.estimate.number)} · updated ${fmtDate(p.updatedAt)}</div></div></button>`)); }
    list.append(l);
  };
  draw();
  $('[data-role="q"]', root).addEventListener('input', debounce((e) => { q = e.target.value.toLowerCase().trim(); draw(); }, 120));
  bind(root, 'change', (e) => { if (e.target.dataset.act === 'cvs-file' && e.target.files[0]) { importCvsFile(e.target.files[0], { navigate }); e.target.value = ''; } });
  bind(root, 'click', async (e) => {
    const fb = e.target.closest('[data-folder]'); if (fb) { folder = fb.dataset.folder; $$('[data-folder]', root).forEach((x) => x.classList.toggle('on', x === fb)); draw(); return; }
    const open = e.target.closest('[data-open]'); if (open) { store.setActiveProject(open.dataset.open); const p = store.activeProject(); navigate(p.rooms.length || p.cvs ? 'estimate' : 'scan'); return; }
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'new') { const p = store.createProject({}); const ok = await editClient(p); if (!ok) { p.name = p.name; } navigate('scan'); }
    if (act === 'scan') { if (!store.activeProject()) store.createProject({}); navigate('scan'); }
    if (act === 'build') { if (!store.activeProject()) store.createProject({}); navigate('build'); }
    if (act === 'pricing') openPricingPanel({ onDone: () => render('home') });
    if (act === 'settings') navigate('settings');
  });
}

function renderSettings(root, { navigate }) {
  const s = store.settings; const units = s.units; root.innerHTML = '';
  const save = (tag = 'settings') => store.update(() => {}, tag);
  // hub: how you price + suppliers
  const prof = profileOf(s); const methodLine = prof.method === 'margin' ? `${prof.targetMargin}% target margin (${Math.round(markupFromMargin(prof.targetMargin) * 10) / 10}% markup)` : prof.method === 'rate' ? `$${prof.billRate}/hr labor + ${s.defaults.materialMarkup}% on materials` : `${s.defaults.materialMarkup}% materials · ${s.defaults.laborMarkup}% labor · ${s.defaults.overhead}% OH · ${s.defaults.profit}% profit`;
  const hub = h('div', { class: 'card' });
  hub.append(el(`<button class="item" data-hub="pricing" style="text-align:left;width:100%;display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><div class="lead">${icons.dollar}</div><div class="grow"><b>How you price</b><div class="dim small">${esc(METHOD_LABELS[prof.method])} · ${esc(methodLine)}${prof.useOwnRates ? ' · your labor rates' : ''}</div>${prof.setupDone ? '' : '<div class="small" style="color:var(--accent);font-weight:700">Set this up — 2 minutes, every bid gets better</div>'}</div><span class="chev">${icons.chevron}</span></button>`));
  hub.append(el(`<button class="item" data-hub="suppliers" style="text-align:left;width:100%;display:flex;gap:12px;padding:10px 0"><div class="lead">${icons.layers}</div><div class="grow"><b>Suppliers & price lists</b><div class="dim small">${suppliersOf(s).length} suppliers · ${(s.priceList || []).length} price-list items</div></div><span class="chev">${icons.chevron}</span></button>`));
  hub.addEventListener('click', (e) => { const k = e.target.closest('[data-hub]')?.dataset.hub; if (k === 'pricing') openPricingPanel({ onDone: () => renderSettings(root, { navigate }) }); if (k === 'suppliers') openSuppliersPanel({ onDone: () => renderSettings(root, { navigate }) }); });
  root.append(hub);
  // company
  const co = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Company</h3></div>`));
  const field = (obj, k, label, type = 'text', ph = '') => { const f = el(`<div class="field"><label>${label}</label><input type="${type}" value="${esc(obj[k] || '')}" placeholder="${esc(ph)}"></div>`); $('input', f).addEventListener('change', (e) => { obj[k] = e.target.value.trim(); save(); }); return f; };
  co.append(field(s.company, 'name', 'Company name', 'text', 'Acme Remodeling LLC'), h('div', { class: 'inline-fields' }, field(s.company, 'phone', 'Phone', 'tel'), field(s.company, 'email', 'Email', 'email')), field(s.company, 'address', 'Address'), h('div', { class: 'inline-fields' }, field(s.company, 'license', 'License #'), field(s.company, 'website', 'Website')));
  const logo = el(`<div class="row between mt12"><div class="row">${s.company.logo ? `<img src="${s.company.logo}" style="height:40px;max-width:120px;object-fit:contain;border-radius:6px;background:#fff;padding:2px">` : '<div class="dim small">No logo</div>'}</div><div class="row" style="gap:6px"><label class="btn xs secondary">Upload logo<input type="file" accept="image/*" hidden></label>${s.company.logo ? '<button class="btn xs danger" data-act="rm-logo">Remove</button>' : ''}</div></div>`);
  $('input[type=file]', logo).addEventListener('change', async (e) => { if (e.target.files[0]) { s.company.logo = await readFileAsDataURL(e.target.files[0], 400); save(); renderSettings(root, { navigate }); } });
  co.append(logo); root.append(co);
  // region
  const reg = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Pricing region</h3></div>`));
  const zipF = el(`<div class="inline-fields"><div class="field"><label>ZIP code</label><input type="text" inputmode="numeric" maxlength="10" value="${esc(s.region.zip || '')}" placeholder="e.g. 78701"></div><div class="field"><label>State</label><select>${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${s.region.state === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div></div>`);
  const regInfo = el(`<p class="muted small mt8"></p>`); const showReg = () => { const r = regionIndex({ zip: s.region.zip, state: s.region.state }); regInfo.innerHTML = `Index for <b>${esc(r.label)}</b>: materials ×${r.material.toFixed(2)}, labor ×${r.labor.toFixed(2)} (1.00 = national average)`; };
  $('input', zipF).addEventListener('change', (e) => { s.region.zip = e.target.value.trim(); const r = regionIndex({ zip: s.region.zip }); if (r.state && r.state !== 'US') { s.region.state = r.state; $('select', zipF).value = r.state; } save(); showReg(); });
  $('select', zipF).addEventListener('change', (e) => { s.region.state = e.target.value; save(); showReg(); });
  reg.append(zipF, regInfo); showReg();
  const autoRow = h('div', { class: 'row between mt12' }, el(`<div><b>Automatic regional index</b><div class="dim small">Turn off to set your own multipliers</div></div>`)); autoRow.append(switchEl(s.pricing.autoRegion !== false, (v) => { s.pricing.autoRegion = v; save(); renderSettings(root, { navigate }); })); reg.append(autoRow);
  if (s.pricing.autoRegion === false) { const mi = el(`<div class="inline-fields"><div class="field"><label>Material index</label><input type="number" step="0.01" value="${s.pricing.materialIndex}"></div><div class="field"><label>Labor index</label><input type="number" step="0.01" value="${s.pricing.laborIndex}"></div></div>`); const [a, b] = $$('input', mi); a.addEventListener('change', () => { s.pricing.materialIndex = Number(a.value) || 1; save(); }); b.addEventListener('change', () => { s.pricing.laborIndex = Number(b.value) || 1; save(); }); reg.append(mi); }
  root.append(reg);
  // defaults
  const d = s.defaults; const df = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Defaults</h3></div>`));
  const uf = h('div', { class: 'field' }, el('<label>Units</label')); uf.append(segEl([{ value: 'imperial', label: 'Feet & inches' }, { value: 'metric', label: 'Meters' }], units, (v) => { s.units = v; save(); renderSettings(root, { navigate }); })); df.append(uf);
  const lenField = (k, label, hint) => { const f = el(`<div class="field"><label>${label}</label><input type="text" value="${esc(units === 'metric' ? d[k].toFixed(2) + ' m' : fmtLen(d[k], 'imperial'))}">${hint ? `<div class="dim tiny">${hint}</div>` : ''}</div>`); $('input', f).addEventListener('change', (e) => { const m = parseLen(e.target.value, units); if (m > 0.02) { d[k] = m; save(); } e.target.value = units === 'metric' ? d[k].toFixed(2) + ' m' : fmtLen(d[k], 'imperial'); }); return f; };
  df.append(h('div', { class: 'inline-fields' }, lenField('ceilingHeight', 'Ceiling height'), lenField('cameraHeight', 'Camera height', 'Phone height during camera scans')), lenField('wallThickness', 'Wall thickness'));
  const pctField = (k, label) => { const f = el(`<div class="field"><label>${label}</label><div class="unit-input"><input type="number" step="0.5" value="${d[k]}"><span>%</span></div></div>`); $('input', f).addEventListener('change', (e) => { d[k] = Number(e.target.value) || 0; save(); }); return f; };
  df.append(el('<div class="group-head">New-estimate defaults</div>'), h('div', { class: 'inline-fields three' }, pctField('materialMarkup', 'Material markup'), pctField('laborMarkup', 'Labor markup'), pctField('overhead', 'Overhead')), h('div', { class: 'inline-fields three' }, pctField('profit', 'Profit'), pctField('contingency', 'Contingency'), pctField('taxRate', 'Sales tax')), h('div', { class: 'inline-fields' }, pctField('depositPct', 'Deposit'), (() => { const f = el(`<div class="field"><label>Valid for (days)</label><input type="number" value="${d.validDays}"></div>`); $('input', f).addEventListener('change', (e) => { d.validDays = Number(e.target.value) || 30; save(); }); return f; })()));
  const tx = h('div', { class: 'row between mt12' }, el(`<div><b>Tax materials only</b></div>`)); tx.append(switchEl(d.taxMaterialsOnly !== false, (v) => { d.taxMaterialsOnly = v; save(); })); df.append(tx);
  const terms = el(`<div class="field"><label>Terms & conditions</label><textarea style="min-height:120px">${esc(s.terms || '')}</textarea><div class="dim tiny">Placeholders: {validDays}, {depositPct}</div></div>`); $('textarea', terms).addEventListener('change', (e) => { s.terms = e.target.value; save(); }); df.append(terms, el(`<button class="btn xs neutral mt8" data-act="reset-terms">Reset terms to default</button>`));
  root.append(df);
  // AI assist
  s.ai = s.ai || { apiKey: '', endpoint: '', model: AI_MODEL_DEFAULT };
  const ai = h('div', { class: 'card' }, el(`<div class="card-title"><h3>AI assist</h3><span class="pill ${aiStatus(s).ready ? 'signed' : 'draft'}" data-role="ai-status">${esc(aiStatus(s).label)}</span></div>`));
  ai.append(el(`<p class="muted small">Turns job-site photos and a plain-language description into work items, custom lines, a client-ready scope and risk flags. ${hasSampleRuntime() ? 'In this Claude preview it works without any key, using your own Claude account.' : 'Bring your own Anthropic API key, or point it at your server for a team.'}</p>`));
  const keyF = el(`<div class="field"><label>Anthropic API key (stays on this device)</label><div class="row"><input type="password" class="grow" value="${esc(s.ai.apiKey || '')}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"><button class="btn sm neutral" data-act="toggle-key">Show</button></div><div class="dim tiny">Calls go straight from this phone to api.anthropic.com and are billed to your key. Each analysis costs a few cents. Backups never include the key.</div></div>`);
  $('input', keyF).addEventListener('change', (e) => { s.ai.apiKey = e.target.value.trim(); save(); $('[data-role="ai-status"]', ai).textContent = aiStatus(s).label; $('[data-role="ai-status"]', ai).className = `pill ${aiStatus(s).ready ? 'signed' : 'draft'}`; });
  const modelF = el(`<div class="field"><label>Model</label><select>${AI_MODELS.map((m) => `<option value="${m.id}" ${(s.ai.model || AI_MODEL_DEFAULT) === m.id ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>`);
  $('select', modelF).addEventListener('change', (e) => { s.ai.model = e.target.value; save(); });
  const epF = el(`<div class="field"><label>Server endpoint (optional, takes priority)</label><input type="url" value="${esc(s.ai.endpoint || '')}" placeholder="https://your-worker.example.workers.dev" autocomplete="off" spellcheck="false"><div class="dim tiny">Deploy server/worker.mjs with your key as a secret; the app then never holds a key. See README.</div></div>`);
  $('input', epF).addEventListener('change', (e) => { s.ai.endpoint = e.target.value.trim(); save(); $('[data-role="ai-status"]', ai).textContent = aiStatus(s).label; $('[data-role="ai-status"]', ai).className = `pill ${aiStatus(s).ready ? 'signed' : 'draft'}`; });
  ai.append(keyF, modelF, epF); root.append(ai);
  // appearance + data
  const ap = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Appearance</h3></div>`)); ap.append(segEl([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], s.theme || 'auto', (v) => { s.theme = v; applyTheme(); save(); })); root.append(ap);
  const data = el(`<div class="card"><div class="card-title"><h3>Data</h3><span class="dim small">${store.projects().length} projects · stored on this device</span></div><div class="btn-grid"><button class="btn secondary" data-act="export">${icons.download} Backup (JSON)</button><label class="btn secondary">${icons.share} Restore<input type="file" accept="application/json" hidden data-act="import"></label></div><button class="btn danger block mt12" data-act="reset">Erase all data</button></div>`);
  root.append(data);
  // device capabilities
  const cap = h('div', { class: 'card' }, el(`<div class="card-title"><h3>This device</h3></div>`)); const capList = h('div', { class: 'list' }); cap.append(capList); root.append(cap);
  (async () => { const rows = [['WebXR AR (hit-test / depth)', await isARSupported()], ['Motion sensors', 'DeviceOrientationEvent' in window], ['Camera', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)], ['Voice dictation', !!(window.SpeechRecognition || window.webkitSpeechRecognition)], ['Web Share', !!navigator.share], ['Installed as app', matchMedia('(display-mode: standalone)').matches || navigator.standalone === true], ['Secure context (required for camera & sensors)', window.isSecureContext]]; capList.innerHTML = rows.map(([k, v]) => `<div class="item" style="padding:8px 0"><div class="grow">${k}</div><span class="pill ${v ? 'signed' : 'draft'}">${v ? 'yes' : 'no'}</span></div>`).join(''); })();
  root.append(el(`<p class="dim tiny center mt16">${BRAND.name} · ${esc(BRAND.tagline)} · v2.0<br>All data stays on this device unless you share a link.</p>`));
  bind(root, 'click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'rm-logo') { s.company.logo = ''; save(); renderSettings(root, { navigate }); }
    if (act === 'toggle-key') { const inp = e.target.closest('.field').querySelector('input'); inp.type = inp.type === 'password' ? 'text' : 'password'; e.target.textContent = inp.type === 'password' ? 'Show' : 'Hide'; }
    if (act === 'reset-terms') { s.terms = DEFAULT_TERMS; save(); renderSettings(root, { navigate }); }
    if (act === 'export') download(`${BRAND.name.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON(), 'application/json');
    if (act === 'reset' && (await confirmDialog('Erase every project, room and setting on this device? Export a backup first.', { okLabel: 'Erase everything', danger: true }))) { store.reset(); navigate('home'); }
  });
  bind(root, 'change', async (e) => { if (e.target.dataset.act === 'import' && e.target.files[0]) { try { store.importJSON(await e.target.files[0].text()); toast('Backup restored'); navigate('home'); } catch (err) { toast('Import failed: ' + err.message); } } });
}

function applyTheme() { const t = store.settings.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); const meta = $('meta[name=theme-color]'); if (meta) meta.setAttribute('content', t === 'dark' ? '#000000' : '#1f6feb'); }

async function handleShareLink(hash) {
  if (!hash || !hash.includes('share=')) return false;
  try {
    const data = await decodeShareLink(hash); if (!data) return false;
    history.replaceState(null, '', location.pathname + '#/home');
    if (data.kind === 'response') { const r = applyResponse(data, store.settings); if (!r) { toast('This approval is for a job that is not on this device'); return false; } await new Promise((res) => sheet({ title: 'Client response received', body: `<p><b>${esc(r.project.name)}</b></p><p class="muted mt8">${esc(r.summary || 'Nothing new to apply.')}</p>`, onClose: res, actions: [{ label: 'Open the bid', onClick: () => { navigate('estimate'); return true; } }] })); return true; }
    if (!data.project) return false;
    const p = data.project; const T = totals(p.estimate);
    const body = el(`<div><div class="card flat"><b>${esc(p.name)}</b><div class="dim small">From ${esc(data.company?.name || 'a contractor')} · ${esc(p.estimate.number)}</div><div class="mt8" style="font-size:22px;font-weight:800">${fmtMoney(Number.isFinite(p.estimate.signedTotal) ? p.estimate.signedTotal : T.total)}</div></div><p class="muted small mt12">${data.focusCO ? 'Open it to review the change order and approve it if you agree.' : 'Open it to review the itemized estimate, options and terms, and sign if you accept.'} It is saved on this device.</p></div>`);
    await new Promise((res) => sheet({ title: data.focusCO ? 'Change order for your review' : 'Shared estimate', body, dismissible: false, onClose: res, actions: [{ label: 'Open', onClick: () => {
      const roomMap = {}; const sourceId = p.id; p.id = Math.random().toString(36).slice(2, 10); p.sharedFrom = { sourceId, company: data.company || {}, origin: data.origin || '' };
      p.rooms.forEach((r) => { const nid = Math.random().toString(36).slice(2, 10); roomMap[r.id] = nid; r.id = nid; });
      (p.estimate.products || []).forEach((x) => { if (x.areaId) x.areaId = roomMap[x.areaId] || null; }); (p.estimate.assemblies || []).forEach((a) => { if (a.roomIds) a.roomIds = a.roomIds.map((id) => roomMap[id]).filter(Boolean); });
      store.update((st) => { st.projects.unshift(p); st.activeProjectId = p.id; st.activeRoomId = p.rooms[0] ? p.rooms[0].id : null; }, 'project');
      navigate('estimate'); const fresh = store.activeProject();
      setTimeout(() => { if (data.focusCO) { const co = (fresh.changeOrders || []).find((c) => c.id === data.focusCO); if (co) return openCODocument(fresh, co, { onChange: () => render() }); } openDocument(fresh, { mode: 'estimate', onChange: () => render() }); }, 100); return true; } }, { label: 'Not now', cls: 'neutral', onClick: () => false }] }));
    return true;
  } catch (e) { console.warn('share decode failed', e); toast('Could not open the shared link'); return false; }
}

function boot() {
  applyTheme();
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.tab)));
  store.subscribe((_, tag) => { if (['room', 'project', 'active', 'import', 'reset'].includes(tag)) { if (current === 'home') render('home'); } });
  window.addEventListener('hashchange', () => { if (/[#&]cvs(-url)?=/.test(location.hash)) { handleCvsHash(location.hash, { navigate }); return; } if (location.hash.includes('share=')) { handleShareLink(location.hash); return; } const m = /#\/(\w+)/.exec(location.hash); if (m && m[1] !== current && TABS.includes(m[1])) navigate(m[1]); });
  const initialHash = location.hash;
  const m = /#\/(\w+)/.exec(initialHash); navigate(m && TABS.includes(m[1]) ? m[1] : 'home');
  if (/[#&]cvs(-url)?=/.test(initialHash)) handleCvsHash(initialHash, { navigate }); else handleShareLink(initialHash);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.__fullbid = window.__roompilot = { store, navigate, recompute };
  document.title = `${BRAND.name} — ${BRAND.tagline}`;
}
boot();

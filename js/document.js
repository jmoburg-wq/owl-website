// client-facing estimate / invoice document: print-to-PDF, share link, e-signature, payments
import { store } from './store.js';
import { totals, lineTotal, lineHours, itemsByGroup, invoiceTotals, projectAreaSF, ledger, coTotals, jobPlan, recompute } from './pricing/estimator.js';
import { tierSummary, addonPrices, applyChoice, variant } from './pricing/tiers.js';
import { groupBySupplier, materialOrderCSV, materialOrderText, supplierById } from './pricing/suppliers.js';
import { TRADES } from './pricing/profile.js';
import { compileProduct, SYSTEM_MAP } from './pricing/products.js';
import { BRAND } from './brand.js';
import { checkReadyToSend, onChangeOrderApproved } from './cvs-ui.js';
import { metrics, fmtArea, fmtLen, fmtLF, kindOf, KINDS, areaSummary } from './geometry.js';
import { floorPlanSVG } from './floorplan.js';
import { el, h, $, $$, toast, sheet, panel, icons, fmtMoney, fmtNum, fmtDate, esc, shareOrCopy, confirmDialog, promptDialog, download, isEmbedded, money0, segEl, switchEl } from './ui.js';

const addDays = (iso, d) => { const x = new Date(iso); x.setDate(x.getDate() + d); return x.toISOString(); };
const commit = (tag = 'project') => store.update(() => {}, tag);

export function renderDocumentHTML(project, settings, { mode = 'estimate' } = {}) {
  const est = project.estimate; const co = (project.sharedFrom && project.sharedFrom.company) || settings.company || {}; const T = totals(est); const units = settings.units; const inline = est.adj.inlineMarkup !== false; const f = inline ? T.sellFactor : 1;
  const inv = est.invoice; const isInv = mode === 'invoice' && inv; const it = isInv ? invoiceTotals(project) : null;
  const status = project.status || 'draft'; const stamp = isInv ? (it.balance <= 0.005 ? ['PAID', '#1d7a3d'] : ['INVOICE', '#7a3aa0']) : est.signature ? ['ACCEPTED', '#1d7a3d'] : status === 'sent' ? ['SENT', '#1f6feb'] : ['ESTIMATE', '#555'];
  const terms = (est.terms || '').replace('{validDays}', est.validDays || 30).replace('{depositPct}', est.adj.depositPct || 0);
  const rooms = project.rooms || [];
  const roomRows = rooms.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(KINDS[kindOf(r)].short)}</td><td>${esc(areaSummary(r, units))}</td></tr>`).join('');
  const groups = itemsByGroup(est.items).map((g) => `<tr class="grp"><td colspan="5">${esc(g.name)}</td></tr>` + g.items.map((i) => `<tr><td>${esc(i.name)}${i.note ? `<div style="color:#777;font-size:11px">${esc(i.note)}</div>` : ''}</td><td class="r">${fmtNum(i.qty, 2)}</td><td>${esc(i.unit)}</td>${i.unitCost == null ? '<td class="r" colspan="2">Needs a price</td>' : `<td class="r">${fmtMoney(i.unitCost * f)}</td><td class="r">${fmtMoney(lineTotal(i) * f)}</td>`}</tr>`).join('')).join('');
  const figures = rooms.slice(0, 2).map((r) => `<div>${floorPlanSVG(r, { units, width: 600, compact: true, title: false })}${r.snapshot ? `<img src="${r.snapshot}" alt="3D model of ${esc(r.name)}" style="margin-top:6px">` : ''}</div>`).join('');
  const payments = isInv && inv.payments.length ? `<h2>Payments received</h2><table><thead><tr><th>Date</th><th>Method</th><th>Note</th><th class="r">Amount</th></tr></thead><tbody>${inv.payments.map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${esc(p.method || '')}</td><td>${esc(p.note || '')}</td><td class="r">${fmtMoney(p.amount)}</td></tr>`).join('')}</tbody></table>` : '';
  return `<div class="doc">
    <div class="doc-head"><div>${co.logo ? `<img src="${co.logo}" alt="logo"><br>` : ''}<h1 style="margin-top:4px">${esc(co.name || 'Your Company')}</h1><div style="color:#555">${[co.address, co.phone, co.email, co.website, co.license ? 'Lic. ' + co.license : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div style="text-align:right"><span class="stamp" style="color:${stamp[1]};border-color:${stamp[1]}">${stamp[0]}</span><div style="font-size:20px;font-weight:800;margin-top:6px">${esc(isInv ? inv.number : est.number)}</div><div style="color:#555">${isInv ? `Issued ${fmtDate(inv.date)}<br>Due ${fmtDate(inv.dueDate)}` : `Date ${fmtDate(est.date)}<br>Valid until ${fmtDate(addDays(est.date, est.validDays || 30))}`}</div></div></div>
    <div class="parties"><div class="box"><h2 style="margin-top:0">Prepared for</h2><b>${esc(project.client.name || 'Client')}</b><br>${esc(project.client.address || '')}<br>${[project.client.phone, project.client.email].filter(Boolean).map(esc).join(' · ')}</div><div class="box"><h2 style="margin-top:0">Project</h2><b>${esc(project.name)}</b><br>${rooms.length} area${rooms.length === 1 ? '' : 's'} measured${projectAreaSF(project) ? ` · ${fmtNum(projectAreaSF(project), 0)} sf floor area` : ''}<br>${isInv ? `Ref. ${esc(est.number)}` : `${est.items.length} line items`}</div></div>
    ${est.scopeText ? `<h2>Scope of work</h2><p>${esc(est.scopeText).replace(/\n/g, '<br>')}</p>` : ''}
    ${rooms.length ? `<h2>Measurements</h2><div class="tbl"><table><thead><tr><th>Area</th><th>Type</th><th>Measured</th></tr></thead><tbody>${roomRows}</tbody></table></div><div class="figures">${figures}</div>` : ''}
    ${!isInv && est.tiers && est.tiers.on && !est.tiers.chosen ? (() => { const sum = tierSummary(project, settings); const adds = addonPrices(project, settings); return `<h2>Choose your option</h2><div class="tiers">${sum.map((t) => `<div class="t ${t.key === 'better' ? 'pop' : ''}"><div style="font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#555">${esc(t.name)}${t.key === 'better' ? ' · most popular' : ''}</div><div class="p">${fmtMoney(t.total)}</div><div style="color:#555">${esc(t.blurb)}</div>${t.diffs.length ? `<ul>${t.diffs.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '<ul><li>Scope as itemized below</li></ul>'}<div style="color:#777;font-size:11px;margin-top:6px">Deposit ${fmtMoney(t.deposit)}</div></div>`).join('')}</div>${adds.length ? `<h3 style="margin-top:12px">Optional add-ons</h3><table><tbody>${adds.map((ad) => `<tr><td>${esc(ad.label)}</td><td class="r">+${fmtMoney(ad.price)}</td></tr>`).join('')}</tbody></table>` : ''}<p style="color:#666;font-size:11px">The itemized estimate below shows the <b>${esc(sum[1].name)}</b> option. Choose your option and add-ons when you sign.</p>`; })() : ''}
    ${!isInv && est.tiers && est.tiers.chosen ? `<p style="background:#f0f6ff;padding:8px 10px;border-radius:8px"><b>Selected option:</b> ${esc((est.tiers.names || {})[est.tiers.chosen] || est.tiers.chosen)}${(est.tiers.chosenAddons || []).length ? ` + ${est.tiers.chosenAddons.length} add-on${est.tiers.chosenAddons.length === 1 ? '' : 's'}` : ''}</p>` : ''}
    <h2>${isInv ? 'Invoice detail' : 'Itemized estimate'}</h2>
    <table><thead><tr><th>Item</th><th class="r">Qty</th><th>Unit</th><th class="r">Unit price</th><th class="r">Total</th></tr></thead><tbody>${groups || '<tr><td colspan="5" style="color:#888">No line items</td></tr>'}</tbody></table>
    <div class="doc-totals">
      ${inline ? `<div class="trow"><span>Subtotal</span><span>${fmtMoney(T.preTax + T.discount)}</span></div>` : `<div class="trow"><span>Materials</span><span>${fmtMoney(T.materials)}</span></div><div class="trow"><span>Labor</span><span>${fmtMoney(T.labor)}</span></div><div class="trow"><span>Fees</span><span>${fmtMoney(T.fees)}</span></div><div class="trow"><span>Markup, overhead & profit</span><span>${fmtMoney(T.markupTotal)}</span></div>`}
      ${T.discount ? `<div class="trow"><span>Discount</span><span>−${fmtMoney(T.discount)}</span></div>` : ''}
      <div class="trow"><span>Sales tax (${est.adj.taxRate || 0}%${est.adj.taxMaterialsOnly !== false ? ', materials' : ''})</span><span>${fmtMoney(T.tax)}</span></div>
      <div class="trow grand"><span>Total</span><span>${fmtMoney(T.total)}</span></div>
      ${isInv && it.changeOrders ? `<div class="trow"><span>Approved change orders</span><span>${fmtMoney(it.changeOrders)}</span></div><div class="trow grand" style="font-size:16px"><span>Revised contract</span><span>${fmtMoney(it.total)}</span></div>` : ''}${isInv ? `<div class="trow"><span>Payments received</span><span>−${fmtMoney(it.paid)}</span></div><div class="trow grand" style="font-size:16px"><span>Balance due</span><span>${fmtMoney(it.balance)}</span></div>` : `<div class="trow"><span>Deposit due at acceptance (${est.adj.depositPct || 0}%)</span><span>${fmtMoney(T.deposit)}</span></div>`}
    </div>
    ${payments}
    ${project.photos && project.photos.length ? `<h2>Site photos</h2><div class="photos">${project.photos.slice(0, 6).map((p) => `<img src="${p}" alt="site photo">`).join('')}</div>` : ''}
    ${est.notes ? `<h2>Notes</h2><p>${esc(est.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <h2>Terms</h2><p style="color:#444">${esc(terms)}</p>${project.cvs && project.cvs.conceptNotice ? `<p style="color:#666;font-size:11px;margin-top:12px">${esc(project.cvs.conceptNotice)}</p>` : ''}
    <div class="sig"><div class="slot">${esc(co.name || 'Contractor')}<br><span style="color:#888">Authorized signature · date</span></div><div class="slot">${est.signature ? `<img src="${est.signature.dataURL}" alt="signature">` : ''}${esc(est.signature ? est.signature.name : project.client.name || 'Client')}<br><span style="color:#888">${est.signature ? `Accepted ${fmtDate(est.signature.signedAt)}` : 'Client acceptance · date'}</span></div></div>
    <p style="color:#999;font-size:10px;margin-top:18px">Quantities derived from on-site measurements. Prepared with ${BRAND.name}.</p>
  </div>`;
}

export function openDocument(project, { mode = 'estimate', onChange } = {}) {
  const app = $('#app'); const s = store.settings; const est = project.estimate;
  if (mode === 'invoice' && !est.invoice) { convertToInvoice(project).then((ok) => ok && openDocument(project, { mode: 'invoice', onChange })); return; }
  const isInv = mode === 'invoice';
  const view = el(`<div class="doc-screen"><div class="doc-bar"><button class="btn ghost" data-act="close">${icons.back} Back</button><b>${isInv ? 'Invoice' : 'Estimate'} ${esc(isInv ? est.invoice.number : est.number)}</b><button class="btn ghost" data-act="print">${icons.print} PDF</button></div><div class="doc-scroll"></div>
    <div class="doc-actions">${isInv ? `<button class="btn sm success" data-act="pay">${icons.dollar} Record payment</button><button class="btn sm secondary" data-act="estimate">${icons.doc} View estimate</button>` : `<button class="btn sm" data-act="share">${icons.share} Share link</button><button class="btn sm success" data-act="sign">${icons.sign} ${est.signature ? 'Re-sign' : 'Client sign'}</button><button class="btn sm secondary" data-act="sent">${icons.check} Mark sent</button><button class="btn sm secondary" data-act="invoice">${icons.invoice} ${est.invoice ? 'View invoice' : 'Convert to invoice'}</button>`}<button class="btn sm neutral" data-act="email">Email</button><button class="btn sm neutral" data-act="notes">Notes</button></div></div>`);
  const scroll = $('.doc-scroll', view); const render = () => { scroll.innerHTML = renderDocumentHTML(project, s, { mode }); }; render(); app.append(view);
  const close = () => { view.remove(); onChange && onChange(); };
  view.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'close') close();
    if (act === 'print') { if (isEmbedded() || (window.claude && typeof window.claude.use === 'function')) { toast('Preparing printable file…'); download(`${isInv ? est.invoice.number : est.number}.html`, await standaloneHTML(project, s, mode), 'text/html'); } else window.print(); }
    if (['share', 'sign', 'sent', 'email'].includes(act) && !(await checkReadyToSend(project))) return;
    if (act === 'share') { const url = await buildShareLink(project, s); const T = totals(est); const r = await shareOrCopy({ title: `${est.number} — ${project.name}`, text: `${s.company.name || 'Estimate'} ${est.number}: ${fmtMoney(T.total)} for ${project.name}`, url }); if (r === 'copied') toast('Link copied — paste it to your client'); if (r !== 'cancelled' && r !== 'failed' && project.status === 'draft') { project.status = 'sent'; est.sentAt = new Date().toISOString(); commit(); render(); } }
    if (act === 'sign') {
      let choice = null; if (est.tiers && est.tiers.on && !est.tiers.chosen) { choice = await tierChoiceSheet(project, s); if (!choice) return; }
      const sig = await signatureSheet(project.client.name); if (!sig) return;
      if (choice) applyChoice(project, s, choice.tier, choice.addons);
      est.signature = sig; est.signedTotal = Math.round(totals(est).total * 100) / 100; project.status = 'signed'; commit(); render(); toast('Signed — contract total locked');
      if (project.sharedFrom) offerResponse(project, { accept: { tier: choice ? choice.tier : null, addons: choice ? choice.addons : [], total: est.signedTotal } });
    }
    if (act === 'sent') { project.status = 'sent'; est.sentAt = new Date().toISOString(); commit(); render(); toast('Marked as sent'); }
    if (act === 'invoice') { if (!est.invoice) { if (!(await convertToInvoice(project))) return; } view.remove(); openDocument(project, { mode: 'invoice', onChange }); }
    if (act === 'estimate') { view.remove(); openDocument(project, { mode: 'estimate', onChange }); }
    if (act === 'pay') { const ok = await paymentSheet(project); if (ok) render(); }
    if (act === 'email') { const T = totals(est); const subj = encodeURIComponent(`${isInv ? 'Invoice' : 'Estimate'} ${isInv ? est.invoice.number : est.number} — ${project.name}`); const body = encodeURIComponent(`Hi ${project.client.name || ''},\n\nPlease find ${isInv ? 'your invoice' : 'our estimate'} for ${project.name}: ${fmtMoney(isInv ? invoiceTotals(project).balance : T.total)}${isInv ? ' balance due' : ''}.\n\n${isInv ? '' : 'You can review and accept it here: ' + (await buildShareLink(project, s)) + '\n\n'}Thank you,\n${s.company.name || ''}\n${s.company.phone || ''}`); location.href = `mailto:${encodeURIComponent(project.client.email || '')}?subject=${subj}&body=${body}`; }
    if (act === 'notes') { const v = await promptDialog('Notes on the document', { label: 'Printed under the line items', value: est.notes || '' }); if (v !== null) { est.notes = v; commit(); render(); } }
  });
}

export async function convertToInvoice(project) {
  const est = project.estimate; if (est.invoice) return true;
  if (!(await confirmDialog('Create an invoice from this estimate? The estimate stays as the signed reference; payments are tracked on the invoice.', { okLabel: 'Create invoice', title: 'Convert to invoice' }))) return false;
  store.update((s) => { const p = s.projects.find((x) => x.id === project.id); const now = new Date().toISOString(); p.estimate.invoice = { number: `INV-${s.settings.nextInvoiceNo}`, date: now, dueDate: addDays(now, 14), payments: [] }; s.settings.nextInvoiceNo += 1; p.status = 'invoiced'; }, 'project');
  Object.assign(project, store.project(project.id)); toast(`Invoice ${project.estimate.invoice.number} created`); return true;
}

function paymentSheet(project) {
  return new Promise((resolve) => {
    const it = invoiceTotals(project); const body = el(`<div><div class="stat-grid"><div class="stat"><div class="v">${fmtMoney(it.total, { cents: false })}</div><div class="k">total</div></div><div class="stat"><div class="v">${fmtMoney(it.paid, { cents: false })}</div><div class="k">paid</div></div><div class="stat"><div class="v">${fmtMoney(it.balance, { cents: false })}</div><div class="k">balance</div></div></div><div class="inline-fields mt12"><div class="field"><label>Amount</label><input data-f="amount" type="number" step="0.01" inputmode="decimal" value="${it.balance.toFixed(2)}"></div><div class="field"><label>Date</label><input data-f="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div><div class="inline-fields"><div class="field"><label>Method</label><select data-f="method"><option>Check</option><option>Cash</option><option>Card</option><option>Zelle</option><option>ACH</option><option>Other</option></select></div><div class="field"><label>Note</label><input data-f="note" type="text" placeholder="Deposit, final, …"></div></div><div class="chips mt8"><button class="chip" data-q="deposit">Deposit ${fmtMoney(it.deposit, { cents: false })}</button><button class="chip" data-q="half">50%</button><button class="chip" data-q="full">Balance</button></div></div>`);
    body.addEventListener('click', (e) => { const q = e.target.closest('[data-q]')?.dataset.q; if (!q) return; $('[data-f="amount"]', body).value = (q === 'deposit' ? it.deposit : q === 'half' ? it.total / 2 : it.balance).toFixed(2); });
    sheet({ title: 'Record payment', body, onClose: (r) => resolve(!!r), actions: [{ label: 'Save payment', onClick: () => { const amount = Number($('[data-f="amount"]', body).value); if (!(amount > 0)) { toast('Enter an amount'); return false; } project.estimate.invoice.payments.push({ id: Math.random().toString(36).slice(2, 8), amount, date: new Date($('[data-f="date"]', body).value || Date.now()).toISOString(), method: $('[data-f="method"]', body).value, note: $('[data-f="note"]', body).value.trim() }); if (invoiceTotals(project).balance <= 0.005) project.status = 'paid'; commit(); toast('Payment recorded'); return true; } }, { label: 'Cancel', cls: 'neutral', onClick: () => false }] });
  });
}

function signatureSheet(defaultName = '') {
  return new Promise((resolve) => {
    const body = el(`<div><p class="muted small">By signing, the client accepts the scope, price and terms shown on the estimate.</p><div class="field"><label>Full name</label><input data-f="name" type="text" value="${esc(defaultName)}" autocomplete="name"></div><div class="field"><label>Signature</label><canvas class="sigpad" width="800" height="360"></canvas></div><div class="row between"><button class="btn xs neutral" data-act="clear">Clear</button><span class="dim tiny">Draw with your finger</span></div></div>`);
    const c = $('canvas', body), g = c.getContext('2d'); let drawing = false, drew = false; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111';
    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
    c.addEventListener('pointerdown', (e) => { drawing = true; drew = true; const p = pt(e); g.beginPath(); g.moveTo(p.x, p.y); c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pt(e); g.lineTo(p.x, p.y); g.stroke(); });
    c.addEventListener('pointerup', () => { drawing = false; }); c.addEventListener('pointercancel', () => { drawing = false; });
    body.addEventListener('click', (e) => { if (e.target.closest('[data-act="clear"]')) { g.clearRect(0, 0, c.width, c.height); drew = false; } });
    sheet({ title: 'Client signature', body, onClose: (r) => resolve(r || null), actions: [{ label: 'Accept & sign', cls: 'success', keepOpen: true, onClick: (_, close) => { const name = $('[data-f="name"]', body).value.trim(); if (!name) return toast('Enter the signer’s name'); if (!drew) return toast('Please draw a signature'); close({ dataURL: c.toDataURL('image/png'), name, signedAt: new Date().toISOString(), userAgent: navigator.userAgent }); } }, { label: 'Cancel', cls: 'neutral', onClick: () => null }] });
  });
}

// ---- share links: compact project payload → deflate → base64url in the URL hash
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export async function buildShareLink(project, settings, extra = {}) {
  const slim = structuredClone(project); slim.photos = []; (slim.changeOrders || []).forEach((c) => { if (c.photo && c.photo.length > 60000) c.photo = ''; }); slim.rooms.forEach((r) => { delete r.snapshot; r.cloudCount = 0; }); if (slim.estimate.signature) slim.estimate.signature = { ...slim.estimate.signature, dataURL: '' };
  const payload = JSON.stringify({ v: 1, project: slim, company: { ...settings.company, logo: '' }, units: settings.units, origin: location.href.split('#')[0], ...extra });
  let enc; if ('CompressionStream' in window) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(payload)); w.close(); enc = 'd:' + b64url(await new Response(cs.readable).arrayBuffer()); } else enc = 'j:' + b64url(new TextEncoder().encode(payload));
  const base = location.href.split('#')[0]; return `${base}#share=${enc}`;
}
export async function decodeShareLink(hash) {
  const m = /share=([^&]+)/.exec(hash || ''); if (!m) return null; const enc = decodeURIComponent(m[1]);
  const bytes = unb64url(enc.slice(2)); let text;
  if (enc.startsWith('d:')) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); text = await new Response(ds.readable).text(); } else text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}


/** Self-contained HTML of the document (used where window.print is unavailable, e.g. inside an artifact view). */
export async function standaloneHTML(project, settings, mode = 'estimate') {
  let css = ''; try { css = await (await fetch('./css/app.css')).text(); } catch {}
  const est = project.estimate; const title = `${mode === 'invoice' && est.invoice ? est.invoice.number : est.number} — ${project.name}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${css}
body{margin:0;background:#e9e9ee;padding:16px;font-family:-apple-system,Inter,Roboto,Segoe UI,sans-serif}.no-print{text-align:center;margin:0 auto 12px;max-width:800px}.no-print button{padding:10px 18px;border-radius:10px;border:0;background:#1f6feb;color:#fff;font-weight:700;font-size:15px}@media print{body{background:#fff;padding:0}.no-print{display:none}.doc{box-shadow:none;border-radius:0}}</style></head><body><div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>${renderDocumentHTML(project, settings, { mode })}</body></html>`;
}


// ---------------------------------------------------------------- tier choice at signing
function tierChoiceSheet(project, settings) {
  return new Promise((resolve) => {
    const sum = tierSummary(project, settings); const addsBy = {}; let tier = 'better'; const chosen = new Set();
    const body = h('div'); const draw = () => { const adds = (addsBy[tier] ||= addonPrices(project, settings, tier)); const exact = variant(project, settings, tier, [...chosen]).totals.total;
      body.innerHTML = ''; body.append(el(`<p class="muted small">Pick the option you want. You can add extras below.</p>`));
      const row = h('div', { class: 'tier-row mt8' }); for (const t of sum) row.append(el(`<button class="tier ${t.key === tier ? 'pop' : ''}" data-t="${t.key}"><div class="n">${esc(t.name)}</div><div class="v">${money0(t.total)}</div></button>`)); body.append(row);
      const d = sum.find((t) => t.key === tier); if (d.diffs.length) body.append(el(`<div class="dim small mt8">${d.diffs.map(esc).join(' · ')}</div>`));
      for (const a of adds) { const r = h('div', { class: 'row between mt8' }, el(`<span>${esc(a.label)} <b class="mono">+${money0(a.price)}</b></span>`)); r.append(switchEl(chosen.has(a.key), (v) => { if (v) chosen.add(a.key); else chosen.delete(a.key); draw(); })); body.append(r); }
      body.append(el(`<div class="calc-out mt12">Your total: <b>${fmtMoney(exact)}</b></div>`)); };
    body.addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (t) { tier = t.dataset.t; draw(); } });
    draw(); sheet({ title: 'Choose your option', body, onClose: (r) => resolve(r || null), actions: [{ label: 'Continue to sign', onClick: () => ({ tier, addons: [...chosen] }) }, { label: 'Cancel', cls: 'neutral', onClick: () => null }] });
  });
}

// ---------------------------------------------------------------- change-order document
export function renderCODocHTML(project, co, settings) {
  const est = project.estimate; const c = (project.sharedFrom && project.sharedFrom.company) || settings.company || {}; const t = coTotals(co, est); const L = ledger(project); const f = est.adj.inlineMarkup !== false ? t.sellFactor : 1;
  const after = co.status === 'approved' ? L.revised : L.revised + t.total;
  return `<div class="doc"><div class="doc-head"><div>${c.logo ? `<img src="${c.logo}" alt="logo"><br>` : ''}<h1 style="margin-top:4px">${esc(c.name || 'Your Company')}</h1><div style="color:#555">${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</div></div><div style="text-align:right"><span class="stamp" style="color:${co.status === 'approved' ? '#1d7a3d' : '#b25b00'};border-color:${co.status === 'approved' ? '#1d7a3d' : '#b25b00'}">${co.status === 'approved' ? 'APPROVED' : 'CHANGE ORDER'}</span><div style="font-size:20px;font-weight:800;margin-top:6px">CO #${co.n}</div><div style="color:#555">${esc(est.number)} · ${fmtDate(co.createdAt)}</div></div></div>
    <div class="parties"><div class="box"><h2 style="margin-top:0">Client</h2><b>${esc(project.client.name || 'Client')}</b><br>${esc(project.client.address || '')}</div><div class="box"><h2 style="margin-top:0">Project</h2><b>${esc(project.name)}</b><br>${co.scheduleDays ? `Schedule impact: ${co.scheduleDays > 0 ? '+' : ''}${co.scheduleDays} day${Math.abs(co.scheduleDays) === 1 ? '' : 's'}` : 'No schedule impact'}</div></div>
    <h2>${esc(co.title || 'Change')}</h2><p>${esc(co.reason || '').replace(/\n/g, '<br>')}</p>${co.photo ? `<div class="photos"><img src="${co.photo}" alt="evidence photo"></div>` : ''}
    <table><thead><tr><th>Item</th><th class="r">Qty</th><th>Unit</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${(co.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${fmtNum(i.qty, 2)}</td><td>${esc(i.unit)}</td><td class="r">${fmtMoney(i.unitCost * f)}</td><td class="r">${fmtMoney(lineTotal(i) * f)}</td></tr>`).join('')}</tbody></table>
    <div class="doc-totals"><div class="trow"><span>Subtotal</span><span>${fmtMoney(t.preTax)}</span></div><div class="trow"><span>Tax</span><span>${fmtMoney(t.tax)}</span></div><div class="trow grand"><span>${co.credit ? 'Credit' : 'This change'}</span><span>${fmtMoney(t.total)}</span></div></div>
    <h2>Contract</h2><div class="ledger"><div class="trow"><span>Original contract</span><span>${fmtMoney(L.original)}</span></div><div class="trow"><span>Previously approved changes</span><span>${fmtMoney(L.approved - (co.status === 'approved' ? t.total : 0))}</span></div><div class="trow"><span>This change order</span><span>${fmtMoney(t.total)}</span></div><div class="trow" style="font-weight:800;border-top:2px solid #111;padding-top:6px"><span>Revised contract</span><span>${fmtMoney(after)}</span></div></div>
    <div class="sig"><div class="slot">${esc(c.name || 'Contractor')}<br><span style="color:#888">Authorized signature · date</span></div><div class="slot">${co.signature ? `<img src="${co.signature.dataURL}" alt="signature">` : ''}${esc(co.signature ? co.signature.name : project.client.name || 'Client')}<br><span style="color:#888">${co.signature ? `Approved ${fmtDate(co.approvedAt)}` : 'Client approval · date'}</span></div></div>
    <p style="color:#999;font-size:10px;margin-top:18px">This change order amends the contract referenced above. All other terms remain unchanged. Prepared with ${BRAND.name}.</p></div>`;
}
export function openCODocument(project, co, { onChange } = {}) {
  const s = store.settings; const view = el(`<div class="doc-screen"><div class="doc-bar"><button class="btn ghost" data-act="close">${icons.back} Back</button><b>Change order #${co.n}</b><button class="btn ghost" data-act="print">${icons.print} PDF</button></div><div class="doc-scroll"></div><div class="doc-actions">${co.status === 'approved' ? '' : `<button class="btn sm success" data-act="approve">${icons.sign} Client approves & signs</button><button class="btn sm" data-act="share">${icons.share} Share for approval</button>`}</div></div>`);
  const render = () => { $('.doc-scroll', view).innerHTML = renderCODocHTML(project, co, s); }; render(); $('#app').append(view);
  view.addEventListener('click', async (e) => { const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'close') { view.remove(); onChange && onChange(); }
    if (act === 'print') { if (isEmbedded() || (window.claude && typeof window.claude.use === 'function')) download(`CO-${co.n}-${project.estimate.number}.html`, await standaloneCO(project, co, s), 'text/html'); else window.print(); }
    if (act === 'approve') { const sig = await signatureSheet(project.client.name); if (sig) { co.signature = sig; co.status = 'approved'; co.approvedAt = new Date().toISOString(); onChangeOrderApproved(project, co); commit(); render(); $('.doc-actions', view).innerHTML = ''; toast('Change order approved — contract updated'); if (project.sharedFrom) offerResponse(project, { coApprovals: [{ coId: co.id, n: co.n, signature: sig, approvedAt: co.approvedAt, total: coTotals(co, project.estimate).total }] }); } }
    if (act === 'share') { const url = await buildShareLink(project, s, { focusCO: co.id }); const r = await shareOrCopy({ title: `Change order #${co.n} — ${project.name}`, text: `${s.company.name || ''} change order #${co.n} for ${project.name}: ${fmtMoney(coTotals(co, project.estimate).total)}. Review and approve:`, url }); if (r !== 'cancelled' && r !== 'failed') { if (co.status === 'draft') co.status = 'sent'; co.sentAt = new Date().toISOString(); commit(); toast(r === 'copied' ? 'Approval link copied' : 'Sent'); } }
  });
}
async function standaloneCO(project, co, settings) { let css = ''; try { css = await (await fetch('./css/app.css')).text(); } catch {} return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CO #${co.n} — ${esc(project.name)}</title><style>${css} body{margin:0;background:#e9e9ee;padding:16px}@media print{body{background:#fff;padding:0}}</style></head><body>${renderCODocHTML(project, co, settings)}</body></html>`; }

// ---------------------------------------------------------------- material orders (per supplier)
export function openMaterialOrder(project) {
  const s = store.settings; const groups = groupBySupplier(project.estimate.items, s); const pn = panel({ title: 'Material orders' }); const B = pn.body;
  B.append(el(`<p class="muted small mt8">One list per supplier, ready to text to the counter, email, or load into a cart. Quantities include waste. Prices are estimates until the supplier confirms.</p>`));
  if (!groups.length) B.append(el(`<div class="empty">${icons.layers}<p>No materials on this job yet.</p></div>`));
  groups.forEach((g, gi) => { const c = h('div', { class: 'card' }, el(`<div class="card-title"><h3>${esc(g.supplier.name)}</h3><b class="mono">${money0(g.subtotal)}</b></div>`));
    for (const l of g.lines) c.append(el(`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);align-items:flex-start"><div class="grow"><b>${fmtNum(l.qty, 2)} ${esc(l.unit)}</b> — ${esc(l.name)}${l.sku ? `<div class="dim tiny">SKU ${esc(l.sku)}</div>` : ''}</div><span class="dim small mono">${money0(lineTotal(l))}</span></div>`));
    c.append(el(`<div class="dim small mt8">${g.delivery ? `Delivery about $${g.delivery}` : 'Pickup / free delivery'}${g.supplier.notes ? ` · ${esc(g.supplier.notes)}` : ''}</div>`), el(`<div class="btn-grid mt8"><button class="btn sm secondary" data-g="${gi}" data-a="copy">${icons.copy} Copy list</button><button class="btn sm secondary" data-g="${gi}" data-a="share">${icons.share} Send</button></div>`)); B.append(c); });
  if (groups.length) B.append(el(`<button class="btn block mt12" data-a="csv">${icons.download} All orders (CSV)</button>`));
  B.addEventListener('click', async (e) => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
    if (a === 'csv') return download(`${project.estimate.number}-material-orders.csv`, materialOrderCSV(groups, { project }), 'text/csv');
    const g = groups[Number(t.dataset.g)]; const text = materialOrderText(g, project);
    if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast('Order list copied'); } catch { toast('Copy failed'); } }
    if (a === 'share') { const r = await shareOrCopy({ title: `Material order — ${project.name}`, text }); if (r === 'copied') toast('Order list copied'); } });
  return pn;
}

// ---------------------------------------------------------------- job plan (internal)
export function openJobPlan(project) {
  const s = store.settings; const plan = jobPlan(project, s); const T = plan.totals; const pn = panel({ title: 'Job plan' }); const B = pn.body;
  B.append(el(`<div class="card"><div class="card-title"><h3>Crew & schedule</h3></div><div class="kpi"><div class="stat"><div class="v">${fmtNum(plan.laborHours, 1)} h</div><div class="k">labor hours</div></div><div class="stat"><div class="v">${plan.crewDays}</div><div class="k">crew-days (${plan.crewSize}-person crew)</div></div></div>${plan.trades.map((t) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc((TRADES[t.trade] || {}).label || t.trade)}</span><span class="mono">${fmtNum(t.hours, 1)} h · ${money0(t.cost)}</span></div>`).join('')}</div>`));
  B.append(el(`<div class="card"><div class="card-title"><h3>Materials by supplier</h3></div>${plan.suppliers.map((g) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(g.supplier.name)} · ${g.lines.length} items</span><span class="mono">${money0(g.subtotal)}</span></div>`).join('') || '<p class="dim small">No materials.</p>'}</div>`));
  B.append(el(`<div class="card"><div class="card-title"><h3>Money</h3></div><div class="kpi"><div class="stat"><div class="v">${money0(T.cost)}</div><div class="k">cost</div></div><div class="stat"><div class="v">${money0(T.preTax)}</div><div class="k">price before tax</div></div><div class="stat"><div class="v">${fmtNum(T.grossMargin, 1)}%</div><div class="k">gross margin</div></div><div class="stat"><div class="v">${money0(T.net)}</div><div class="k">net after overhead</div></div></div></div>`));
  const notes = []; for (const inst of project.estimate.products || []) { const r = compileProduct({ ...inst, qty: inst.qty || 1 }); for (const n of r.notes || []) notes.push(`${r.label}: ${n}`); }
  const fees = (project.estimate.items || []).filter((i) => i.cat === 'fee');
  if (notes.length || fees.length) B.append(el(`<div class="card"><div class="card-title"><h3>Before you start</h3></div>${fees.map((f) => `<div class="flag info">${icons.check}<div>${esc(f.name)} — ${money0(lineTotal(f))}</div></div>`).join('')}${notes.map((n) => `<div class="flag">${icons.info}<div>${esc(n)}</div></div>`).join('')}</div>`));
  return pn;
}

// ---------------------------------------------------------------- client → contractor response links (no server)
async function smallSignature(sig) { try { const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = sig.dataURL; }); const c = document.createElement('canvas'); c.width = 300; c.height = 135; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 135); g.drawImage(img, 0, 0, 300, 135); return { ...sig, dataURL: c.toDataURL('image/jpeg', 0.7) }; } catch { return { ...sig, dataURL: '' }; } }
async function encodePayload(obj) { const payload = JSON.stringify(obj); if ('CompressionStream' in window) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(payload)); w.close(); return 'd:' + b64url(await new Response(cs.readable).arrayBuffer()); } return 'j:' + b64url(new TextEncoder().encode(payload)); }
export async function buildResponseLink(project, { accept = null, coApprovals = [] } = {}) {
  const src = project.sharedFrom || {}; const enc = await encodePayload({ v: 1, kind: 'response', ref: { sourceId: src.sourceId, number: project.estimate.number }, accept: accept ? { ...accept, signature: await smallSignature(project.estimate.signature) } : null, coApprovals: await Promise.all(coApprovals.map(async (c) => ({ ...c, signature: await smallSignature(c.signature) }))), from: project.client.name || '' });
  return `${src.origin || location.href.split('#')[0]}#share=${enc}`;
}
async function offerResponse(project, what) {
  const who = (project.sharedFrom && project.sharedFrom.company && project.sharedFrom.company.name) || 'your contractor';
  sheet({ title: 'Send it back', body: `<p class="muted">Your approval is saved on this phone. Send it to <b>${esc(who)}</b> so their copy updates too.</p>`, actions: [{ label: `Send to ${who}`, onClick: async () => { const url = await buildResponseLink(project, what); const r = await shareOrCopy({ title: `Approved: ${project.name}`, text: `Approved ${project.estimate.number} for ${project.name}.`, url }); if (r === 'copied') toast('Link copied — paste it in a text or email'); } }, { label: 'Later', cls: 'neutral' }] });
}
/** Contractor side: apply a client's response to the matching job. Returns a summary string or null. */
export function applyResponse(data, settings) {
  const p = store.projects().find((x) => x.id === (data.ref && data.ref.sourceId)) || store.projects().find((x) => x.estimate.number === (data.ref && data.ref.number)); if (!p) return null; const est = p.estimate; const out = [];
  if (data.accept) { if (data.accept.tier && est.tiers && est.tiers.on && !est.tiers.chosen) applyChoice(p, settings, data.accept.tier, data.accept.addons || []); est.signature = data.accept.signature; est.signedTotal = Math.round(totals(est).total * 100) / 100; p.status = 'signed'; out.push(`Estimate accepted${data.accept.tier ? ` (${(est.tiers.names || {})[data.accept.tier] || data.accept.tier})` : ''} — ${fmtMoney(est.signedTotal)}`); if (data.accept.total && Math.abs(data.accept.total - est.signedTotal) > 1) out.push(`Note: client saw ${fmtMoney(data.accept.total)}; your bid recomputes to ${fmtMoney(est.signedTotal)}.`); }
  for (const c of data.coApprovals || []) { const co = (p.changeOrders || []).find((x) => x.id === c.coId); if (co && co.status !== 'approved') { co.status = 'approved'; co.signature = c.signature; co.approvedAt = c.approvedAt; onChangeOrderApproved(p, co); out.push(`Change order #${co.n} approved`); } }
  store.update((st) => { st.activeProjectId = p.id; }, 'project'); return { project: p, summary: out.join(' · ') };
}

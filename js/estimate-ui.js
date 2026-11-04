// Estimate tab: scope → assemblies → line items → totals
import { store } from './store.js';
import { ASSEMBLIES, ASSEMBLY_MAP, TRADES, BUNDLES, ITEM_LIBRARY, UNITS } from './pricing/catalog.js';
import { recompute, totals, lineTotal, lineHours, itemsByGroup, customItem, projectAreaSF, regionFor, toCSV, quickBooksCSV, ledger, coTotals, jobPlan } from './pricing/estimator.js';
import { SYSTEM_MAP } from './pricing/products.js';
import { suppliersOf, supplierById, groupBySupplier } from './pricing/suppliers.js';
import { METHOD_LABELS, profileOf, markupFromMargin, TRADES as LABOR_TRADES } from './pricing/profile.js';
import { generateTiers, tierSummary, addonPrices, TIER_KEYS } from './pricing/tiers.js';
import { openConfigurator, srcBadge } from './configurator-ui.js';
import { openChangeOrder } from './changeorder-ui.js';
import { openPricingPanel, adjFromProfile } from './pricing-ui.js';
import { parseScope, flags, upsells, startVoice } from './pricing/smart.js';
import { runAI, aiStatus } from './pricing/ai.js';
import { el, h, $, $$, toast, sheet, icons, confirmDialog, promptDialog, fmtMoney, fmtNum, fmtDate, esc, segEl, switchEl, download, readFileAsDataURL, bind, money0, pct as pctf } from './ui.js';
import { openDocument, openMaterialOrder, openJobPlan } from './document.js';
import { metrics, fmtArea } from './geometry.js';
import { cvsCard, cvsJobCard, cvsLineBadges, lineAmount, saveCvsLineEdit } from './cvs-ui.js';

const commit = (tag = 'estimate') => store.update((s) => { const p = s.projects.find((x) => x.id === s.activeProjectId); if (p) p.updatedAt = new Date().toISOString(); }, tag);

export function renderEstimate(root, { navigate }) {
  const s = store.settings; const project = store.activeProject();
  root.innerHTML = '';
  if (!project) { root.append(el(`<div class="empty">${icons.doc}<h3>No job yet</h3><p class="mt8">Measure something or configure a product to start a bid.</p><div class="row mt16" style="justify-content:center;gap:8px"><button class="btn" data-act="new">${icons.plus} New project</button><button class="btn secondary" data-act="scan">Scan a room</button></div></div>`)); bind(root, 'click', (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (a === 'new') { store.createProject({}); renderEstimate(root, { navigate }); } if (a === 'scan') navigate('scan'); }); return; }
  const est = project.estimate; recompute(project, s); const T = totals(est); const sf = projectAreaSF(project);

  // ---- header
  const head = el(`<div class="card"><div class="row between"><div class="grow"><div class="row" style="gap:8px"><h2 data-act="rename" style="cursor:pointer">${esc(project.name)}</h2><span class="pill ${est.status || project.status || 'draft'}">${esc(project.status || 'draft')}</span></div><div class="dim small">${esc(est.number)} · ${fmtDate(est.date)} · ${project.rooms.length} area${project.rooms.length === 1 ? '' : 's'}${sf ? ` · ${fmtNum(sf, 0)} sf` : ''}</div></div><button class="btn icon neutral" data-act="more">${icons.more}</button></div>
    <div class="row mt12" style="gap:8px"><button class="btn sm secondary grow" data-act="client">${icons.edit} ${project.client.name ? esc(project.client.name) : 'Add client'}</button><button class="btn sm grow" data-act="preview">${icons.doc} Preview & send</button></div></div>`);
  root.append(head);
  if (project.cvs) root.append(cvsCard(project, () => renderEstimate(root, { navigate })));
  if (project.cvs) root.append(cvsJobCard(project, () => renderEstimate(root, { navigate })));

  // ---- scope
  const scope = h('div', { class: 'card' });
  scope.append(el(`<div class="card-title"><h3>Scope</h3><span class="dim small">${est.assemblies.length} selected</span></div>`));
  const ta = el(`<textarea placeholder="Describe the job in plain language, e.g. “Remove carpet, install LVP, new 5¼ baseboard, paint walls and ceiling two coats, add 6 recessed lights”">${esc(est.scopeText || '')}</textarea>`);
  const mic = el(`<button class="mic" title="Dictate">${icons.mic}</button>`);
  scope.append(h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow' }, ta), mic));
  scope.append(el(`<div class="row mt8" style="gap:8px"><button class="btn sm grow" data-act="build">${icons.sparkle} Build estimate from description</button><button class="btn sm neutral" data-act="bundles">Bundles</button></div>`));
  const ais = aiStatus(s);
  scope.append(el(`<button class="btn sm block mt8 ${ais.ready ? 'success' : 'neutral'}" data-act="ai">${icons.camera} AI estimate from photos & description${ais.ready ? '' : ' · set up'}</button><div class="dim tiny mt8">${ais.ready ? `Uses ${esc(ais.label)}: reads your ${project.photos.length} photo${project.photos.length === 1 ? '' : 's'}, the description and the measured rooms, then fills in work items, custom lines, a client-ready scope and risk flags.` : 'Add an Anthropic API key or a server endpoint in Settings → AI assist to analyze photos.'}</div>`));
  root.append(scope);
  ta.addEventListener('change', () => { est.scopeText = ta.value; commit(); });
  let voice = null; mic.addEventListener('click', () => { if (voice) { voice.stop(); return; } const base = ta.value ? ta.value.trim() + ' ' : ''; voice = startVoice({ onResult: (t) => { ta.value = base + t; }, onEnd: () => { mic.classList.remove('live'); voice = null; est.scopeText = ta.value; commit(); }, onError: (e) => { toast('Voice input: ' + e); mic.classList.remove('live'); voice = null; } }); if (!voice) return toast('Voice input not supported in this browser'); mic.classList.add('live'); toast('Listening… tap the mic to stop'); });

  // ---- assemblies chips
  const asm = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Work items</h3><button class="btn xs secondary" data-act="add-asm">${icons.plus} Add</button></div>`));
  if (!est.assemblies.length) asm.append(el(`<p class="dim small">Nothing selected. Describe the job above, pick a bundle, or tap Add.</p>`));
  const chips = h('div', { class: 'chips' });
  for (const a of est.assemblies) { const def = ASSEMBLY_MAP[a.key]; if (!def) continue; chips.append(el(`<button class="chip on" data-act="asm-opts" data-key="${a.key}">${esc(def.name)}${a.roomIds ? ` <span class="dim">(${a.roomIds.length})</span>` : ''} ${icons.chevron}</button>`)); }
  asm.append(chips);
  const prods = est.products || [];
  asm.append(el(`<div class="group-head" style="margin-top:12px"><span>Products & what they need</span><button class="btn xs secondary" data-act="go" data-go="build">${icons.plus} Configure</button></div>`));
  if (!prods.length) asm.append(el(`<p class="dim small">Picked a toilet, window, water heater, roof line or deck boards? Configure it in <b>Build</b> and every part, labor hour and fee it needs lands here.</p>`));
  const pch = h('div', { class: 'chips' }); for (const p of prods) { const sys = p.ai ? null : SYSTEM_MAP[p.key]; pch.append(el(`<button class="chip on" data-act="prod" data-id="${p.id}">${esc((sys ? sys.name : (p.ai && p.ai.productName) || 'Product') + (p.productName ? ` — ${p.productName}` : ''))} ${icons.chevron}</button>`)); } asm.append(pch);
  root.append(asm);

  // ---- smart review
  const fl = flags(project, s), ups = upsells(project);
  if (fl.length || ups.length || est.ai) {
    const sr = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Smart review</h3><span class="dim small">${fl.filter((f) => f.level === 'warn').length} warnings</span></div>`));
    if (est.ai) {
      const a = est.ai; sr.append(el(`<div class="row between"><b>${icons.sparkle} AI review</b><span class="pill ${a.confidence === 'high' ? 'signed' : a.confidence === 'low' ? 'draft' : 'sent'}">${esc(a.confidence)} confidence</span></div>`));
      for (const f of a.flags || []) sr.append(el(`<div class="flag">${icons.warn}<div class="grow">${esc(f)}</div></div>`));
      if ((a.assumptions || []).length) sr.append(el(`<details class="mt8"><summary class="small muted">Assumptions (${a.assumptions.length})</summary><ul class="small muted" style="padding-left:18px;margin:6px 0">${a.assumptions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`));
      if ((a.upsells || []).length) { const uc = h('div', { class: 'chips mt8' }); for (const u of a.upsells) if (!est.assemblies.some((x) => x.key === u.key)) uc.append(el(`<button class="chip" data-act="add-key" data-key="${u.key}" title="${esc(u.reason)}">${icons.plus} ${esc(u.name)}</button>`)); sr.append(uc); }
      sr.append(el(`<div class="row between mt8"><span class="dim tiny">${esc(a.model || a.provider || 'AI')} · ${fmtDate(a.at)}${a.cost != null ? ` · ≈ ${fmtMoney(a.cost)}` : ''}</span><button class="btn xs neutral" data-act="ai-clear">Clear</button></div>`));
      if (fl.length || ups.length) sr.append(el(`<div class="group-head" style="margin-top:12px">Rule checks</div>`));
    }
    for (const f of fl) sr.append(el(`<div class="flag ${f.level === 'info' ? 'info' : ''}">${f.level === 'warn' ? icons.warn : icons.info}<div class="grow">${esc(f.msg)}</div>${f.add ? `<button class="btn xs" data-act="add-key" data-key="${f.add}">Add</button>` : f.go ? `<button class="btn xs neutral" data-act="go" data-go="${f.go}">Go</button>` : ''}</div>`));
    if (ups.length) { sr.append(el(`<div class="group-head" style="margin-top:12px">Upsell suggestions</div>`)); const uc = h('div', { class: 'chips' }); for (const u of ups) uc.append(el(`<button class="chip" data-act="add-key" data-key="${u.key}" title="${esc(u.reason)}">${icons.plus} ${esc(u.name)}</button>`)); sr.append(uc); sr.append(el(`<p class="dim tiny mt8">${esc(ups[0].reason)}</p>`)); }
    root.append(sr);
  }

  // ---- line items
  const li = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Line items</h3><button class="btn xs secondary" data-act="add-custom">${icons.plus} Custom line</button></div>`));
  if (!est.items.length) li.append(el(`<p class="dim small">No lines yet.${project.rooms.length ? '' : ' Scan or enter a room so quantities can be calculated.'}</p>`));
  for (const g of itemsByGroup(est.items)) {
    li.append(el(`<div class="group-head"><span>${esc(g.name)}</span><span>${fmtMoney(g.total)}</span></div>`));
    for (const it of g.items) li.append(el(`<div class="line" data-act="edit-line" data-id="${esc(it.id)}"><div><div class="name">${esc(it.name)}${it.locked ? ' <span class="dim tiny">✎</span>' : ''}</div><div class="meta"><span class="pill ${it.cat}">${it.cat}</span><span>${fmtNum(it.qty, 2)} ${esc(it.unit)} × ${fmtMoney(it.unitCost)}</span>${it.cat === 'labor' ? `<span>· ${fmtNum(lineHours(it), 1)} h ${esc((LABOR_TRADES[it.ltrade] || {}).label || '')}</span>` : ''}${it.cat === 'material' && it.supplierId ? `<span>· ${esc((supplierById(s, it.supplierId) || {}).short || '')}</span>` : ''}${srcBadge(it)}${cvsLineBadges(it)}${it.roomName && project.rooms.length > 1 ? `<span>· ${esc(it.roomName)}</span>` : ''}${it.note ? `<span>· ${esc(it.note)}</span>` : ''}</div></div><div class="amt">${lineAmount(it, fmtMoney(lineTotal(it)))}</div></div>`));
  }
  root.append(li);

  // ---- how this bid is priced
  const reg = regionFor(s); const a = est.adj; a.method = a.method || 'markup'; const prof = profileOf(s);
  const ps = h('div', { class: 'card' }, el(`<div class="card-title"><h3>How this bid is priced</h3><button class="btn xs neutral" data-act="pricing">Your defaults</button></div>`));
  ps.append(segEl([{ value: 'markup', label: 'Markup' }, { value: 'margin', label: 'Margin' }, { value: 'rate', label: 'Hourly' }], a.method === 'stack' ? 'markup' : a.method, (v) => { a.method = v; if (v === 'margin' && !a.targetMargin) a.targetMargin = prof.targetMargin; if (v === 'rate' && !a.billRate) a.billRate = prof.billRate; commit(); renderEstimate(root, { navigate }); }));
  const pctF = (k, label, unit = '%', step = 0.5) => el(`<div class="field"><label>${label}</label><div class="unit-input"><input type="number" step="${step}" min="0" data-adj="${k}" value="${a[k] ?? 0}" inputmode="decimal"><span>${unit}</span></div></div>`);
  if (a.method === 'margin') ps.append(el(`<p class="dim small mt8">Price = cost ÷ (1 − margin). ${a.targetMargin || 0}% margin = ${pctf(markupFromMargin(Number(a.targetMargin) || 0))} markup on cost.</p>`), h('div', { class: 'inline-fields' }, pctF('targetMargin', 'Target gross margin'), pctF('contingency', 'Contingency')));
  else if (a.method === 'rate') ps.append(el(`<p class="dim small mt8">Labor billed by the hour; materials marked up.</p>`), h('div', { class: 'inline-fields three' }, pctF('billRate', 'Billable rate', '$/hr', 1), pctF('materialMarkup', 'Material markup'), pctF('contingency', 'Contingency')));
  else ps.append(h('div', { class: 'inline-fields three' }, pctF('materialMarkup', 'Material markup'), pctF('laborMarkup', 'Labor markup'), pctF('overhead', 'Overhead')), h('div', { class: 'inline-fields' }, pctF('profit', 'Profit'), pctF('contingency', 'Contingency')));
  ps.append(h('div', { class: 'inline-fields three' }, pctF('taxRate', 'Sales tax'), pctF('depositPct', 'Deposit'), pctF('discount', 'Discount', '$', 1)), h('div', { class: 'inline-fields three' }, pctF('minJob', 'Minimum job', '$', 25), pctF('tripFee', 'Trip fee', '$', 5), pctF('rounding', 'Round up to', '$', 5)));
  const r1 = h('div', { class: 'row between mt12' }, el(`<div><b>Tax materials only</b><div class="dim small">Most states tax materials, not labor</div></div>`)); r1.append(switchEl(a.taxMaterialsOnly !== false, (v) => { a.taxMaterialsOnly = v; commit(); refreshTotals(); })); ps.append(r1);
  const r2 = h('div', { class: 'row between mt12' }, el(`<div><b>Blend markup into line prices</b><div class="dim small">Client sees sell prices; markup rows hidden on the PDF</div></div>`)); r2.append(switchEl(a.inlineMarkup !== false, (v) => { a.inlineMarkup = v; commit(); })); ps.append(r2);
  ps.append(el(`<p class="dim tiny mt8">Region ${esc(reg.label)} · materials ×${reg.material.toFixed(2)} · labor ${prof.useOwnRates ? 'at your own rates' : `×${reg.labor.toFixed(2)}`}</p>`));
  root.append(ps);
  ps.addEventListener('change', (e) => { const k = e.target.dataset.adj; if (!k) return; a[k] = Number(e.target.value) || 0; commit(); refreshTotals(); });

  // ---- totals + your numbers
  const tot = h('div', { class: 'card totals' }); root.append(tot);
  const mine = h('div', { class: 'card' }); const mineBody = h('div'); const fixRow = el(`<div class="warnbox hidden" data-role="fixrow"><span data-role="fixmsg"></span> <button class="btn xs" data-act="fix-margin" style="margin-left:6px"></button></div>`); const mineNote = h('div'); mine.append(mineBody, fixRow, mineNote); root.append(mine);
  const refreshTotals = () => { const T = totals(est); const plan = jobPlan(project, s);
    tot.innerHTML = `<div class="card-title"><h3>Bid total</h3><span class="dim small">${sf ? fmtMoney(T.total / sf) + ' / sf' : ''}</span></div>
    <div class="trow sub"><span>Materials</span><span>${fmtMoney(T.materials)}</span></div><div class="trow sub"><span>Labor (${fmtNum(T.laborHours, 1)} hrs)</span><span>${fmtMoney(T.labor)}</span></div><div class="trow sub"><span>Fees & pass-throughs</span><span>${fmtMoney(T.fees)}</span></div>${T.work ? `<div class="trow sub"><span>Priced work (your bid's prices, no markup)</span><span>${fmtMoney(T.work)}</span></div>` : ''}${T.orderCost ? `<div class="trow sub"><span>Order list (your cost, not in the price)</span><span>${fmtMoney(T.orderCost)}</span></div>` : ''}
    <div class="trow sub"><span>${esc(METHOD_LABELS[T.method] || 'Markup, overhead & profit')}</span><span>${fmtMoney(T.markupTotal - T.contingency - T.adjustment)}</span></div>
    ${T.contingency ? `<div class="trow sub"><span>Contingency</span><span>${fmtMoney(T.contingency)}</span></div>` : ''}${T.discount ? `<div class="trow sub"><span>Discount</span><span>−${fmtMoney(T.discount)}</span></div>` : ''}${Math.abs(T.adjustment) > 0.004 ? `<div class="trow sub"><span>${T.minApplied ? 'Minimum job charge' : 'Trip fee & rounding'}</span><span>${fmtMoney(T.adjustment)}</span></div>` : ''}
    <div class="trow"><span>Subtotal</span><span>${fmtMoney(T.preTax)}</span></div><div class="trow sub"><span>Tax ${a.taxRate || 0}%${a.taxMaterialsOnly !== false ? ' (materials)' : ''}</span><span>${fmtMoney(T.tax)}</span></div>
    <div class="trow grand"><span>Total</span><span>${fmtMoney(T.total)}</span></div><div class="trow sub"><span>Deposit due at acceptance (${a.depositPct || 0}%)</span><span>${fmtMoney(T.deposit)}</span></div>`;
    const target = a.method === 'margin' ? Number(a.targetMargin) || prof.targetMargin : prof.targetMargin; const needNet = Number(a.targetNetPct ?? prof.targetNetPct) || 0; const low = T.cost > 0 && !T.work && T.grossMargin + 0.05 < target; const fixPrice = T.cost / (1 - target / 100);
    mineBody.innerHTML = `<div class="card-title"><h3>Your numbers</h3><span class="dim small">not shown to the client</span></div><div class="kpi"><div class="stat"><div class="v">${money0(T.jobCost)}</div><div class="k">your cost</div></div><div class="stat"><div class="v">${money0(T.grossProfit)}</div><div class="k">gross profit</div></div><div class="stat"><div class="v">${pctf(T.grossMargin)}</div><div class="k">margin · ${pctf(T.markupOnCost, 0)} markup</div></div><div class="stat"><div class="v">${money0(T.net)}</div><div class="k">net after ${pctf(Number(a.overheadPct ?? a.overhead) || 0, 0)} overhead</div></div><div class="stat"><div class="v">${fmtNum(T.laborHours, 1)} h</div><div class="k">labor · ${plan.crewDays} crew-day${plan.crewDays === 1 ? '' : 's'} (${plan.crewSize})</div></div><div class="stat"><div class="v">${plan.suppliers.length}</div><div class="k">supplier${plan.suppliers.length === 1 ? '' : 's'}</div></div></div>`;
    fixRow.classList.toggle('hidden', !low); if (low) { $('[data-role="fixmsg"]', fixRow).innerHTML = `${icons.warn} <b>Underpriced.</b> This bid makes a ${pctf(T.grossMargin)} margin; your target is ${pctf(target, 0)}. You would need ${money0(fixPrice)} before tax (+${money0(fixPrice - T.preTax)}).`; $('button', fixRow).textContent = `Price at ${target}%`; }
    mineNote.innerHTML = low ? '' : T.jobCost > 0 && T.netPct + 0.05 < needNet ? `<div class="warnbox">${icons.warn} Net after overhead is ${pctf(T.netPct)} — below your ${pctf(needNet, 0)} goal.</div>` : T.jobCost > 0 ? `<div class="okbox">${icons.check} On target: ${pctf(T.grossMargin)} margin${needNet ? `, ${pctf(T.netPct)} net` : ''}.</div>` : ''; };
  refreshTotals();

  // ---- good / better / best
  const tiersCard = h('div', { class: 'card' }); root.append(tiersCard);
  if (est.tiers && est.tiers.on) { const sum = tierSummary(project, s); const adds = addonPrices(project, s);
    tiersCard.append(el(`<div class="card-title"><h3>Good · Better · Best</h3><div class="row" style="gap:6px"><button class="btn xs neutral" data-act="tiers-regen">Rebuild</button><button class="btn xs danger" data-act="tiers-off">Off</button></div></div>`));
    const row = h('div', { class: 'tier-row' }); for (const t of sum) row.append(el(`<button class="tier ${t.key === 'better' ? 'pop' : ''}" data-act="tier-name" data-k="${t.key}"><div class="n">${esc(t.name)}</div><div class="v">${money0(t.total)}</div><div class="dim tiny">${pctf(t.grossMargin, 0)} margin</div></button>`)); tiersCard.append(row);
    for (const t of sum.filter((x) => x.diffs.length)) tiersCard.append(el(`<div class="dim small mt8"><b>${esc(t.name)}:</b> ${t.diffs.map(esc).join(' · ')}</div>`));
    if (sum[0].total === sum[2].total) tiersCard.append(el(`<p class="dim small mt8">Add work items or products with a grade (flooring, shingles, fixtures…) so the tiers differ.</p>`));
    tiersCard.append(el(`<div class="group-head" style="margin-top:12px"><span>Optional add-ons the client can tick</span><button class="btn xs secondary" data-act="addon-add">${icons.plus} Add</button></div>`));
    if (!adds.length) tiersCard.append(el(`<p class="dim small">None yet — suggested: ${upsells(project).slice(0, 3).map((u) => esc(u.name)).join(', ') || 'crown molding, final cleanup'}.</p>`));
    for (const ad of adds) tiersCard.append(el(`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(ad.label)}</span><div class="row" style="gap:8px"><b class="mono">+${money0(ad.price)}</b><button class="btn xs danger" data-act="addon-del" data-key="${ad.key}">${icons.x}</button></div></div>`)); }
  else tiersCard.append(el(`<div class="row between"><div><b>Offer Good · Better · Best</b><div class="dim small">Clients choose more often when they get options — and often pick the middle or top.</div></div><button class="btn sm" data-act="tiers-on">Create</button></div>`));

  // ---- materials by supplier
  const groupsS = groupBySupplier(est.items, s);
  if (groupsS.length) { const ms = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Materials by supplier</h3><button class="btn xs secondary" data-act="order">${icons.doc} Order lists</button></div>`));
    for (const g of groupsS) ms.append(el(`<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${esc(g.supplier.name)}</b><div class="dim small">${g.lines.length} item${g.lines.length === 1 ? '' : 's'}${g.lines.some((l) => l.priceSource === 'price list') ? ' · your price list' : ''}${g.lines.some((l) => l.priceSource === 'live') ? ' · live prices' : ''}</div></div><b class="mono">${money0(g.subtotal)}</b></div>`));
    root.append(ms); }

  // ---- change orders
  const L = ledger(project); const cos = project.changeOrders || [];
  const coCard = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Change orders</h3><button class="btn xs secondary" data-act="co-new">${icons.plus} New</button></div>`));
  if (!cos.length) coCard.append(el(`<p class="dim small">Hidden rot, an extra outlet, a client upgrade? Add a change order: snap a photo, price the change, and get it signed — the contract total updates itself.</p>`));
  for (const co of cos) { const ct = coTotals(co, est); coCard.append(el(`<button class="item" data-act="co-open" data-id="${co.id}" style="text-align:left;width:100%;display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><div class="grow"><b>CO #${co.n} · ${esc(co.title || 'Untitled')}</b><div class="dim small">${co.items.length} line${co.items.length === 1 ? '' : 's'}${co.scheduleDays ? ` · +${co.scheduleDays} day${co.scheduleDays === 1 ? '' : 's'}` : ''}</div></div><span class="pill ${co.status === 'approved' ? 'signed' : co.status === 'declined' ? 'draft' : co.status === 'sent' ? 'sent' : 'draft'}">${esc(co.status)}</span><b class="mono">${ct.total >= 0 ? '' : '−'}${money0(Math.abs(ct.total))}</b></button>`)); }
  if (cos.length || Number.isFinite(est.signedTotal)) coCard.append(el(`<div class="totals mt8"><div class="trow sub"><span>Original contract</span><span>${fmtMoney(L.original)}</span></div><div class="trow sub"><span>Approved change orders</span><span>${fmtMoney(L.approved)}</span></div>${L.pending ? `<div class="trow sub"><span>Pending</span><span>${fmtMoney(L.pending)}</span></div>` : ''}<div class="trow"><b>Revised contract</b><b>${fmtMoney(L.revised)}</b></div></div>`));
  root.append(coCard);

  // ---- photos
  const ph = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Job-site photos</h3><label class="btn xs secondary">${icons.camera} Add<input type="file" accept="image/*" capture="environment" multiple hidden data-act="photo"></label></div>`));
  if (project.photos.length) { const grid = h('div', { class: 'doc photos', style: { padding: 0, boxShadow: 'none', background: 'transparent' } }); project.photos.forEach((p, i) => grid.append(el(`<div style="position:relative"><img src="${p}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px"><button class="btn xs danger" data-act="del-photo" data-i="${i}" style="position:absolute;top:4px;right:4px">${icons.x}</button></div>`))); ph.append(grid); } else ph.append(el(`<p class="dim small">Photos print on the estimate and help justify the scope.</p>`));
  root.append(ph);
  ph.addEventListener('change', async (e) => { if (e.target.dataset.act !== 'photo') return; for (const f of e.target.files) project.photos.push(await readFileAsDataURL(f, 1200)); commit(); renderEstimate(root, { navigate }); });

  // ---- footer actions
  root.append(el(`<div class="btn-grid mt12"><button class="btn secondary" data-act="plan">${icons.layers} Job plan</button><button class="btn secondary" data-act="order">${icons.doc} Material orders</button><button class="btn secondary" data-act="csv">${icons.download} Takeoff CSV</button><button class="btn secondary" data-act="qbo">${icons.download} QuickBooks CSV</button><button class="btn neutral" data-act="dup">${icons.copy} Duplicate job</button></div>`));

  // ---- handlers
  bind(root, 'click', async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return; const act = btn.dataset.act;
    const rerender = () => renderEstimate(root, { navigate });
    if (act === 'rename') { const v = await promptDialog('Project name', { value: project.name }); if (v) { project.name = v.trim() || project.name; commit('project'); rerender(); } }
    if (act === 'client') { editClient(project).then((ok) => ok && rerender()); }
    if (act === 'preview') openDocument(project, { mode: est.invoice ? 'invoice' : 'estimate', onChange: rerender });
    if (act === 'more') projectMenu(project, { navigate, rerender });
    if (act === 'build') { est.scopeText = ta.value; const parsed = parseScope(ta.value); if (!parsed.matched) return toast('Could not recognize any work items — try words like paint, LVP, baseboard, drywall, recessed lights'); const have = new Map(est.assemblies.map((x) => [x.key, x])); for (const p of parsed.assemblies) { if (have.has(p.key)) have.get(p.key).opts = { ...have.get(p.key).opts, ...p.opts }; else est.assemblies.push(p); } recompute(project, s); commit(); toast(`${parsed.matched} work item${parsed.matched === 1 ? '' : 's'} recognized`); rerender(); }
    if (act === 'ai') { if (!aiStatus(s).ready) { sheet({ title: 'Turn on AI assist', body: `<p class="muted">AI assist reads your job-site photos, the description and the measured rooms, then drafts the work items, custom lines, a client-ready scope and risk flags.</p><p class="muted mt8">It runs on your own Anthropic API key (stored only on this device) or on a server endpoint you control. Set either in <b>Settings → AI assist</b>.</p>`, actions: [{ label: 'Open Settings', onClick: () => navigate('settings') }, { label: 'Not now', cls: 'neutral' }] }); return; }
      est.scopeText = ta.value; btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = `${icons.sparkle} Analyzing…`; toast('Sending to Claude…', 4000);
      try { const result = await runAI({ project, settings: s, onProgress: (m) => toast(m, 6000) }); applyAIResult(project, s, result); toast(`AI added ${result.assemblies.length} work item${result.assemblies.length === 1 ? '' : 's'}, ${result.customItems.length} custom line${result.customItems.length === 1 ? '' : 's'}${result.cost != null ? ` · ≈ ${fmtMoney(result.cost)}` : ''}`, 5000); rerender(); }
      catch (err) { console.warn('AI failed', err); toast(err && err.message ? err.message : 'AI analysis failed', 5000); btn.disabled = false; btn.innerHTML = label; if (err && err.code === 'not_configured') navigate('settings'); } }
    if (act === 'ai-clear') { delete est.ai; commit(); rerender(); }
    if (act === 'bundles') { const b = h('div', { class: 'list' }); for (const bd of BUNDLES) b.append(el(`<button class="item" data-bundle="${bd.key}" style="text-align:left;width:100%"><div class="lead">${icons.layers}</div><div class="grow"><b>${esc(bd.name)}</b><div class="dim small">${esc(bd.desc)}</div></div><span class="chev">${icons.chevron}</span></button>`)); const sh = sheet({ title: 'Scope bundles', subtitle: 'Adds the usual work items for the job type. You can remove any afterwards.', body: b }); b.addEventListener('click', (ev) => { const k = ev.target.closest('[data-bundle]')?.dataset.bundle; if (!k) return; const bd = BUNDLES.find((x) => x.key === k); const have = new Set(est.assemblies.map((x) => x.key)); for (const key of bd.assemblies) if (!have.has(key)) est.assemblies.push({ key, opts: {} }); recompute(project, s); commit(); sh.close(); rerender(); }); }
    if (act === 'add-asm') { addAssemblySheet(est, () => { recompute(project, s); commit(); rerender(); }); }
    if (act === 'add-key') { const key = btn.dataset.key; if (!est.assemblies.some((x) => x.key === key)) est.assemblies.push({ key, opts: {} }); recompute(project, s); commit(); rerender(); }
    if (act === 'go') navigate(btn.dataset.go);
    if (act === 'asm-opts') { assemblyOptionsSheet(project, btn.dataset.key, () => { recompute(project, s); commit(); rerender(); }); }
    if (act === 'edit-line') { const it = est.items.find((x) => x.id === btn.dataset.id); if (it) editLineSheet(est, it, () => { commit(); rerender(); }); }
    if (act === 'add-custom') { customLineSheet(est, () => { commit(); rerender(); }); }
    if (act === 'del-photo') { project.photos.splice(+btn.dataset.i, 1); commit(); rerender(); }
    if (act === 'csv') download(`${est.number}-takeoff.csv`, toCSV(project), 'text/csv');
    if (act === 'dup') { const c = store.duplicateProject(project.id); toast(`Created ${c.estimate.number} from ${est.number}`); rerender(); }
    if (act === 'qbo') download(`${est.invoice ? est.invoice.number : est.number}-quickbooks.csv`, quickBooksCSV(project), 'text/csv');
    if (act === 'plan') openJobPlan(project);
    if (act === 'order') openMaterialOrder(project);
    if (act === 'pricing') openPricingPanel({ onDone: () => { if (!Number.isFinite(est.signedTotal)) { est.adj = adjFromProfile(s, est.adj); recompute(project, s); commit(); } rerender(); } });
    if (act === 'fix-margin') { const target = est.adj.method === 'margin' ? Number(est.adj.targetMargin) || profileOf(s).targetMargin : profileOf(s).targetMargin; est.adj.method = 'margin'; est.adj.targetMargin = target; commit(); toast(`Priced at a ${target}% margin`); rerender(); }
    if (act === 'prod') { const inst = (est.products || []).find((x) => x.id === btn.dataset.id); if (inst) openConfigurator(structuredClone(inst), { isNew: false, onDone: rerender, navigate }); }
    if (act === 'tiers-on' || act === 'tiers-regen') { est.tiers = generateTiers(project); if (!est.tiers.addons.length) est.tiers.addons = upsells(project).slice(0, 2).map((u) => ({ key: u.key, label: u.name })); commit(); toast('Good · Better · Best created from your scope'); rerender(); }
    if (act === 'tiers-off') { if (est.tiers) est.tiers.on = false; commit(); rerender(); }
    if (act === 'tier-name') { const k = btn.dataset.k; const v = await promptDialog('Name this option', { value: est.tiers.names[k], hint: 'e.g. Essential / Signature / Premier' }); if (v) { est.tiers.names[k] = v.trim(); commit(); rerender(); } }
    if (act === 'addon-del') { est.tiers.addons = est.tiers.addons.filter((x) => x.key !== btn.dataset.key); commit(); rerender(); }
    if (act === 'addon-add') { const have = new Set([...est.assemblies.map((x) => x.key), ...est.tiers.addons.map((x) => x.key)]); const b = h('div', { class: 'chips' }); for (const asm2 of ASSEMBLIES.filter((x) => !have.has(x.key))) b.append(el(`<button class="chip" data-k="${asm2.key}">${icons.plus} ${esc(asm2.name)}</button>`)); const sh = sheet({ title: 'Add an optional add-on', subtitle: 'Priced on top of whichever option the client picks.', body: b }); b.addEventListener('click', (ev) => { const k = ev.target.closest('[data-k]')?.dataset.k; if (!k) return; est.tiers.addons.push({ key: k, label: ASSEMBLY_MAP[k].name }); commit(); sh.close(); rerender(); }); }
    if (act === 'co-new') openChangeOrder(project, null, { onDone: rerender });
    if (act === 'co-open') openChangeOrder(project, btn.dataset.id, { onDone: rerender });
  });
}

export function editClient(project) {
  return new Promise((resolve) => {
    const c = project.client; const body = el(`<div><div class="field"><label>Client name</label><input data-f="name" type="text" value="${esc(c.name)}" autocomplete="name"></div><div class="field"><label>Job address</label><input data-f="address" type="text" value="${esc(c.address)}" autocomplete="street-address"></div><div class="inline-fields"><div class="field"><label>Phone</label><input data-f="phone" type="tel" value="${esc(c.phone)}"></div><div class="field"><label>Email</label><input data-f="email" type="email" value="${esc(c.email)}"></div></div><div class="field"><label>Project name</label><input data-f="pname" type="text" value="${esc(project.name)}"></div><div class="field"><label>Folder / tag</label><input data-f="folder" type="text" value="${esc(project.folder || '')}" placeholder="e.g. Repaints, Smith residence, Q4"></div></div>`);
    sheet({ title: 'Client & project', body, onClose: (r) => resolve(!!r), actions: [{ label: 'Save', onClick: () => { for (const k of ['name', 'address', 'phone', 'email']) c[k] = $(`[data-f="${k}"]`, body).value.trim(); project.name = $('[data-f="pname"]', body).value.trim() || project.name; project.folder = $('[data-f="folder"]', body).value.trim(); commit('project'); return true; } }, { label: 'Cancel', cls: 'neutral', onClick: () => false }] });
  });
}

function projectMenu(project, { navigate, rerender }) {
  const body = h('div', { class: 'list' });
  const opt = (icon, label, act, cls = '') => body.append(el(`<button class="item ${cls}" data-m="${act}" style="text-align:left;width:100%"><div class="lead">${icon}</div><div class="grow"><b>${label}</b></div></button>`));
  opt(icons.doc, 'Preview estimate', 'preview'); opt(icons.invoice, project.estimate.invoice ? 'Open invoice' : 'Convert to invoice', 'invoice'); opt(icons.copy, 'Duplicate as change order', 'dup'); opt(icons.cube, 'Open 3D model', 'model'); opt(icons.scan, 'Add a room', 'scan');
  body.append(el(`<div class="field"><label>Status</label></div>`)); body.lastChild.append(segEl(['draft', 'sent', 'signed', 'invoiced', 'paid'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })), project.status || 'draft', (v) => { project.status = v; commit('project'); }));
  opt(icons.trash, 'Delete project', 'delete', 'danger');
  const sh = sheet({ title: project.name, body });
  body.addEventListener('click', async (e) => { const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; sh.close();
    if (m === 'preview') openDocument(project, { mode: 'estimate', onChange: rerender }); if (m === 'invoice') openDocument(project, { mode: 'invoice', onChange: rerender }); if (m === 'dup') { store.duplicateProject(project.id); rerender(); } if (m === 'model') navigate('model'); if (m === 'scan') navigate('scan');
    if (m === 'delete' && (await confirmDialog(`Delete “${project.name}” and all its rooms and estimates?`, { okLabel: 'Delete', danger: true }))) { store.deleteProject(project.id); rerender(); } });
  sh.el.addEventListener('click', () => {}, { once: true }); setTimeout(rerender, 400);
}

function addAssemblySheet(est, done) {
  const have = new Set(est.assemblies.map((x) => x.key)); const body = h('div');
  const search = el(`<input type="search" placeholder="Search work items…" class="mt8">`); body.append(search); const lists = h('div'); body.append(lists);
  const render = (q = '') => { lists.innerHTML = ''; for (const trade of TRADES) { const items = ASSEMBLIES.filter((a) => a.trade === trade && (!q || (a.name + ' ' + a.keywords.join(' ')).toLowerCase().includes(q))); if (!items.length) continue; lists.append(el(`<div class="group-head">${trade}</div>`)); const ch = h('div', { class: 'chips' }); for (const a of items) ch.append(el(`<button class="chip ${have.has(a.key) ? 'on' : ''}" data-key="${a.key}">${have.has(a.key) ? icons.check : icons.plus} ${esc(a.name)}</button>`)); lists.append(ch); } };
  render(); search.addEventListener('input', () => render(search.value.toLowerCase().trim()));
  lists.addEventListener('click', (e) => { const k = e.target.closest('[data-key]')?.dataset.key; if (!k) return; if (have.has(k)) { have.delete(k); est.assemblies = est.assemblies.filter((x) => x.key !== k); } else { have.add(k); est.assemblies.push({ key: k, opts: {} }); } render(search.value.toLowerCase().trim()); });
  sheet({ title: 'Add work items', subtitle: 'Tap to toggle. Quantities come from the room geometry.', body, onClose: done, actions: [{ label: 'Done', onClick: () => true }] });
}

function assemblyOptionsSheet(project, key, done) {
  const est = project.estimate; const sel = est.assemblies.find((x) => x.key === key); const def = ASSEMBLY_MAP[key]; if (!sel || !def) return;
  const body = h('div'); const opts = sel.opts || (sel.opts = {});
  for (const o of def.options || []) {
    if (o.type === 'select') { const f = el(`<div class="field"><label>${esc(o.label)}</label><select data-opt="${o.key}">${o.values.map((v) => `<option value="${esc(String(v.v))}" ${String(opts[o.key] ?? o.default) === String(v.v) ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>`); f.addEventListener('change', (e) => { const raw = e.target.value; const match = o.values.find((v) => String(v.v) === raw); opts[o.key] = match ? match.v : raw; }); body.append(f); }
    else if (o.type === 'number') { const f = el(`<div class="field"><label>${esc(o.label)}</label><input type="number" inputmode="decimal" data-opt="${o.key}" value="${opts[o.key] ?? (o.default ?? '')}" placeholder="${o.default == null ? 'auto' : o.default}">${o.hint ? `<div class="dim tiny">${esc(o.hint)}</div>` : ''}</div>`); f.addEventListener('change', (e) => { opts[o.key] = e.target.value === '' ? null : Number(e.target.value); }); body.append(f); }
    else if (o.type === 'bool') { const row = h('div', { class: 'row between mt12' }, el(`<b>${esc(o.label)}</b>`)); row.append(switchEl(opts[o.key] ?? o.default, (v) => { opts[o.key] = v; })); body.append(row); }
  }
  if (!(def.options || []).length) body.append(el(`<p class="dim small">No options — quantities are derived from the room.</p>`));
  if (project.rooms.length > 1 && def.scope !== 'project') { body.append(el(`<div class="group-head">Apply to rooms</div>`)); const ch = h('div', { class: 'chips' }); for (const r of project.rooms) { const on = !sel.roomIds || sel.roomIds.includes(r.id); const c = el(`<button class="chip ${on ? 'on' : ''}">${esc(r.name)}</button>`); c.addEventListener('click', () => { const cur = new Set(sel.roomIds || project.rooms.map((x) => x.id)); if (cur.has(r.id)) cur.delete(r.id); else cur.add(r.id); sel.roomIds = cur.size === project.rooms.length ? null : [...cur]; c.classList.toggle('on'); }); ch.append(c); } body.append(ch); }
  body.append(el(`<p class="dim tiny mt12">Matches: ${esc(def.keywords.slice(0, 6).join(', '))}</p>`));
  sheet({ title: def.name, subtitle: def.trade, body, onClose: done, actions: [{ label: 'Apply', onClick: () => true }, { label: 'Remove from estimate', cls: 'danger', onClick: () => { est.assemblies = est.assemblies.filter((x) => x.key !== key); return true; } }] });
}

function editLineSheet(est, it, done) {
  const body = el(`<div><div class="field"><label>Item</label><input data-f="name" type="text" value="${esc(it.name)}"></div><div class="inline-fields three"><div class="field"><label>Qty</label><input data-f="qty" type="number" step="0.01" inputmode="decimal" value="${it.qty}"></div><div class="field"><label>Unit</label><select data-f="unit">${UNITS.map((u) => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label>Unit cost</label><input data-f="unitCost" type="number" step="0.01" inputmode="decimal" value="${it.unitCost ?? ''}" placeholder="Needs a price"></div></div><div class="field"><label>Type</label></div><div class="field"><label>Note</label><input data-f="note" type="text" value="${esc(it.note || '')}"></div>${it.cat === 'material' ? `<div class="field"><label>Supplier</label><select data-f="supplier">${suppliersOf(store.settings).map((x) => `<option value="${x.id}" ${x.id === it.supplierId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}${it.priceSource ? `<p class="dim tiny">Price source: ${esc(it.priceSource)}${it.priceUrl ? ` · <a href="${esc(it.priceUrl)}" target="_blank" rel="noopener">source</a>` : ''}${it.baseCost && it.baseCost !== it.unitCost ? ` · national base ${fmtMoney(it.baseCost)}` : ''}</p>` : ''}</div>`);
  let cat = it.cat; $$('.field', body)[3].append(segEl([{ value: 'material', label: 'Material' }, { value: 'labor', label: 'Labor' }, { value: 'fee', label: 'Fee' }], cat, (v) => (cat = v)));
  sheet({ title: 'Edit line', subtitle: it.assemblyName + (it.roomName ? ` · ${it.roomName}` : ''), body, onClose: done, actions: [
    { label: 'Change supplier only', cls: 'neutral', onClick: () => { const sel = $('[data-f="supplier"]', body); if (sel) { it.supplierId = sel.value; it.supplierPinned = true; recompute(store.activeProject(), store.settings); } return true; } },
    { label: 'Save', onClick: () => { const sel = $('[data-f="supplier"]', body); if (sel && sel.value !== it.supplierId) { it.supplierId = sel.value; it.supplierPinned = true; } const before = { name: it.name, qty: it.qty, unit: it.unit, unitCost: it.unitCost }; const rawCost = $('[data-f="unitCost"]', body).value; it.name = $('[data-f="name"]', body).value.trim() || it.name; it.qty = Number($('[data-f="qty"]', body).value) || 0; it.unit = $('[data-f="unit"]', body).value; it.note = $('[data-f="note"]', body).value.trim();
      if (it.origin === 'cvs') { saveCvsLineEdit(store.activeProject(), it, before, rawCost); return true; }
      it.unitCost = Number(rawCost) || 0; it.cat = cat; it.taxable = cat === 'material'; it.locked = true; return true; } },
    { label: 'Reset to calculated', cls: 'neutral', onClick: () => { it.locked = false; return true; } },
    { label: 'Remove line', cls: 'danger', onClick: () => { est.items = est.items.filter((x) => x.id !== it.id); if (!it.custom) (est.removedKeys || (est.removedKeys = [])).push(it.key); return true; } },
  ] });
}

function customLineSheet(est, done) {
  const body = el(`<div><div class="chips" data-role="lib"></div><div class="field"><label>Item</label><input data-f="name" type="text" placeholder="e.g. Haul-away of old appliances"></div><div class="inline-fields three"><div class="field"><label>Qty</label><input data-f="qty" type="number" step="0.01" inputmode="decimal" value="1"></div><div class="field"><label>Unit</label><select data-f="unit">${UNITS.map((u) => `<option ${u === 'ea' ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label>Unit cost</label><input data-f="unitCost" type="number" step="0.01" inputmode="decimal" value="0"></div></div><div class="field"><label>Type</label></div></div>`);
  let cat = 'material'; const seg = segEl([{ value: 'material', label: 'Material' }, { value: 'labor', label: 'Labor' }, { value: 'fee', label: 'Fee' }], cat, (v) => (cat = v)); $$('.field', body)[3].append(seg);
  const lib = $('[data-role="lib"]', body); for (const L of ITEM_LIBRARY) { const c = el(`<button class="chip">${esc(L.name)}</button>`); c.addEventListener('click', () => { $('[data-f="name"]', body).value = L.name; $('[data-f="unit"]', body).value = L.unit; $('[data-f="unitCost"]', body).value = L.unitCost; cat = L.cat; $$('button', seg).forEach((b) => b.classList.toggle('active', b.textContent.toLowerCase() === cat)); }); lib.append(c); }
  sheet({ title: 'Custom line item', body, onClose: done, actions: [{ label: 'Add', onClick: () => { const name = $('[data-f="name"]', body).value.trim(); if (!name) { toast('Name the item'); return false; } est.items.push(customItem({ name, cat, unit: $('[data-f="unit"]', body).value, qty: Number($('[data-f="qty"]', body).value) || 1, unitCost: Number($('[data-f="unitCost"]', body).value) || 0 })); return true; } }, { label: 'Cancel', cls: 'neutral', onClick: () => false }] });
}


/** Merge an AI result into the estimate: assemblies (options merged), custom lines (deduped by name), scope text, review notes. */
export function applyAIResult(project, settings, result) {
  const est = project.estimate;
  if (result.scopeText) { if (est.scopeText && est.scopeText.trim() && est.scopeText.trim() !== result.scopeText.trim()) est.scopeTextOriginal = est.scopeText; est.scopeText = result.scopeText; }
  const have = new Map(est.assemblies.map((a) => [a.key, a]));
  for (const a of result.assemblies || []) { if (have.has(a.key)) have.get(a.key).opts = { ...(have.get(a.key).opts || {}), ...a.opts }; else { est.assemblies.push({ key: a.key, opts: a.opts || {} }); have.set(a.key, est.assemblies[est.assemblies.length - 1]); } }
  for (const c of result.customItems || []) if (!est.items.some((i) => i.custom && i.name === c.name)) est.items.push(customItem({ name: c.name, cat: c.cat, unit: c.unit, qty: c.qty, unitCost: c.unitCost, note: c.note }));
  est.ai = { flags: result.flags || [], assumptions: result.assumptions || [], upsells: result.upsells || [], confidence: result.confidence || 'medium', provider: result.provider, model: result.model, cost: result.cost, usage: result.usage, at: result.at || new Date().toISOString() };
  recompute(project, settings); commit();
  return est;
}

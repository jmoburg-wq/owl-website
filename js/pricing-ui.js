// "How you price" — the contractor's pricing profile, with the math shown live.
import { store } from './store.js';
import { profileOf, DEFAULT_PROFILE, TRADES, METHOD_LABELS, markupFromMargin, marginFromMarkup, priceFromMargin, burdenedRate, overheadPctOf, requiredMargin, billRateFor, breakEvenRevenue, LABOR_BASE } from './pricing/profile.js';
import { totals } from './pricing/estimator.js';
import { el, h, $, $$, toast, panel, icons, esc, segEl, switchEl, fmtMoney, money0, pct } from './ui.js';

const SAMPLE = { materials: 6000, labor: 4000, hours: 4000 / LABOR_BASE };

/** Price a sample $10k-cost job with a set of adjustments (used for the live preview). */
function sampleTotals(adj) { return totals({ items: [{ cat: 'material', qty: 1, unitCost: SAMPLE.materials }, { cat: 'labor', qty: SAMPLE.hours, unit: 'hr', unitCost: LABOR_BASE, hours: SAMPLE.hours }], adj: { ...adj, taxRate: 0, discount: 0, contingency: 0, minJob: 0, tripFee: 0 } }); }

export function adjFromProfile(settings, base = {}) {
  const p = profileOf(settings); const d = settings.defaults;
  return { ...base, method: p.method, targetMargin: p.targetMargin, billRate: p.billRate, overheadPct: p.overheadPct, targetNetPct: p.targetNetPct, minJob: p.minJob, tripFee: p.tripFee, rounding: p.rounding, materialMarkup: d.materialMarkup, laborMarkup: d.laborMarkup, overhead: d.overhead, profit: d.profit, depositPct: d.depositPct, taxRate: base.taxRate ?? d.taxRate, taxMaterialsOnly: base.taxMaterialsOnly ?? d.taxMaterialsOnly };
}

export function openPricingPanel({ onDone } = {}) {
  const s = store.settings; s.profile = profileOf(s); const p = s.profile; const d = s.defaults;
  const pn = panel({ title: 'How you price', action: { label: 'Save', onClick: () => { p.setupDone = true; store.update(() => {}, 'settings'); toast('Pricing saved — new bids use it'); return true; } }, onClose: () => onDone && onDone() });
  const B = pn.body; const save = () => store.update(() => {}, 'settings');
  const num = (obj, k, label, { unit = '', step = 1, hint = '' } = {}) => { const f = el(`<div class="field"><label>${esc(label)}</label><div class="unit-input"><input type="number" inputmode="decimal" step="${step}" value="${obj[k] ?? ''}"><span>${esc(unit)}</span></div>${hint ? `<div class="dim tiny">${esc(hint)}</div>` : ''}</div>`); $('input', f).addEventListener('input', (e) => { obj[k] = e.target.value === '' ? 0 : Number(e.target.value); save(); refresh(); }); return f; };

  B.append(el(`<p class="muted small mt8">Tell Fullbid how your business makes money. Every bid then lands on the price <b>you</b> would charge — not a generic markup — and warns you before you underbid.</p>`));

  // 1) method
  const m = h('div', { class: 'card' }, el(`<div class="card-title"><h3>1 · Pricing method</h3></div>`));
  m.append(segEl(Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label: label.split(' ')[0] === 'Target' ? 'Margin' : label.split(' ')[0] === 'Billable' ? 'Hourly' : 'Markup' })), p.method, (v) => { p.method = v; save(); drawMethod(); refresh(); }));
  const methodBox = h('div'); m.append(methodBox);
  const drawMethod = () => { methodBox.innerHTML = '';
    if (p.method === 'margin') { methodBox.append(el(`<p class="dim small mt8">Price = cost ÷ (1 − margin). The margin you set is the margin you keep. Recommended.</p>`), num(p, 'targetMargin', 'Target gross margin', { unit: '%', step: 0.5 })); }
    else if (p.method === 'rate') { methodBox.append(el(`<p class="dim small mt8">Labor is sold by the hour at your billable rate; materials carry a markup. Common for service and handyman work.</p>`), h('div', { class: 'inline-fields' }, num(p, 'billRate', 'Billable labor rate', { unit: '$/hr' }), num(d, 'materialMarkup', 'Material markup', { unit: '%' }))); }
    else { methodBox.append(el(`<p class="dim small mt8">Cost + markups, then overhead and profit stacked on top.</p>`), h('div', { class: 'inline-fields' }, num(d, 'materialMarkup', 'Material markup', { unit: '%' }), num(d, 'laborMarkup', 'Labor markup', { unit: '%' })), h('div', { class: 'inline-fields' }, num(d, 'overhead', 'Overhead markup', { unit: '%' }), num(d, 'profit', 'Profit markup', { unit: '%' }))); } };
  drawMethod(); B.append(m);

  // 2) know your numbers
  const k = h('div', { class: 'card' }, el(`<div class="card-title"><h3>2 · Know your numbers</h3><span class="dim small">per year</span></div>`));
  k.append(h('div', { class: 'inline-fields' }, num(p, 'overheadAnnual', 'Yearly overhead', { unit: '$', step: 1000, hint: 'Truck, insurance, phone, software, office, your salary' }), num(p, 'revenueAnnual', 'Expected yearly sales', { unit: '$', step: 5000 })), num(p, 'targetNetPct', 'Net profit you want to keep', { unit: '%', step: 0.5 }));
  const kOut = el(`<div class="calc-out"></div>`); const kBtn = el(`<button class="btn sm secondary mt8">Use this as my target margin</button>`); k.append(kOut, kBtn); B.append(k);
  kBtn.addEventListener('click', () => { const oh = overheadPctOf(p.overheadAnnual, p.revenueAnnual); p.overheadPct = Math.round(oh * 10) / 10; p.targetMargin = Math.round(requiredMargin(oh, p.targetNetPct) * 10) / 10; p.method = 'margin'; save(); drawMethod(); $$('.seg button', m).forEach((b) => b.classList.toggle('active', /Margin/.test(b.textContent))); refresh(); toast(`Target margin set to ${p.targetMargin}%`); });

  // 3) crew cost
  const c = h('div', { class: 'card' }, el(`<div class="card-title"><h3>3 · What an hour of labor costs you</h3></div>`));
  c.append(h('div', { class: 'inline-fields' }, num(p, 'wage', 'Average wage', { unit: '$/hr', step: 0.5 }), num(p, 'burdenPct', 'Labor burden', { unit: '%', hint: 'Payroll tax, workers comp, liability, PTO (25–40% is typical)' })));
  const cOut = el(`<div class="calc-out"></div>`); const cBtn = el(`<button class="btn sm secondary mt8">Use as my billable rate</button>`); c.append(cOut, cBtn);
  cBtn.addEventListener('click', () => { p.billRate = Math.round(billRateFor(burdenedRate(p.wage, p.burdenPct), p.targetMargin)); save(); drawMethod(); refresh(); toast(`Billable rate set to $${p.billRate}/hr`); });
  const ownRow = h('div', { class: 'row between mt12' }, el(`<div><b>Price labor at my own rates</b><div class="dim small">Otherwise labor uses the regional index for your ZIP</div></div>`)); ownRow.append(switchEl(!!p.useOwnRates, (v) => { p.useOwnRates = v; save(); rates.classList.toggle('hidden', !v); }));
  const rates = h('div', { class: `inline-fields ${p.useOwnRates ? '' : 'hidden'}` }); for (const [key, t] of Object.entries(TRADES)) rates.append(num(p.rates, key, t.label, { unit: '$/hr', step: 1 }));
  c.append(ownRow, el(`<p class="dim tiny mt8">Your cost per hour by trade (wage + burden, or what a sub charges you).</p>`), rates); B.append(c);

  // 4) extras
  const x = h('div', { class: 'card' }, el(`<div class="card-title"><h3>4 · Minimums, rounding & terms</h3></div>`));
  const roundSel = el(`<div class="field"><label>Round bid prices up to</label><select>${[0, 5, 10, 25, 50, 100, 250].map((v) => `<option value="${v}" ${Number(p.rounding) === v ? 'selected' : ''}>${v ? `Nearest $${v}` : 'Don’t round'}</option>`).join('')}</select></div>`); $('select', roundSel).addEventListener('change', (e) => { p.rounding = Number(e.target.value); save(); refresh(); });
  x.append(h('div', { class: 'inline-fields' }, num(p, 'minJob', 'Minimum job charge', { unit: '$', step: 25 }), num(p, 'tripFee', 'Trip / mobilization fee', { unit: '$', step: 5 })), roundSel, h('div', { class: 'inline-fields' }, num(d, 'depositPct', 'Deposit at signing', { unit: '%' }), num(d, 'taxRate', 'Sales tax', { unit: '%', step: 0.05 })), h('div', { class: 'inline-fields' }, num(p, 'crewSize', 'Typical crew size', { unit: 'people' }), num(p, 'hoursPerDay', 'Hours per day', { unit: 'hr' })));
  B.append(x);

  // 5) markup trap + live preview
  const trap = h('div', { class: 'card' }, el(`<div class="card-title"><h3>The markup trap</h3></div>`)); const trapOut = el(`<div class="calc-out"></div>`); trap.append(trapOut); B.append(trap);
  const prev = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Your price on a $10,000-cost job</h3><span class="dim small">60% materials · 40% labor</span></div>`)); const prevOut = h('div', { class: 'kpi' }); const prevNote = el(`<div></div>`); prev.append(prevOut, prevNote); B.append(prev);

  function refresh() {
    const oh = overheadPctOf(p.overheadAnnual, p.revenueAnnual); const need = requiredMargin(oh, p.targetNetPct); const burd = burdenedRate(p.wage, p.burdenPct);
    kOut.innerHTML = `Overhead is <b>${pct(oh)}</b> of sales. To keep <b>${pct(p.targetNetPct, 0)}</b> net you need a <b>${pct(need)}</b> gross margin — that is a <b>${pct(markupFromMargin(need))}</b> markup on cost.<br>Break-even sales at that margin: <b>${money0(breakEvenRevenue(p.overheadAnnual, need))}</b>/yr.`;
    cOut.innerHTML = `Burdened cost: <b>${fmtMoney(burd)}</b>/hr. At a ${pct(p.targetMargin, 0)} margin your billable rate should be at least <b>${fmtMoney(billRateFor(burd, p.targetMargin))}</b>/hr.`;
    const mk = Number(p.targetMargin) || 35; trapOut.innerHTML = `Job cost <b>$10,000</b>. Adding a <b>${mk}% markup</b> → <b>${money0(10000 * (1 + mk / 100))}</b>, which is only a <b>${pct(marginFromMarkup(mk))}</b> margin.<br>To actually keep <b>${mk}%</b>, charge <b>${money0(priceFromMargin(10000, mk))}</b> — a <b>${pct(markupFromMargin(mk))}</b> markup.`;
    const T = sampleTotals({ method: p.method, targetMargin: p.targetMargin, billRate: p.billRate, overheadPct: oh || p.overheadPct, materialMarkup: d.materialMarkup, laborMarkup: d.laborMarkup, overhead: d.overhead, profit: d.profit, rounding: p.rounding });
    prevOut.innerHTML = `<div class="stat"><div class="v">${money0(T.preTax)}</div><div class="k">your price</div></div><div class="stat"><div class="v">${pct(T.grossMargin)}</div><div class="k">gross margin</div></div><div class="stat"><div class="v">${pct(T.markupOnCost)}</div><div class="k">markup on cost</div></div><div class="stat"><div class="v">${money0(T.preTax * (1 - oh / 100) - 10000)}</div><div class="k">net after overhead</div></div>`;
    const net = ((T.preTax * (1 - oh / 100) - 10000) / T.preTax) * 100; prevNote.innerHTML = net + 0.05 >= p.targetNetPct ? `<div class="okbox">${icons.check} This keeps ${pct(net)} net — at or above your ${pct(p.targetNetPct, 0)} goal.</div>` : `<div class="warnbox">${icons.warn} This keeps only ${pct(net)} net — below your ${pct(p.targetNetPct, 0)} goal. Raise your margin to ${pct(need)} (tap “Use this as my target margin”).</div>`;
  }
  refresh();
  return pn;
}

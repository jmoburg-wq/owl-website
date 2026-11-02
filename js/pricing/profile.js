// Pricing profile — how THIS contractor prices work. Pure math, no DOM.
//
// Three pricing methods (per estimate, defaulted from the profile):
//   markup  — cost + material markup % + labor markup %, then overhead % and profit % stacked on top (classic)
//   margin  — price = cost ÷ (1 − target gross margin). The method most accountants recommend: the margin you
//             set is the margin you get.
//   rate    — labor sold at a billable hourly rate (hours × rate), materials at a markup %.
// Then: trip fee, minimum job charge, and rounding.

export const LABOR_BASE = 60; // $/hr the national catalog labor unit costs are built on

export const TRADES = {
  laborer: { label: 'Laborer / helper', rate: 34 },
  carpenter: { label: 'Carpenter', rate: 52 },
  painter: { label: 'Painter', rate: 44 },
  flooring: { label: 'Flooring installer', rate: 50 },
  drywall: { label: 'Drywall finisher', rate: 48 },
  tile: { label: 'Tile setter', rate: 54 },
  electrician: { label: 'Electrician', rate: 72 },
  plumber: { label: 'Plumber', rate: 75 },
  hvac: { label: 'HVAC tech', rate: 74 },
  roofer: { label: 'Roofer', rate: 46 },
  siding: { label: 'Siding installer', rate: 48 },
  mason: { label: 'Concrete / mason', rate: 52 },
  paving: { label: 'Paving crew', rate: 50 },
  demo: { label: 'Demolition', rate: 36 },
  finish_carpentry: { label: 'Finish carpenter', rate: 56 },
  glass: { label: 'Glass installer', rate: 55 },
  cleanup: { label: 'Cleanup', rate: 30 },
  marine: { label: 'Marine crew', rate: 62 },
  fencing: { label: 'Fence installer', rate: 44 },
  landscaping: { label: 'Landscaper', rate: 38 },
};

export const DEFAULT_PROFILE = {
  setupDone: false,
  method: 'markup',          // markup | margin | rate
  targetMargin: 35,          // % gross margin (margin method)
  billRate: 95,              // $/hr billed (rate method)
  overheadPct: 15,           // % of revenue that overhead eats (for net-profit check)
  targetNetPct: 15,          // % net profit you want to keep
  useOwnRates: false,        // true: price labor at YOUR burdened cost per trade instead of the regional index
  rates: Object.fromEntries(Object.entries(TRADES).map(([k, v]) => [k, v.rate])),
  wage: 28, burdenPct: 32,   // helper for the burdened-cost calculator
  overheadAnnual: 60000, revenueAnnual: 400000,
  minJob: 0, tripFee: 0, rounding: 0, // rounding increment in $ (0 = none); always rounds up
  crewSize: 2, hoursPerDay: 8,
};

// ---- the math contractors get wrong (shown in the UI with live numbers)
export const markupFromMargin = (marginPct) => { const m = marginPct / 100; return m >= 1 ? Infinity : (m / (1 - m)) * 100; };
export const marginFromMarkup = (markupPct) => { const k = markupPct / 100; return (k / (1 + k)) * 100; };
export const priceFromMargin = (cost, marginPct) => cost / (1 - Math.min(95, Math.max(0, marginPct)) / 100);
export const burdenedRate = (wage, burdenPct) => wage * (1 + burdenPct / 100);
export const overheadPctOf = (overheadAnnual, revenueAnnual) => (revenueAnnual > 0 ? (overheadAnnual / revenueAnnual) * 100 : 0);
export const requiredMargin = (overheadPct, netPct) => overheadPct + netPct;
export const billRateFor = (costRate, marginPct) => priceFromMargin(costRate, marginPct);
export const breakEvenRevenue = (overheadAnnual, grossMarginPct) => (grossMarginPct > 0 ? overheadAnnual / (grossMarginPct / 100) : Infinity);

export function profileOf(settings) { return { ...DEFAULT_PROFILE, ...((settings && settings.profile) || {}), rates: { ...DEFAULT_PROFILE.rates, ...(((settings && settings.profile) || {}).rates || {}) } }; }

/** Multiplier applied to national labor unit costs for a trade. */
export function laborIndex(ltrade, settings, region) {
  const p = profileOf(settings);
  if (p.useOwnRates) return (p.rates[ltrade] || p.rates.laborer || LABOR_BASE) / LABOR_BASE;
  return region ? region.labor : 1;
}
/** Effective cost per labor hour for a trade (what an hour costs you). */
export const laborRate = (ltrade, settings, region) => LABOR_BASE * laborIndex(ltrade, settings, region);

/** Estimate adjustments for a new estimate, from settings.defaults + the profile. */
export function newEstimateAdj(settings) {
  const d = settings.defaults || {}; const p = profileOf(settings);
  return { method: p.method, materialMarkup: d.materialMarkup ?? 15, laborMarkup: d.laborMarkup ?? 10, overhead: d.overhead ?? 10, profit: d.profit ?? 10, contingency: d.contingency ?? 0, taxRate: d.taxRate ?? 0, taxMaterialsOnly: d.taxMaterialsOnly !== false, discount: 0, depositPct: d.depositPct ?? 30, targetMargin: p.targetMargin, billRate: p.billRate, overheadPct: p.overheadPct, targetNetPct: p.targetNetPct, minJob: p.minJob, tripFee: p.tripFee, rounding: p.rounding, inlineMarkup: true };
}

/** Final price adjustments shared by every method. */
export function finishPrice(raw, a) {
  let price = raw + (Number(a.tripFee) || 0); let minApplied = false;
  if (Number(a.minJob) > 0 && price < Number(a.minJob)) { price = Number(a.minJob); minApplied = true; }
  const inc = Number(a.rounding) || 0; if (inc > 0) price = Math.ceil(price / inc - 1e-9) * inc;
  return { price, adjustment: price - raw, minApplied };
}

export const METHOD_LABELS = { markup: 'Markup on cost', margin: 'Target gross margin', rate: 'Billable labor rate' };

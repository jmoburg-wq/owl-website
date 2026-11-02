// AI estimate: prompt, structured-output schema and result normalization.
// Transport-independent: used by the browser SDK path, the server proxy and the artifact "sample" path.
import { ASSEMBLIES, ASSEMBLY_MAP } from './catalog.js';
import { metrics, toSF, toFT, kindOf, areaSummary } from '../geometry.js';
import { CLASSES } from './suppliers.js';
import { TRADES } from './profile.js';
import { BRAND } from '../brand.js';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)', inPerM: 4, outPerM: 20 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, lower cost)', inPerM: 2, outPerM: 10 },
];
export const AI_MODEL_DEFAULT = AI_MODELS[0].id;

export function catalogSummary() {
  return ASSEMBLIES.map((a) => {
    const opts = (a.options || []).map((o) => o.type === 'select' ? `${o.key}=${o.values.map((v) => JSON.stringify(v.v)).join('|')}` : o.type === 'number' ? `${o.key}=number${o.default != null ? ` (default ${o.default})` : ' (auto from room)'}` : `${o.key}=true|false`).join(', ');
    return `- ${a.key} — ${a.name} [${a.trade}]${a.scope === 'project' ? ' (project-level)' : ''}${opts ? ` · options: ${opts}` : ''}`;
  }).join('\n');
}

export const SYSTEM_PROMPT = `You are a senior residential remodeling and exterior estimator working inside ${BRAND.name}, an estimating app. The app has already measured the room(s) and can price work items from a fixed catalog. Your job: read the contractor's job-site photos and plain-language description, decide which catalog work items apply (with the right options and counts), add anything the catalog lacks as custom line items, write a clean client-facing scope paragraph, and flag what is missing or risky.

Catalog of work items (use only these keys in "assemblies"):
${catalogSummary()}

Rules:
- Quantities for catalog items come from the measured room geometry automatically; do not restate square footage in options. Only set an option when the photos/description justify it (e.g. existing floor type for demo_floor, number of recessed lights, cabinet linear feet, grade).
- When the description says to remove/replace an existing finish, include the matching demolition item and the disposal item (dumpster).
- Put work the catalog cannot express into customItems with realistic US national-average unit costs (material and labor as separate lines), units from: sf, lf, ea, gal, sheet, hr, ls, day.
- scopeText: 2–5 sentences a homeowner can read; no prices; present tense; mention exclusions if obvious.
- flags: concrete missing details or risks that change price (e.g. "Ceiling height not measured", "Photos show water staining under the window — possible subfloor repair", "Electrical panel capacity unknown for added circuits").
- upsells: catalog keys worth proposing with a one-line reason; only items not already implied by the scope.
- assumptions: what you assumed to produce the scope.
- Never invent room dimensions; if none are provided, say so in flags.
- Be decisive: a contractor will edit the result, so a complete first draft beats a cautious empty one.`;

const ASSEMBLY_KEYS = ASSEMBLIES.map((a) => a.key);
export const RESULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['scopeText', 'assemblies', 'customItems', 'flags', 'upsells', 'assumptions', 'confidence'],
  properties: {
    scopeText: { type: 'string' },
    assemblies: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'reason', 'opts'], properties: { key: { type: 'string', enum: ASSEMBLY_KEYS }, reason: { type: 'string' }, opts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: { type: 'string' }, value: { type: 'string' } } } } } } },
    customItems: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'cat', 'unit', 'qty', 'unitCost', 'note'], properties: { name: { type: 'string' }, cat: { type: 'string', enum: ['material', 'labor', 'fee'] }, unit: { type: 'string', enum: ['sf', 'lf', 'ea', 'gal', 'sheet', 'hr', 'ls', 'day'] }, qty: { type: 'number' }, unitCost: { type: 'number' }, note: { type: 'string' } } } },
    flags: { type: 'array', items: { type: 'string' } },
    upsells: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'reason'], properties: { key: { type: 'string', enum: ASSEMBLY_KEYS }, reason: { type: 'string' } } } },
    assumptions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

export function roomSummary(rooms, units = 'imperial') {
  return (rooms || []).map((r) => { if (kindOf(r) !== 'room') return { name: r.name, kind: kindOf(r), summary: areaSummary(r, units), notes: r.notes || '' }; const m = metrics(r); const imp = units !== 'metric'; return { name: r.name, source: r.source, floorArea: imp ? `${toSF(m.floorArea).toFixed(0)} sf` : `${m.floorArea.toFixed(1)} m²`, ceilingHeight: imp ? `${toFT(m.H).toFixed(2)} ft` : `${m.H.toFixed(2)} m`, ceilingAssumed: !!r.ceilingAssumed, perimeter: imp ? `${toFT(m.perimeter).toFixed(1)} lf` : `${m.perimeter.toFixed(1)} m`, wallAreaNet: imp ? `${toSF(m.wallAreaNet).toFixed(0)} sf` : `${m.wallAreaNet.toFixed(1)} m²`, doors: m.doorCount, windows: m.windowCount, notes: r.notes || '' }; });
}

export function dataURLToImageBlock(dataURL) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(dataURL || ''); if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}

/** User-turn content blocks: photos first, then the structured brief. */
export function buildUserContent({ scopeText = '', photos = [], rooms = [], units = 'imperial', region = null, selected = [] }) {
  const images = photos.slice(0, 6).map(dataURLToImageBlock).filter(Boolean);
  const brief = { description: scopeText || '(none given — infer the scope from the photos)', rooms: roomSummary(rooms, units), units, region: region ? region.label : 'unknown', alreadySelected: selected, photoCount: images.length };
  const text = `Job brief (JSON):\n${JSON.stringify(brief, null, 2)}\n\nProduce the estimate scope now.`;
  return [...images, { type: 'text', text }];
}

/** Single-string prompt for providers that accept only text (artifact "sample" capability). */
export function buildTextPrompt(args) {
  const content = buildUserContent({ ...args, photos: [] });
  return `${SYSTEM_PROMPT}\n\n${content[content.length - 1].text}\n\nRespond with ONLY a JSON object matching this schema (no prose, no code fence):\n${JSON.stringify(RESULT_SCHEMA)}`;
}

function coerceOpt(def, key, value) {
  const o = (def.options || []).find((x) => x.key === key); if (!o) return undefined;
  if (o.type === 'bool') return /^(true|yes|1)$/i.test(String(value));
  if (o.type === 'number') { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
  const match = o.values.find((v) => String(v.v) === String(value)) || o.values.find((v) => v.label.toLowerCase().includes(String(value).toLowerCase()));
  return match ? match.v : undefined;
}

/** Validate + coerce a raw model result into what the estimator consumes. */
export function normalizeResult(raw) {
  const r = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) : raw || {};
  const seen = new Set(); const assemblies = [];
  for (const a of r.assemblies || []) { const def = ASSEMBLY_MAP[a.key]; if (!def || seen.has(a.key)) continue; seen.add(a.key); const opts = {}; const pairs = Array.isArray(a.opts) ? a.opts : Object.entries(a.opts || {}).map(([key, value]) => ({ key, value })); for (const p of pairs) { const v = coerceOpt(def, p.key, p.value); if (v !== undefined) opts[p.key] = v; } assemblies.push({ key: a.key, opts, reason: String(a.reason || '') }); }
  const customItems = (r.customItems || []).filter((c) => c && c.name && Number(c.qty) > 0 && Number(c.unitCost) >= 0).map((c) => ({ name: String(c.name).slice(0, 120), cat: ['material', 'labor', 'fee'].includes(c.cat) ? c.cat : 'material', unit: String(c.unit || 'ea'), qty: Math.round(Number(c.qty) * 100) / 100, unitCost: Math.round(Number(c.unitCost) * 100) / 100, note: String(c.note || '').slice(0, 200) }));
  const upsells = (r.upsells || []).filter((u) => u && ASSEMBLY_MAP[u.key] && !seen.has(u.key)).map((u) => ({ key: u.key, name: ASSEMBLY_MAP[u.key].name, reason: String(u.reason || '') }));
  return { scopeText: String(r.scopeText || '').trim(), assemblies, customItems, flags: (r.flags || []).map(String).slice(0, 12), upsells: upsells.slice(0, 6), assumptions: (r.assumptions || []).map(String).slice(0, 10), confidence: ['low', 'medium', 'high'].includes(r.confidence) ? r.confidence : 'medium' };
}

export function estimateCost(usage, modelId) {
  const m = AI_MODELS.find((x) => x.id === modelId) || AI_MODELS[0]; if (!usage) return null;
  const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0) * 0.1;
  return (inTok * m.inPerM + (usage.output_tokens || 0) * m.outPerM) / 1e6;
}


// ======================================================================================================
// Configure anything: a product the contractor picked → everything else the installation needs.
// ======================================================================================================
const CLASS_KEYS = Object.keys(CLASSES); const TRADE_KEYS = Object.keys(TRADES);
export const CONFIGURE_SYSTEM = `You are a veteran residential contractor who has also worked the counter at supply houses (Home Depot Pro, Ferguson, ABC Supply, lumber yards). A contractor has picked a product from a manufacturer or supplier. Your job: list EVERYTHING ELSE the installation needs so nothing is left off the bid — every part, connector, fastener, sealant, trim, flashing and consumable; the labor by trade in hours; disposal, permit and equipment fees; and the field notes that prevent callbacks.

Rules:
- Quantities are for baseQty units of the product (baseQty = the quantity the contractor gave, default 1).
- Prices are realistic current US national-average contractor costs in USD. Labor is in HOURS by trade, not dollars.
- need: "required" (job cannot be done without it), "recommended" (good practice / what the maker's instructions call for / prevents callbacks), "optional" (upsell or situational).
- supplierClass for every part must be one of: ${CLASS_KEYS.join(', ')}.
- trade for every labor task must be one of: ${TRADE_KEYS.join(', ')}.
- why: one short sentence a homeowner would understand.
- notes: measuring, lead-time and compatibility gotchas specific to this product. Say what the maker's instructions call for or what a part does; never say what a building code requires.
- unitPrice is your estimate of the product's own price per unit if the contractor did not give one.
- Do not repeat the product itself in parts. Be complete and specific (sizes, ratings), not generic.`;
export const CONFIGURE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['productName', 'category', 'unit', 'baseQty', 'unitPrice', 'supplierClass', 'parts', 'labor', 'fees', 'notes'],
  properties: {
    productName: { type: 'string' }, category: { type: 'string' }, unit: { type: 'string', enum: ['ea', 'sf', 'lf', 'sq', 'gal', 'bundle', 'box', 'roll', 'set', 'pair'] }, baseQty: { type: 'number' }, unitPrice: { type: 'number' }, supplierClass: { type: 'string', enum: CLASS_KEYS },
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'unit', 'qty', 'unitCost', 'supplierClass', 'need', 'why'], properties: { name: { type: 'string' }, unit: { type: 'string' }, qty: { type: 'number' }, unitCost: { type: 'number' }, supplierClass: { type: 'string', enum: CLASS_KEYS }, need: { type: 'string', enum: ['required', 'recommended', 'optional'] }, why: { type: 'string' } } } },
    labor: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['task', 'hours', 'trade', 'why'], properties: { task: { type: 'string' }, hours: { type: 'number' }, trade: { type: 'string', enum: TRADE_KEYS }, why: { type: 'string' } } } },
    fees: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'unit', 'qty', 'unitCost', 'need', 'why'], properties: { name: { type: 'string' }, unit: { type: 'string' }, qty: { type: 'number' }, unitCost: { type: 'number' }, need: { type: 'string', enum: ['required', 'recommended', 'optional'] }, why: { type: 'string' } } } },
    notes: { type: 'array', items: { type: 'string' } },
  },
};
function configureBrief({ description = '', qty = 1, where = '', area = null, region = null, units = 'imperial' }) {
  return `Product the contractor configured:\n${description}\n\nQuantity: ${qty}\nLocation: ${where || 'not specified'}\nRegion: ${region ? region.label : 'United States'}${area ? `\nMeasured area: ${area.name} — ${areaSummary(area, units)}` : ''}\n\nList everything else this installation needs.`;
}
export function buildConfigureContent(args) { const images = (args.photos || []).slice(0, 4).map(dataURLToImageBlock).filter(Boolean); return [...images, { type: 'text', text: configureBrief(args) }]; }
export function buildConfigureText(args) { return `${CONFIGURE_SYSTEM}\n\n${configureBrief(args)}\n\nRespond with ONLY a JSON object matching this schema (no prose, no code fence):\n${JSON.stringify(CONFIGURE_SCHEMA)}`; }
export function buildConfigureRequest(model, args) {
  return { model, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system: [{ type: 'text', text: CONFIGURE_SYSTEM, cache_control: { type: 'ephemeral' } }], output_config: { effort: 'medium', format: { type: 'json_schema', schema: CONFIGURE_SCHEMA } }, messages: [{ role: 'user', content: buildConfigureContent(args) }] };
}
export function normalizeConfigure(raw, qty = 1) {
  const r = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) : raw || {};
  const cls = (c) => (CLASS_KEYS.includes(c) ? c : 'building'); const tr = (t) => (TRADE_KEYS.includes(t) ? t : 'carpenter'); const need = (n) => (['required', 'recommended', 'optional'].includes(n) ? n : 'required'); const n = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 100) / 100 : 0);
  return { productName: String(r.productName || 'Custom product').slice(0, 120), category: String(r.category || 'Custom').slice(0, 60), unit: String(r.unit || 'ea'), baseQty: n(r.baseQty) || qty || 1, unitPrice: n(r.unitPrice), supplierClass: cls(r.supplierClass),
    parts: (r.parts || []).filter((p) => p && p.name && n(p.qty) > 0).slice(0, 40).map((p) => ({ name: String(p.name).slice(0, 120), unit: String(p.unit || 'ea').slice(0, 12), qty: n(p.qty), unitCost: n(p.unitCost), supplierClass: cls(p.supplierClass), need: need(p.need), why: String(p.why || '').slice(0, 220) })),
    labor: (r.labor || []).filter((l) => l && l.task && n(l.hours) > 0).slice(0, 15).map((l) => ({ task: String(l.task).slice(0, 120), hours: n(l.hours), trade: tr(l.trade), why: String(l.why || '').slice(0, 220) })),
    fees: (r.fees || []).filter((f) => f && f.name && n(f.qty) > 0).slice(0, 8).map((f) => ({ name: String(f.name).slice(0, 120), unit: String(f.unit || 'ea').slice(0, 12), qty: n(f.qty), unitCost: n(f.unitCost), need: need(f.need), why: String(f.why || '').slice(0, 220) })),
    notes: (r.notes || []).map(String).slice(0, 8) };
}

// ======================================================================================================
// Live supplier prices (own API key or server endpoint): web search restricted to the contractor's suppliers.
// ======================================================================================================
export const PRICES_TOOL = { name: 'report_prices', description: 'Call this exactly once, after searching, to report the current price you found for each requested item. Use found=false (price 0) when no reliable current price exists on the allowed supplier sites.', strict: true,
  input_schema: { type: 'object', additionalProperties: false, required: ['prices'], properties: { prices: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'found', 'price', 'unit', 'supplier', 'url', 'note'], properties: { id: { type: 'string' }, found: { type: 'boolean' }, price: { type: 'number' }, unit: { type: 'string' }, supplier: { type: 'string' }, url: { type: 'string' }, note: { type: 'string' } } } } } } };
export function buildPricesRequest(model, { items = [], suppliers = [], zip = '' }) {
  const domains = [...new Set(suppliers.map((x) => x.domain).filter(Boolean))].slice(0, 12);
  const list = items.slice(0, 15).map((i) => `- id=${i.id} | ${i.name} | unit: ${i.unit} | qty ${i.qty}${i.sku ? ` | SKU ${i.sku}` : ''}${i.supplier ? ` | preferred supplier: ${i.supplier}` : ''}`).join('\n');
  return { model, max_tokens: 16000, output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: Math.min(10, items.length + 3), ...(domains.length ? { allowed_domains: domains } : {}) }, PRICES_TOOL],
    messages: [{ role: 'user', content: `Find the current online price for each item below at these suppliers: ${suppliers.map((x) => x.name).join(', ')}${zip ? ` (job ZIP ${zip})` : ''}. Prefer the item's preferred supplier. Match the unit (convert pack sizes to the unit given). Then call report_prices once with every id.\n\n${list}` }] };
}
/** Runs the search loop with any Anthropic SDK client; handles pause_turn. Resolves { prices, usage }. */
export async function runPricesLoop(client, req, maxTurns = 5) {
  const messages = [...req.messages]; const usage = { input_tokens: 0, output_tokens: 0, server_tool_use: 0 };
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await client.messages.create({ ...req, messages });
    usage.input_tokens += res.usage?.input_tokens || 0; usage.output_tokens += res.usage?.output_tokens || 0; usage.server_tool_use += res.usage?.server_tool_use?.web_search_requests || 0;
    const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'report_prices');
    if (call) return { prices: (call.input && call.input.prices) || [], usage };
    if (res.stop_reason === 'refusal') throw Object.assign(new Error('Claude declined the price lookup.'), { code: 'refused' });
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: 'Call report_prices now with what you found (found=false for anything you could not price).' });
  }
  throw Object.assign(new Error('No prices were reported — try fewer items.'), { code: 'no_prices' });
}

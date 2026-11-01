// AI estimate transports. Three ways to reach Claude, chosen automatically:
//   1. "endpoint": your own server (see server/worker.mjs) that holds the API key — best for teams.
//   2. "sdk": the Anthropic SDK in the browser with a key the user pasted in Settings (stored on-device only).
//   3. "sample": the claude.ai artifact runtime (`claude.use("sample")`) — no key needed when the app runs as a Claude artifact.
import { SYSTEM_PROMPT, RESULT_SCHEMA, buildUserContent, buildTextPrompt, normalizeResult, estimateCost, roomSummary, AI_MODEL_DEFAULT, buildConfigureRequest, buildConfigureText, normalizeConfigure, buildPricesRequest, runPricesLoop } from './ai-prompt.js';
import { suppliersOf } from './suppliers.js';
import { regionFor } from './estimator.js';

const tag = (message, code) => Object.assign(new Error(message), { code });
export const hasSampleRuntime = () => typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';

export function aiStatus(settings) {
  const ai = (settings && settings.ai) || {};
  if (ai.endpoint) return { provider: 'endpoint', label: 'your server endpoint', ready: true };
  if (ai.apiKey) return { provider: 'sdk', label: `Anthropic API · ${ai.model || AI_MODEL_DEFAULT}`, ready: true };
  if (hasSampleRuntime()) return { provider: 'sample', label: 'Claude (artifact preview)', ready: true };
  return { provider: null, label: 'not configured', ready: false };
}

/** Run the AI analysis for a project. Resolves with a normalized result (see ai-prompt.js) plus provider metadata. */
export async function runAI({ project, settings, onProgress = () => {}, inject = {} }) {
  const status = aiStatus(settings);
  if (!status.ready) throw tag('AI assist is not set up. Add an API key or server endpoint in Settings.', 'not_configured');
  const est = project.estimate;
  const args = { scopeText: est.scopeText || '', photos: project.photos || [], rooms: project.rooms || [], units: settings.units, region: regionFor(settings), selected: (est.assemblies || []).map((a) => a.key) };
  onProgress(`Analyzing ${args.photos.length} photo${args.photos.length === 1 ? '' : 's'} and ${args.rooms.length} room${args.rooms.length === 1 ? '' : 's'} with ${status.label}…`);
  let out;
  if (status.provider === 'endpoint') out = await viaEndpoint(settings.ai.endpoint, args);
  else if (status.provider === 'sdk') out = await viaSDK(settings.ai, args, inject);
  else out = await viaSample(args);
  const result = normalizeResult(out.raw);
  return { ...result, provider: status.provider, model: out.model || null, usage: out.usage || null, cost: out.usage ? estimateCost(out.usage, out.model) : null, at: new Date().toISOString() };
}

export function buildRequest(model, args) {
  return {
    model, max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
    messages: [{ role: 'user', content: buildUserContent(args) }],
  };
}

async function viaSDK(ai, args, inject = {}) {
  const Anthropic = inject.Anthropic || (await import('@anthropic-ai/sdk')).default;
  const model = ai.model || AI_MODEL_DEFAULT;
  const client = new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true, ...(inject.clientOptions || {}) });
  let response;
  try { response = await client.beta.messages.create(buildRequest(model, args)); }
  catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw tag('Invalid API key — check Settings → AI assist.', 'auth');
    if (err instanceof Anthropic.RateLimitError) throw tag('Rate limited by the API — wait a minute and try again.', 'rate_limited');
    if (err instanceof Anthropic.BadRequestError) throw tag(`The API rejected the request: ${err.message}`, 'bad_request');
    if (err instanceof Anthropic.APIConnectionError) throw tag('Could not reach the Anthropic API — check your connection.', 'network');
    if (err instanceof Anthropic.APIError) throw tag(`API error ${err.status}: ${err.message}`, 'api');
    throw err;
  }
  if (response.stop_reason === 'refusal') throw tag(`Claude declined this request${response.stop_details && response.stop_details.explanation ? ': ' + response.stop_details.explanation : ''}.`, 'refused');
  if (response.stop_reason === 'max_tokens') throw tag('The answer was cut short — try fewer photos or a shorter description.', 'truncated');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!text.trim()) throw tag('Claude returned no text.', 'empty');
  return { raw: text, usage: response.usage, model: response.model || model };
}

async function viaEndpoint(endpoint, args) {
  const body = { ...args, rooms: roomSummary(args.rooms, args.units), region: args.region ? args.region.label : null };
  let res;
  try { res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw tag('Could not reach your AI endpoint.', 'network'); }
  if (!res.ok) throw tag(`Your AI endpoint returned ${res.status}.`, 'endpoint');
  const data = await res.json();
  return { raw: data.result !== undefined ? data.result : data, usage: data.usage || null, model: data.model || 'endpoint' };
}

function dataURLToBlob(dataURL) {
  const m = /^data:(image\/[a-z]+);base64,(.+)$/s.exec(dataURL || ''); if (!m) return null;
  const bin = atob(m[2]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function viaSample(args) {
  const sample = await window.claude.use('sample');
  if (!sample) throw tag('Claude is not available in this view.', 'not_granted');
  let images = [];
  try { const lim = await sample.limits(); if (lim && lim.images) images = args.photos.slice(0, lim.images.maxCount).map(dataURLToBlob).filter(Boolean); } catch { images = []; }
  const ask = (imgs) => sample.json(buildTextPrompt(args) + (imgs.length ? `\n\nThe ${imgs.length} attached image${imgs.length === 1 ? ' is a job-site photo' : 's are job-site photos'} of this room; use them to infer existing conditions and scope.` : ''), { images: imgs.length ? imgs : undefined, modelTier: 'complex', cache: false });
  try {
    let value;
    try { value = await ask(images); }
    catch (e) { if (e && e.code === 'images_unavailable' && images.length) value = await ask([]); else throw e; }
    return { raw: value, model: 'claude-artifact', usage: null };
  } catch (e) {
    const code = e && e.code;
    const copy = { not_granted: 'Claude access was declined for this page.', sampling_disabled: 'Claude is not available for this account.', rate_limited: 'Rate limited — try again in a minute.', refused: 'Claude declined this input. Change the description or photos.', invalid_json: 'Claude returned an unreadable answer — try again.', cancelled: 'Cancelled.', prompt_too_large: 'Too much input — remove some photos or shorten the description.' };
    throw tag(copy[code] || (e && e.message) || 'AI call failed.', code || 'sample');
  }
}


// ---------------- configure anything ----------------
export async function runConfigure({ description, photos = [], qty = 1, where = '', area = null, settings, inject = {} }) {
  const status = aiStatus(settings); if (!status.ready) throw tag('AI assist is not set up. Add an API key or server endpoint in Settings.', 'not_configured');
  const args = { description, photos, qty, where, area, region: regionFor(settings), units: settings.units }; let raw, usage = null, model = null;
  if (status.provider === 'endpoint') { let res; try { res = await fetch(settings.ai.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'configure', description, photos: photos.slice(0, 4), qty, where, area: area ? { name: area.name, kind: area.kind } : null, region: args.region.label }) }); } catch { throw tag('Could not reach your AI endpoint.', 'network'); } if (!res.ok) throw tag(`Your AI endpoint returned ${res.status}.`, 'endpoint'); const d = await res.json(); raw = d.result ?? d; usage = d.usage; model = d.model; }
  else if (status.provider === 'sdk') { const { client, Anthropic } = await sdkClient(settings.ai, inject); model = settings.ai.model || AI_MODEL_DEFAULT; let r; try { r = await client.beta.messages.create(buildConfigureRequest(model, args)); } catch (err) { throw mapSdkError(err, Anthropic); } if (r.stop_reason === 'refusal') throw tag('Claude declined this request.', 'refused'); raw = r.content.filter((b) => b.type === 'text').map((b) => b.text).join(''); usage = r.usage; model = r.model || model; }
  else { const sample = await window.claude.use('sample'); if (!sample) throw tag('Claude is not available in this view.', 'not_granted'); let images = []; try { const lim = await sample.limits(); if (lim && lim.images) images = photos.slice(0, lim.images.maxCount).map(dataURLToBlob).filter(Boolean); } catch {} try { raw = await sample.json(buildConfigureText(args), { images: images.length ? images : undefined, modelTier: 'default', cache: false }); } catch (e) { throw tag((e && e.message) || 'AI call failed.', (e && e.code) || 'sample'); } model = 'claude-artifact'; }
  return { ai: normalizeConfigure(raw, qty), usage, model, cost: usage ? estimateCost(usage, model) : null };
}

// ---------------- live supplier prices (needs web search: own key or endpoint) ----------------
export const livePricesAvailable = (settings) => { const st = aiStatus(settings); return st.provider === 'sdk' || st.provider === 'endpoint'; };
export async function runLivePrices({ items, settings, inject = {} }) {
  const st = aiStatus(settings); if (!livePricesAvailable(settings)) throw tag('Live prices need your own Anthropic API key or a server endpoint (Settings → AI assist).', 'not_configured');
  const sups = suppliersOf(settings); const used = new Set(items.map((i) => i.supplierId)); const suppliers = sups.filter((x) => used.has(x.id) && x.domain).concat(sups.filter((x) => !used.has(x.id) && x.domain && ['homedepot', 'lowes'].includes(x.id)));
  const payloadItems = items.map((i) => ({ id: i.key, name: i.name, unit: i.unit, qty: i.qty, sku: i.sku || '', supplier: (sups.find((x) => x.id === i.supplierId) || {}).name || '' }));
  if (st.provider === 'endpoint') { const res = await fetch(settings.ai.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'prices', items: payloadItems, suppliers: suppliers.map((x) => ({ name: x.name, domain: x.domain })), zip: settings.region.zip }) }); if (!res.ok) throw tag(`Your AI endpoint returned ${res.status}.`, 'endpoint'); return res.json(); }
  const { client, Anthropic } = await sdkClient(settings.ai, inject); const model = settings.ai.model || AI_MODEL_DEFAULT;
  try { const out = await runPricesLoop(client, buildPricesRequest(model, { items: payloadItems, suppliers, zip: settings.region.zip })); return { ...out, cost: estimateCost(out.usage, model) + (out.usage.server_tool_use || 0) * 0.01 }; }
  catch (err) { if (err && err.code) throw err; throw mapSdkError(err, Anthropic); }
}

async function sdkClient(ai, inject = {}) { const Anthropic = inject.Anthropic || (await import('@anthropic-ai/sdk')).default; return { Anthropic, client: new Anthropic({ apiKey: ai.apiKey, dangerouslyAllowBrowser: true, ...(inject.clientOptions || {}) }) }; }
function mapSdkError(err, Anthropic) {
  if (err instanceof Anthropic.AuthenticationError) return tag('Invalid API key — check Settings → AI assist.', 'auth');
  if (err instanceof Anthropic.RateLimitError) return tag('Rate limited by the API — wait a minute and try again.', 'rate_limited');
  if (err instanceof Anthropic.BadRequestError) return tag(`The API rejected the request: ${err.message}`, 'bad_request');
  if (err instanceof Anthropic.APIConnectionError) return tag('Could not reach the Anthropic API — check your connection.', 'network');
  if (err instanceof Anthropic.APIError) return tag(`API error ${err.status}: ${err.message}`, 'api');
  return err;
}

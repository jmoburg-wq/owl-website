// AI proxy — a fetch-handler worker (Cloudflare Workers, Deno Deploy, Vercel Edge, Bun) that holds the
// Anthropic API key server-side. Point Settings → AI assist → "Server endpoint" at this worker's URL.
//
//   npm i @anthropic-ai/sdk
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler deploy            (wrangler.toml: main = "server/worker.mjs", compatibility_flags = ["nodejs_compat"])
//
// Request body (JSON, sent by js/pricing/ai.js):
//   { task: 'estimate', scopeText, photos: [dataURL], rooms: [summary], units, region, selected } → { result, usage, model }
//   { task: 'configure', description, photos, qty, where, region }                                 → { result, usage, model }
//   { task: 'prices', items: [{id,name,unit,qty,sku,supplier}], suppliers: [{name,domain}], zip }   → { prices, usage }
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, RESULT_SCHEMA, dataURLToImageBlock, AI_MODEL_DEFAULT, buildConfigureRequest, buildPricesRequest, runPricesLoop } from '../js/pricing/ai-prompt.js';

const ALLOW_ORIGIN = '*'; // tighten to your app's origin in production
const cors = { 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...cors } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    const client0 = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }); const model0 = env.AI_MODEL || AI_MODEL_DEFAULT;
    try {
      if (body.task === 'configure') { const r = await client0.beta.messages.create(buildConfigureRequest(model0, { description: body.description || '', photos: body.photos || [], qty: body.qty || 1, where: body.where || '', region: body.region ? { label: body.region } : null })); if (r.stop_reason === 'refusal') return json({ error: 'refused' }, 422); return json({ result: JSON.parse(r.content.filter((b) => b.type === 'text').map((b) => b.text).join('')), usage: r.usage, model: r.model || model0 }); }
      if (body.task === 'prices') return json(await runPricesLoop(client0, buildPricesRequest(model0, { items: body.items || [], suppliers: body.suppliers || [], zip: body.zip || '' })));
    } catch (err) { if (err instanceof Anthropic.APIError) return json({ error: err.message }, err.status || 502); return json({ error: String((err && err.message) || err) }, 500); }
    const images = (body.photos || []).slice(0, 6).map(dataURLToImageBlock).filter(Boolean);
    const brief = { description: body.scopeText || '(none given — infer the scope from the photos)', rooms: body.rooms || [], units: body.units || 'imperial', region: body.region || 'unknown', alreadySelected: body.selected || [], photoCount: images.length };
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const model = env.AI_MODEL || AI_MODEL_DEFAULT;
    try {
      const response = await client.beta.messages.create({
        model, max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'high', format: { type: 'json_schema', schema: RESULT_SCHEMA } },
        messages: [{ role: 'user', content: [...images, { type: 'text', text: `Job brief (JSON):\n${JSON.stringify(brief, null, 2)}\n\nProduce the estimate scope now.` }] }],
      });
      if (response.stop_reason === 'refusal') return json({ error: 'refused', explanation: response.stop_details && response.stop_details.explanation }, 422);
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return json({ result: JSON.parse(text), usage: response.usage, model: response.model || model });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return json({ error: 'server key invalid' }, 500);
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate limited' }, 429);
      if (err instanceof Anthropic.APIError) return json({ error: err.message }, err.status || 502);
      return json({ error: String(err && err.message || err) }, 500);
    }
  },
};

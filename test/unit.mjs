import { parseLen, fmtLen, squareUp, metrics, makeRect, makeL, makeRoom, makeArea, outwardNormal, pointInPolygon, area, perimeter, ensureCCW, isCCW, walls } from '../js/geometry.js';
import { regionIndex, stateFromZip } from '../js/pricing/regional.js';
import { parseScope, flags, upsells } from '../js/pricing/smart.js';
import { takeoff, totals, recompute, lineTotal, itemsByGroup } from '../js/pricing/estimator.js';
import { ASSEMBLIES, ASSEMBLY_MAP } from '../js/pricing/catalog.js';

let pass = 0, fail = 0;
const ok = (cond, msg, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', msg, extra); } };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

// units
ok(near(parseLen(`12' 6"`), 3.81), 'parseLen ft-in', parseLen(`12' 6"`));
ok(near(parseLen('12.5'), 3.81), 'parseLen decimal ft');
ok(near(parseLen('3.8m'), 3.8), 'parseLen meters');
ok(near(parseLen('150"'), 3.81), 'parseLen inches');
ok(near(parseLen('12-6'), 3.81), 'parseLen dash');
ok(near(parseLen('12 ft 6 in'), 3.81), 'parseLen words');
ok(near(parseLen('2.5', 'metric'), 2.5), 'parseLen metric default');
ok(fmtLen(3.81) === `12′ 6″`, 'fmtLen', fmtLen(3.81)); ok(near(parseLen(fmtLen(3.81)), 3.81), 'fmtLen round-trips through parseLen');
ok(fmtLen(2.4384) === `8′ 0″`, 'fmtLen 8ft', fmtLen(2.4384));
ok(fmtLen(0.9144) === `3′ 0″`, 'fmtLen 3ft', fmtLen(0.9144));

// geometry
const rect = makeRect(4, 3); ok(near(area(rect), 12), 'rect area'); ok(near(perimeter(rect), 14), 'rect perimeter');
ok(isCCW(ensureCCW(rect)), 'ensureCCW'); 
const room = makeRoom({ corners: rect, ceilingHeight: 2.4384, openings: [{ type: 'door', wall: 0, offset: 1, width: 0.9144, height: 2.032 }, { type: 'window', wall: 2, offset: 1, width: 1.2, height: 1.2, sill: 0.9 }] });
const m = metrics(room);
ok(near(m.wallAreaGross, 14 * 2.4384), 'gross wall'); ok(near(m.wallAreaNet, 14 * 2.4384 - 0.9144 * 2.032 - 1.44), 'net wall'); ok(m.doorCount === 1 && m.windowCount === 1, 'opening counts'); ok(near(m.baseboardLF, 14 - 0.9144), 'baseboard LF');
const n0 = outwardNormal(room.corners, 0); ok(!pointInPolygon({ x: 2 + n0.x * 0.1, z: 0 + n0.z * 0.1 }, room.corners), 'outward normal points outside');
ok(pointInPolygon({ x: 2, z: 1.5 }, room.corners) && !pointInPolygon({ x: 5, z: 1.5 }, room.corners), 'pointInPolygon');
// squareUp a noisy rotated rectangle
const th = 0.35; const rot = (p) => ({ x: p.x * Math.cos(th) - p.z * Math.sin(th), z: p.x * Math.sin(th) + p.z * Math.cos(th) });
const noisy = makeRect(5, 4).map(rot).map((p, i) => ({ x: p.x + [0.05, -0.08, 0.06, -0.04][i], z: p.z + [-0.06, 0.07, 0.03, 0.05][i] }));
const sq = squareUp(noisy); const angs = walls({ corners: sq, openings: [] }).map((w, i, arr) => { const nx = arr[(i + 1) % arr.length]; const a1 = w.angle, a2 = nx.angle; let d = Math.abs(a2 - a1) % Math.PI; return Math.abs(d - Math.PI / 2) * 180 / Math.PI; });
ok(angs.every((a) => a < 0.01), 'squareUp yields 90° corners', angs.map((a) => a.toFixed(3)).join(','));
ok(near(area(sq), 20, 1.0), 'squareUp preserves area approx', area(sq));
const L = makeL(16 * 0.3048, 13 * 0.3048, 5 * 0.3048, 4 * 0.3048); ok(near(area(L) / 0.09290304, 16 * 13 - 20, 0.01), 'L area sf', area(L) / 0.09290304);

// regional
ok(stateFromZip('78701') === 'TX', 'zip → TX'); ok(regionIndex({ zip: '78701' }).metro === 'Austin', 'austin metro'); ok(stateFromZip('10001') === 'NY' && regionIndex({ zip: '10001' }).labor > 1.3, 'NYC labor index'); ok(regionIndex({}).material === 1 && regionIndex({}).labor === 1, 'national default');

// smart parse
const p1 = parseScope('Remove the old carpet, install LVP, new 5 1/4 baseboard, paint walls and ceiling two coats, add 6 recessed lights');
const keys = p1.assemblies.map((a) => a.key);
ok(['demo_floor', 'floor_lvp', 'baseboard', 'paint_walls', 'paint_ceiling', 'recessed', 'dumpster'].every((k) => keys.includes(k)), 'parse keys', keys.join(','));
ok(p1.assemblies.find((a) => a.key === 'recessed').opts.count === 6, 'recessed count 6');
ok(p1.assemblies.find((a) => a.key === 'demo_floor').opts.type === 'carpet', 'demo type carpet', JSON.stringify(p1.assemblies.find((a) => a.key === 'demo_floor')));
const p2 = parseScope('paint the walls, no ceiling. premium paint, one coat');
const p4 = parseScope('replace carpet with new carpet and paint, keep the trim'); ok(p4.assemblies.some((a) => a.key === 'floor_carpet') && p4.assemblies.find((a) => a.key === 'demo_floor')?.opts.type === 'carpet' && !p4.assemblies.some((a) => a.key === 'paint_trim'), 'replace carpet with carpet', p4.assemblies.map((a) => a.key + JSON.stringify(a.opts)).join(','));
const p5 = parseScope('tear out tile floor and install hardwood, new ceiling fan, no dumpster'); ok(p5.assemblies.some((a) => a.key === 'floor_hardwood') && !p5.assemblies.some((a) => a.key === 'floor_tile') && p5.assemblies.find((a) => a.key === 'demo_floor')?.opts.type === 'tile' && p5.assemblies.some((a) => a.key === 'ceiling_fan') && !p5.assemblies.some((a) => a.key === 'paint_ceiling') && !p5.assemblies.some((a) => a.key === 'dumpster'), 'tile→hardwood + fan + no dumpster', p5.assemblies.map((a) => a.key + JSON.stringify(a.opts)).join(',')); const k2 = p2.assemblies.map((a) => a.key);
ok(k2.includes('paint_walls') && !k2.includes('paint_ceiling'), 'negation removes ceiling', k2.join(','));
ok(p2.assemblies.find((a) => a.key === 'paint_walls').opts.grade === 'premium' && p2.assemblies.find((a) => a.key === 'paint_walls').opts.coats === 1, 'qualifiers');
const p3 = parseScope('kitchen: 14 lf of cabinets, quartz countertops, subway tile backsplash, 4 can lights'); const k3 = p3.assemblies.map((a) => a.key);
ok(['cabinets', 'countertops', 'backsplash', 'recessed', 'dumpster'].every((k) => k3.includes(k)), 'kitchen parse', k3.join(','));
ok(p3.assemblies.find((a) => a.key === 'cabinets').opts.lf === 14, 'cabinet lf');
ok(parseScope('hello world').matched === 0, 'no match');

// estimator
const settings = { units: 'imperial', region: { zip: '78701', state: 'TX' }, pricing: { autoRegion: true }, company: { name: 'X' } };
const demo = makeRoom({ name: 'Bedroom', corners: L, ceilingHeight: 9 * 0.3048, openings: [{ type: 'door', wall: 0, offset: 0.6, width: 0.9144, height: 2.032 }, { type: 'window', wall: 4, offset: 1, width: 1.5, height: 1.37, sill: 0.76 }] });
const project = { id: 'p', name: 'T', client: { name: 'C' }, rooms: [demo], photos: [], status: 'draft', estimate: { number: 'EST-1', date: new Date().toISOString(), assemblies: p1.assemblies, items: [], removedKeys: [], adj: { materialMarkup: 15, laborMarkup: 10, overhead: 10, profit: 10, contingency: 0, taxRate: 8.25, taxMaterialsOnly: true, discount: 0, depositPct: 30 }, scopeText: 'x' } };
const items = recompute(project, settings);
ok(items.length > 15, 'items generated', items.length);
ok(items.every((i) => i.qty > 0 && i.unitCost > 0), 'all items have qty & cost', items.filter((i) => !(i.qty > 0 && i.unitCost > 0)).map((i) => i.name).join(';'));
const lvp = items.find((i) => i.name === 'LVP flooring'); ok(lvp && near(lvp.qty, Math.ceil((16 * 13 - 20) * 1.1), 1), 'LVP qty with 10% waste', lvp && lvp.qty);
const lab = items.find((i) => i.cat === 'labor' && i.baseCost >= 1); const ri = regionIndex({ zip: '78701' }); ok(near(lab.unitCost, lab.baseCost * ri.labor, 0.006), 'labor regional index applied', `${lab.baseCost} × ${ri.labor} → ${lab.unitCost}`);
const T = totals(project.estimate);
const sumLines = items.reduce((s, i) => s + lineTotal(i), 0); ok(near(T.cost, sumLines), 'cost equals line sum');
ok(near(T.subtotal, T.cost + T.materialMarkup + T.laborMarkup), 'subtotal');
ok(near(T.preTax, T.subtotal + T.overhead + T.profit), 'preTax');
ok(near(sumLines * T.sellFactor, T.preTax, 0.01), 'sellFactor reconciles inline pricing');
ok(near(T.total, T.preTax + T.tax) && T.tax > 0, 'total with tax'); ok(near(T.deposit, T.total * 0.3), 'deposit');
// user edit preservation
const first = items[0]; first.qty = 999; first.locked = true; const re = recompute(project, settings); ok(re.find((i) => i.key === first.key).qty === 999, 'locked edit preserved');
project.estimate.removedKeys.push(re[1].key); const re2 = recompute(project, settings); ok(!re2.find((i) => i.key === re[1].key), 'removed key stays removed');
// flags / upsells
const fl = flags(project, settings); ok(Array.isArray(fl), 'flags run'); const up = upsells(project); ok(up.length > 0 && up.every((u) => !keys.includes(u.key)), 'upsells exclude selected', up.map((u) => u.key).join(','));
// every assembly produces items
const FTu = 0.3048;
const kindAreas = { room: demo, roof: makeArea({ kind: 'roof', name: 'Roof', corners: makeRect(40 * FTu, 30 * FTu), roof: { pitch: 7, style: 'hip', stories: 2, layers: 1 } }), exterior: makeArea({ kind: 'exterior', name: 'House', corners: makeL(44 * FTu, 32 * FTu, 12 * FTu, 10 * FTu), ceilingHeight: 9 * FTu, openings: [{ type: 'door', wall: 0, offset: 1, width: 0.9144, height: 2.032 }, { type: 'window', wall: 2, offset: 1, width: 1.2, height: 1.2, sill: 0.9 }] }), flat: makeArea({ kind: 'flat', name: 'Patio', corners: makeRect(16 * FTu, 12 * FTu), flat: { use: 'deck', heightFt: 3, thicknessIn: 4 } }), linear: makeArea({ kind: 'linear', name: 'Fence', linear: { length: 150 * FTu, gates: 2, turns: 3 } }) };
for (const a of ASSEMBLIES) { const k = (a.kinds || ['room'])[0]; const pr = { ...project, rooms: [kindAreas[k]], estimate: { ...project.estimate, assemblies: [{ key: a.key, opts: {} }], items: [], removedKeys: [] } }; const its = takeoff(pr, settings); ok(its.length > 0 && its.every((i) => Number.isFinite(i.qty) && Number.isFinite(i.unitCost) && i.unitCost >= 0), `assembly ${a.key} (${k}) produces finite items`, JSON.stringify(its.slice(0, 2))); }
{ const pr = { ...project, rooms: [demo], estimate: { ...project.estimate, assemblies: [{ key: 'roof_shingles', opts: {} }], items: [], removedKeys: [] } }; ok(takeoff(pr, settings).length === 0, 'roof work item produces nothing without a roof measurement'); }
console.log(`\nunit tests: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;

// ---- AI assist
import { normalizeResult, buildUserContent, buildTextPrompt, RESULT_SCHEMA, estimateCost, SYSTEM_PROMPT } from '../js/pricing/ai-prompt.js';
import { runAI, buildRequest, aiStatus } from '../js/pricing/ai.js';
import { makeZip } from '../js/zip.js';
import { createRequire } from 'module';
{
  let p2 = 0, f2 = 0; const ok2 = (c, m, x = '') => { if (c) p2++; else { f2++; console.log('FAIL:', m, x); } };
  const n = normalizeResult({ scopeText: ' Scope. ', assemblies: [{ key: 'floor_lvp', reason: 'r', opts: [{ key: 'grade', value: '4.99' }, { key: 'waste', value: '0.15' }, { key: 'underlayment', value: 'true' }, { key: 'bogus', value: '1' }] }, { key: 'not_a_key', opts: [] }, { key: 'recessed', opts: [{ key: 'count', value: '6' }] }, { key: 'floor_lvp', opts: [] }], customItems: [{ name: 'Subfloor repair', cat: 'labor', unit: 'hr', qty: 3, unitCost: 65, note: '' }, { name: 'bad', cat: 'labor', unit: 'hr', qty: 0, unitCost: 1 }], flags: ['f1'], upsells: [{ key: 'baseboard', reason: 'y' }, { key: 'floor_lvp', reason: 'dup' }, { key: 'zzz', reason: '' }], assumptions: ['a'], confidence: 'high' });
  ok2(n.scopeText === 'Scope.' && n.assemblies.length === 2 && n.assemblies[0].opts.grade === 4.99 && n.assemblies[0].opts.waste === 0.15 && n.assemblies[0].opts.underlayment === true && !('bogus' in n.assemblies[0].opts) && n.assemblies[1].opts.count === 6, 'normalize coerces + filters', JSON.stringify(n.assemblies));
  ok2(n.customItems.length === 1 && n.upsells.length === 1 && n.upsells[0].key === 'baseboard' && n.confidence === 'high', 'normalize custom/upsells');
  ok2(normalizeResult('```json\n{"scopeText":"x","assemblies":[],"customItems":[],"flags":[],"upsells":[],"assumptions":[],"confidence":"low"}\n```').confidence === 'low', 'normalize strips code fence');
  const content = buildUserContent({ scopeText: 'paint', photos: ['data:image/jpeg;base64,/9j/4AAQ', 'not-a-photo'], rooms: [demo], units: 'imperial', region: { label: 'Austin, TX' }, selected: ['paint_walls'] });
  ok2(content.length === 2 && content[0].type === 'image' && content[0].source.media_type === 'image/jpeg' && content[1].type === 'text' && content[1].text.includes('Austin'), 'user content: images then brief');
  ok2(buildTextPrompt({ scopeText: 'x', rooms: [], units: 'imperial' }).includes('"confidence"') && SYSTEM_PROMPT.includes('floor_lvp'), 'text prompt embeds schema + catalog');
  ok2(RESULT_SCHEMA.required.length === 7 && RESULT_SCHEMA.properties.assemblies.items.properties.key.enum.includes('paint_walls'), 'schema sane');
  ok2(Math.abs(estimateCost({ input_tokens: 1_000_000, output_tokens: 100_000 }, 'claude-opus-5-5') - 6) < 1e-6, 'cost math', estimateCost({ input_tokens: 1_000_000, output_tokens: 100_000 }, 'claude-opus-5-5'));
  ok2(aiStatus({ ai: {} }).ready === false && aiStatus({ ai: { apiKey: 'k' } }).provider === 'sdk' && aiStatus({ ai: { apiKey: 'k', endpoint: 'https://x' } }).provider === 'endpoint', 'aiStatus precedence');
  const req = buildRequest('claude-opus-5-5', { scopeText: 'x', photos: [], rooms: [demo], units: 'imperial', region: null, selected: [] });
  ok2(req.fallbacks === 'default' && req.betas.includes('server-side-fallback-2026-07-01') && req.output_config.format.type === 'json_schema' && req.output_config.effort === 'high' && req.system[0].cache_control.type === 'ephemeral' && req.max_tokens === 16000 && !('thinking' in req), 'request shape');
  const zip = makeZip([{ name: 'a.txt', data: 'hello' }, { name: 'b.bin', data: new Uint8Array([1, 2, 3]) }]); const zb = new Uint8Array(await zip.arrayBuffer());
  ok2(zb[0] === 0x50 && zb[1] === 0x4b && zb.length > 100 && zb.slice(-22)[0] === 0x50, 'zip structure', zb.length);
  // real SDK class, fake transport
  let Anthropic = null; for (const base of ['/home/user/roompilot/', '/tmp/sdk/']) { try { Anthropic = createRequire(base).call(null, '@anthropic-ai/sdk').default; break; } catch {} }
  if (!Anthropic) console.log('(skipping SDK transport test: @anthropic-ai/sdk not installed)');
  else {
    const seen = {}; const canned = { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, content: [{ type: 'text', text: JSON.stringify({ scopeText: 'Remove carpet and install LVP.', assemblies: [{ key: 'demo_floor', reason: 'carpet visible', opts: [{ key: 'type', value: 'carpet' }] }, { key: 'floor_lvp', reason: '', opts: [] }], customItems: [{ name: 'Haul old furniture', cat: 'labor', unit: 'hr', qty: 2, unitCost: 55, note: '' }], flags: ['Subfloor condition unknown'], upsells: [{ key: 'baseboard', reason: 'new floors' }], assumptions: ['one room'], confidence: 'medium' }) }], usage: { input_tokens: 3000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
    const fakeFetch = async (url, init) => { seen.url = String(url); seen.headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])); if (init.headers && typeof init.headers.forEach === 'function') init.headers.forEach((v, k) => { seen.headers[k.toLowerCase()] = v; }); seen.body = JSON.parse(init.body); return new Response(JSON.stringify(canned), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } }); };
    const proj = { ...project, photos: ['data:image/png;base64,iVBORw0KGgo='], estimate: { ...project.estimate, assemblies: [], items: [], scopeText: 'old carpet out, lvp in' } };
    const res = await runAI({ project: proj, settings: { ...settings, ai: { apiKey: 'sk-ant-test', model: 'claude-opus-5-5' } }, inject: { Anthropic, clientOptions: { fetch: fakeFetch, maxRetries: 0 } } });
    ok2(/\/v1\/messages(\?|$)/.test(seen.url), 'SDK posts to /v1/messages', seen.url);
    ok2((seen.headers['x-api-key'] === 'sk-ant-test' || seen.headers['authorization'] === 'Bearer sk-ant-test') && String(seen.headers['anthropic-beta'] || '').includes('server-side-fallback-2026-07-01') && seen.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'SDK headers (key, beta, browser flag)', JSON.stringify(seen.headers));
    ok2(seen.body.model === 'claude-opus-5-5' && seen.body.fallbacks === 'default' && seen.body.output_config.format.type === 'json_schema' && seen.body.messages[0].content[0].type === 'image' && seen.body.messages[0].content[1].text.includes('old carpet out'), 'SDK body', JSON.stringify(seen.body).slice(0, 200));
    ok2(res.provider === 'sdk' && res.assemblies.length === 2 && res.assemblies[0].opts.type === 'carpet' && res.customItems.length === 1 && res.flags.length === 1 && Math.abs(res.cost - (3000 * 4 + 500 * 20) / 1e6) < 1e-9, 'runAI result + cost', JSON.stringify({ a: res.assemblies, c: res.cost }));
    const refusing = async () => new Response(JSON.stringify({ ...canned, stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: 'nope' }, content: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    let code = null; try { await runAI({ project: proj, settings: { ...settings, ai: { apiKey: 'k' } }, inject: { Anthropic, clientOptions: { fetch: refusing, maxRetries: 0 } } }); } catch (e) { code = e.code; } ok2(code === 'refused', 'refusal surfaces', code);
    const unauthorized = async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } });
    code = null; try { await runAI({ project: proj, settings: { ...settings, ai: { apiKey: 'bad' } }, inject: { Anthropic, clientOptions: { fetch: unauthorized, maxRetries: 0 } } }); } catch (e) { code = e.code; } ok2(code === 'auth', 'typed auth error mapped', code);
  }
  console.log(`ai tests: ${p2} passed, ${f2} failed`); if (f2) process.exitCode = 1;
}

// ---- camera-scan trigonometry (W3C DeviceOrientation: R = Rz(alpha)·Rx(beta)·Ry(gamma); rear camera = −z)
import { cameraDir, floorPoint } from '../js/scanner/gyro.js';
{
  let p3 = 0, f3 = 0; const ok3 = (c, m, x = '') => { if (c) p3++; else { f3++; console.log('FAIL:', m, x); } };
  const nr = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
  let d = cameraDir(0, 90, 0); ok3(nr(d.E, 0) && nr(d.N, 1) && nr(d.U, 0), 'upright portrait facing north looks north', JSON.stringify(d));
  d = cameraDir(0, 0, 0); ok3(nr(d.U, -1), 'flat face-up looks straight down', JSON.stringify(d));
  d = cameraDir(90, 90, 0); ok3(nr(d.E, -1) && nr(d.N, 0), 'alpha 90 (turned left) looks west', JSON.stringify(d));
  d = cameraDir(0, 60, 0); ok3(nr(d.U, -0.5) && nr(d.N, Math.sqrt(3) / 2), 'beta 60 looks 30° below horizon', JSON.stringify(d));
  const h = 1.45; const fp = floorPoint(cameraDir(0, 60, 0), h); ok3(fp && nr(fp.d, h / Math.tan(Math.PI / 6), 1e-9) && nr(fp.x, 0, 1e-9) && fp.z < 0, 'floor distance = h / tan(depression), north is −z in plan', JSON.stringify(fp));
  ok3(floorPoint(cameraDir(0, 90, 0), h) === null, 'horizon aim returns null');
  ok3(floorPoint(cameraDir(0, 100, 0), h) === null, 'aim above horizon returns null');
  // reconstruct a 4 m × 3 m room from four simulated aims taken from its center
  const Hc = 1.5, corners = [{ x: -2, z: -1.5 }, { x: 2, z: -1.5 }, { x: 2, z: 1.5 }, { x: -2, z: 1.5 }];
  const aimAt = (p) => { const dist = Math.hypot(p.x, p.z); const dep = Math.atan2(Hc, dist); const bearing = Math.atan2(p.x, -p.z); return { alpha: (-bearing * 180) / Math.PI, beta: 90 - (dep * 180) / Math.PI, gamma: 0 }; };
  const rec = corners.map((c) => { const a = aimAt(c); return floorPoint(cameraDir(a.alpha, a.beta, a.gamma), Hc); });
  ok3(rec.every((r, i) => r && nr(r.x, corners[i].x, 1e-9) && nr(r.z, corners[i].z, 1e-9)), 'four aims reconstruct the room exactly', JSON.stringify(rec.map((r) => r && [r.x.toFixed(3), r.z.toFixed(3)])));
  console.log(`scanner math tests: ${p3} passed, ${f3} failed`); if (f3) process.exitCode = 1;
}

// ---- v2 engine: pricing methods, suppliers, products, tiers, change orders, job plan, QuickBooks
import { markupFromMargin, marginFromMarkup, finishPrice, laborIndex } from '../js/pricing/profile.js';
import { parsePriceList } from '../js/pricing/suppliers.js';
import { newProduct } from '../js/pricing/products.js';
import { recompute as recompute2, totals as totals2, ledger, coTotals, jobPlan, quickBooksCSV, lineHours } from '../js/pricing/estimator.js';
import { generateTiers, tierSummary, applyChoice, addonPrices } from '../js/pricing/tiers.js';
{
  let p4 = 0, f4 = 0; const ok4 = (c, m, x = '') => { if (c) p4++; else { f4++; console.log('FAIL:', m, x); } }; const nr = (a, b, t = 0.011) => Math.abs(a - b) <= t;
  // pricing methods
  const base = { items: [{ cat: 'material', qty: 1, unitCost: 600 }, { cat: 'labor', qty: 10, unit: 'hr', unitCost: 40, hours: 10 }], adj: {} };
  let T = totals2({ ...base, adj: { method: 'margin', targetMargin: 35 } }); ok4(nr(T.preTax, 1000 / 0.65) && nr(T.grossMargin, 35, 0.01), 'margin method hits target margin', JSON.stringify({ p: T.preTax, m: T.grossMargin }));
  T = totals2({ ...base, adj: { method: 'margin', targetMargin: 35, rounding: 50 } }); ok4(T.preTax === 1550 && nr(T.adjustment, 1550 - 1000 / 0.65), 'rounding up to $50', T.preTax);
  T = totals2({ ...base, adj: { method: 'margin', targetMargin: 35, minJob: 2000 } }); ok4(T.preTax === 2000 && T.minApplied, 'minimum job charge', T.preTax);
  T = totals2({ ...base, adj: { method: 'rate', billRate: 95, materialMarkup: 20 } }); ok4(nr(T.preTax, 600 * 1.2 + 10 * 95) && nr(T.laborHours, 10), 'billable-rate method', T.preTax);
  T = totals2({ ...base, adj: { method: 'margin', targetMargin: 35, taxRate: 8, taxMaterialsOnly: true } }); ok4(nr(T.tax, 600 * T.sellFactor * 0.08), 'tax on grossed-up materials', T.tax);
  ok4(nr(markupFromMargin(35), 53.846, 0.01) && nr(marginFromMarkup(30), 23.077, 0.01), 'markup ↔ margin conversions');
  ok4(finishPrice(1000, { tripFee: 75 }).price === 1075, 'trip fee');
  // suppliers + products in recompute
  const st = { ...settings, region: { zip: '', state: 'US' }, priceList: parsePriceList('Item #,Description,UOM,Price\n77,Wax Ring with Horn,EA,4.10', 'ferguson') };
  const prj = { id: 'q', name: 'Bath', client: { name: 'C' }, rooms: [demo], photos: [], estimate: { number: 'EST-2', date: new Date().toISOString(), assemblies: [{ key: 'floor_lvp', opts: {} }, { key: 'paint_walls', opts: {} }], products: [newProduct('toilet', { id: 'tt', qty: 1 })], items: [], removedKeys: [], adj: { method: 'margin', targetMargin: 35, taxRate: 0 } } };
  recompute2(prj, st); const it = prj.estimate.items;
  const wax = it.find((i) => /Wax ring/.test(i.name)); ok4(wax && wax.supplierId === 'ferguson' && wax.unitCost === 4.1 && wax.priceSource === 'price list' && wax.sku === '77', 'price list applied to the matching line', JSON.stringify(wax));
  const bolts = it.find((i) => /Closet bolts/.test(i.name)); ok4(bolts && nr(bolts.unitCost, 6 * 0.95), 'Ferguson account factor applied', bolts && bolts.unitCost);
  const main = it.find((i) => i.key === 'prod|tt|main'); ok4(main && nr(main.unitCost, 320 * 0.95) && main.supplierId === 'ferguson' && main.priceSource === 'catalog', 'product main line priced through the supplier account factor', JSON.stringify(main));
  const plumberHrs = it.filter((i) => i.cat === 'labor' && i.ltrade === 'plumber').reduce((s, i) => s + lineHours(i), 0); ok4(nr(plumberHrs, 0.6 + 1.25 + 0.5), 'labor hours by trade', plumberHrs);
  const lvpLabor = it.find((i) => i.assembly === 'floor_lvp' && i.cat === 'labor'); ok4(lvpLabor && lvpLabor.hours > 0 && lvpLabor.ltrade === 'flooring', 'assembly labor carries hours + trade', JSON.stringify(lvpLabor));
  // pin a supplier and survive recompute
  bolts.supplierId = 'homedepot'; bolts.supplierPinned = true; recompute2(prj, st); const bolts2 = prj.estimate.items.find((i) => /Closet bolts/.test(i.name)); ok4(bolts2.supplierId === 'homedepot' && nr(bolts2.unitCost, 6), 'pinned supplier survives recompute and reprices', JSON.stringify(bolts2));
  // own labor rates
  const own = { ...st, profile: { useOwnRates: true, rates: { plumber: 90 } } }; ok4(nr(laborIndex('plumber', own, null), 1.5), 'own plumber rate index'); recompute2(prj, own); const setLine = prj.estimate.items.find((i) => /Set toilet/.test(i.name)); ok4(setLine && setLine.unitCost === 90, 'own labor rate prices product labor', setLine && setLine.unitCost);
  // roof product linked to roof area
  const roofA = makeArea({ kind: 'roof', name: 'Roof', corners: makeRect(40 * FTu, 30 * FTu), roof: { pitch: 6, overhang: FTu, style: 'gable' } });
  const prjR = { ...prj, rooms: [roofA], estimate: { ...prj.estimate, assemblies: [], products: [newProduct('roof_system', { id: 'rf', areaId: roofA.id, qty: null })], items: [] } };
  recompute2(prjR, st); const bundles = prjR.estimate.items.find((i) => i.key === 'prod|rf|main'); ok4(bundles && bundles.qty === Math.ceil(15.0262 * 1.1 * 3), 'roof system bundles from the roof measurement', bundles && bundles.qty);
  ok4(prjR.estimate.items.some((i) => /Drip edge/.test(i.name) && i.supplierId === 'abc'), 'roofing parts sourced from ABC Supply');
  // tiers
  recompute2(prj, st); prj.estimate.tiers = generateTiers(prj); prj.estimate.tiers.addons = [{ key: 'crown', label: 'Crown molding' }];
  const sum = tierSummary(prj, st); ok4(sum[0].total < sum[1].total && sum[1].total < sum[2].total, 'good < better < best', sum.map((s) => Math.round(s.total)).join(' / '));
  ok4(sum[0].diffs.some((d) => /Luxury vinyl plank/.test(d)) && sum[2].diffs.some((d) => /Toilet/.test(d)), 'tier differences described', JSON.stringify(sum.map((s) => s.diffs)));
  const ap = addonPrices(prj, st); ok4(ap[0].price > 0, 'add-on priced as a delta', ap[0].price);
  applyChoice(prj, st, 'best', ['crown']); ok4(prj.estimate.tiers.chosen === 'best' && prj.estimate.assemblies.some((a) => a.key === 'crown') && nr(totals2(prj.estimate).total, sum[2].total + ap[0].price, 1), 'choosing Best + add-on bakes it in', totals2(prj.estimate).total);
  // change orders
  prj.estimate.signedTotal = 10000; prj.changeOrders = [{ id: 'c1', n: 1, title: 'Subfloor', status: 'approved', items: [{ cat: 'material', qty: 4, unitCost: 30 }, { cat: 'labor', qty: 3, unit: 'hr', unitCost: 60, hours: 3 }] }, { id: 'c2', n: 2, title: 'Extra outlet', status: 'sent', items: [{ cat: 'labor', qty: 1, unit: 'hr', unitCost: 72, hours: 1 }] }];
  const L = ledger(prj); const coT = coTotals(prj.changeOrders[0], prj.estimate).total; ok4(nr(L.original, 10000) && nr(L.approved, coT) && nr(L.revised, 10000 + coT) && L.pending > 0, 'change-order ledger', JSON.stringify(L));
  // job plan + QuickBooks
  const plan = jobPlan(prj, st); ok4(plan.trades.length > 1 && plan.crewDays > 0 && plan.suppliers.length > 1, 'job plan: trades, crew-days, suppliers', JSON.stringify({ t: plan.trades.map((t) => t.trade), d: plan.crewDays, s: plan.suppliers.map((s) => s.supplier.id) }));
  const qb = quickBooksCSV(prj); ok4(qb.startsWith('"InvoiceNo","Customer"') && qb.includes('CO #1') && !qb.includes('CO #2'), 'QuickBooks CSV includes approved change orders only');
  console.log(`v2 engine tests: ${p4} passed, ${f4} failed`); if (f4) process.exitCode = 1;
}
{ // a price the contractor typed in is used as-is (no supplier factor, no region)
  const st2 = { ...settings, region: { zip: '10001', state: 'NY' } }; const pj = { id: 'z', name: 'z', client: {}, rooms: [], photos: [], estimate: { assemblies: [], products: [newProduct('toilet', { id: 'fx', qty: 2, price: 412.5, productName: 'Kohler Cimarron', sku: 'K-3851' })], items: [], removedKeys: [], adj: {} } };
  recompute2(pj, st2); const m = pj.estimate.items.find((i) => i.key === 'prod|fx|main');
  console.log(m && m.unitCost === 412.5 && m.priceSource === 'your price' && m.name.includes('Kohler') && m.sku === 'K-3851' ? 'typed price kept: PASS' : 'typed price kept: FAIL ' + JSON.stringify(m)); if (!(m && m.unitCost === 412.5)) process.exitCode = 1;
}

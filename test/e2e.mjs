import { createRequire } from 'module'; import fs from 'fs';
const { chromium } = (() => { try { return createRequire(import.meta.url)('playwright'); } catch { return createRequire('/opt/node-tools/node_modules/')('playwright'); } })();
const OUT = new URL('../docs/screens', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', permissions: ['camera'] });
const page = await ctx.newPage();
const errors = [], warnings = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const expand = async (on) => { await page.evaluate((on) => { let st = document.getElementById('__expand'); if (!on) { st && st.remove(); return; } if (!st) { st = document.createElement('style'); st.id = '__expand'; document.head.append(st); } st.textContent = '#app{position:static!important;height:auto!important;max-width:none!important} .screen.active{overflow:visible!important;height:auto!important} .doc-screen{position:static!important} .doc-scroll{overflow:visible!important} .tabbar,.doc-actions{position:static!important}'; }, on); };
const full = async (name) => { await expand(true); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); await expand(false); };
const log = (...a) => console.log('•', ...a);

try {
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-home .hero'); await shot('01-home-empty'); log('home rendered');
// Scan tab + demo room
await page.click('.tabbar [data-tab="scan"]'); await page.waitForSelector('[data-act="demo"]'); await shot('02-scan-modes');
await page.click('[data-act="demo"]'); await page.waitForSelector('.sheet'); await page.waitForTimeout(300); await shot('03-review-room');
const wallsCount = await page.$$eval('.sheet .list .item', (els) => els.length); log('review sheet walls+openings rows:', wallsCount);
await page.click('.sheet button:has-text("Save room")'); await page.waitForSelector('#screen-model canvas'); await page.waitForSelector('.plan-wrap svg'); await page.waitForTimeout(1800); await shot('04-model-3d');
const glb = await page.evaluate(async () => (await window.__viewer.exportGLB()).byteLength); const obj = await page.evaluate(() => window.__viewer.exportOBJ().length); const stl = await page.evaluate(() => window.__viewer.exportSTL().byteLength); log('exports GLB bytes', glb, 'OBJ chars', obj, 'STL bytes', stl);
const snap = await page.evaluate(() => (window.__roompilot.store.activeRoom().snapshot || '').length); log('snapshot dataURL length', snap);
const stats = await page.$$eval('#screen-model .stat', (els) => els.map((e) => [...e.children].map((c) => c.textContent.trim()).join(' '))); log('model stats:', stats.join(' | '));
await page.click('[data-floor="lvp"]'); await page.click('[data-wall="#d9e4ec"]'); await page.waitForTimeout(600); await shot('05-model-finishes');
await page.click('[data-act="top"]'); await page.waitForTimeout(500); await shot('06-model-plan-view');
await full('07-model-full');
// Estimate
await page.click('.tabbar [data-tab="estimate"]'); await page.waitForSelector('#screen-estimate textarea');
await page.fill('#screen-estimate textarea', 'Remove the old carpet, install LVP flooring, new 5 1/4 baseboard, paint walls and ceiling two coats, add 6 recessed lights, replace 2 interior doors.');
await page.click('#screen-estimate [data-act="build"]'); await page.waitForSelector('#screen-estimate .line'); await page.waitForTimeout(300);
const nLines = await page.$$eval('#screen-estimate .line', (els) => els.length); const chips = await page.$$eval('#screen-estimate .chips .chip.on', (els) => els.map((e) => e.textContent.trim())); const grand = await page.textContent('#screen-estimate .trow.grand span:last-child'); log('estimate lines', nLines, 'assemblies', chips.join(', '), 'TOTAL', grand);
await shot('08-estimate-top'); await full('09-estimate-full');
// edit a line
await page.click('#screen-estimate .line'); await page.waitForSelector('.sheet input[data-f="qty"]'); await page.fill('.sheet input[data-f="qty"]', '500'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(300);
const grand2 = await page.textContent('#screen-estimate .trow.grand span:last-child'); log('after editing first line qty→500, TOTAL', grand2, grand2 !== grand ? '(changed ✓)' : '(UNCHANGED ✗)');
// client
await page.click('[data-act="client"]'); await page.waitForSelector('.sheet input[data-f="name"]'); await page.fill('.sheet input[data-f="name"]', 'Dana Whitfield'); await page.fill('.sheet input[data-f="address"]', '412 Maple Ct, Austin, TX 78701'); await page.fill('.sheet input[data-f="email"]', 'dana@example.com'); await page.fill('.sheet input[data-f="pname"]', 'Whitfield bedroom refresh'); await page.click('.sheet button:has-text("Save")'); await page.waitForTimeout(300);
// settings: company + zip
await page.click('.tabbar [data-tab="settings"]'); await page.waitForSelector('#screen-settings input');
await page.fill('#screen-settings input[placeholder="Acme Remodeling LLC"]', 'Hill Country Interiors'); await page.press('#screen-settings input[placeholder="Acme Remodeling LLC"]', 'Tab');
await page.fill('#screen-settings input[placeholder="e.g. 78701"]', '78701'); await page.press('#screen-settings input[placeholder="e.g. 78701"]', 'Tab'); await page.waitForTimeout(200);
const regionTxt = await page.textContent('#screen-settings p.muted:has-text("Index for")'); log('region:', regionTxt.replace(/\s+/g, ' ')); await shot('10-settings'); await full('11-settings-full');
// document
await page.click('.tabbar [data-tab="estimate"]'); await page.waitForSelector('[data-act="preview"]'); await page.click('[data-act="preview"]'); await page.waitForSelector('.doc'); await page.waitForTimeout(400); await shot('12-document-top'); await full('13-document-full');
const docTotal = await page.$$eval('.doc .doc-totals .grand span', (els) => els.map((e) => e.textContent)); const docStamp = await page.textContent('.doc .stamp'); log('document stamp', docStamp, 'totals', docTotal.join(' / '));
const nFig = await page.$$eval('.doc .figures svg, .doc .figures img', (els) => els.length); log('document figures (plan svg + 3d snapshot):', nFig);
// print layout
await page.emulateMedia({ media: 'print' }); await page.screenshot({ path: `${OUT}/14-print-preview.png`, fullPage: true }); await page.emulateMedia({ media: 'screen' });
// sign
await page.click('[data-act="sign"]'); await page.waitForSelector('.sigpad'); await page.fill('.sheet input[data-f="name"]', 'Dana Whitfield');
const sig = await page.$('.sigpad'); const bb = await sig.boundingBox(); await page.mouse.move(bb.x + 20, bb.y + 80); await page.mouse.down(); for (let i = 0; i < 30; i++) await page.mouse.move(bb.x + 20 + i * 8, bb.y + 80 + Math.sin(i / 3) * 30); await page.mouse.up(); await shot('15-signature-pad');
await page.click('.sheet button:has-text("Accept & sign")'); await page.waitForTimeout(400); const stamp2 = await page.textContent('.doc .stamp'); const hasSigImg = await page.$('.doc .sig img'); log('after signing stamp', stamp2, 'signature image', !!hasSigImg); await shot('16-document-signed');
// share link round-trip
const link = await page.evaluate(async () => { const m = await import('./js/document.js'); return m.buildShareLink(window.__roompilot.store.activeProject(), window.__roompilot.store.settings); }); log('share link length', link.length);
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errors.push('p2 pageerror: ' + e.message)); await p2.goto(link, { waitUntil: 'networkidle' }); await p2.waitForSelector('.sheet'); await p2.screenshot({ path: `${OUT}/17-shared-link-open.png` }); await p2.click('.sheet button:has-text("Open")'); await p2.waitForSelector('.doc'); const sharedTotal = await p2.$$eval('.doc .doc-totals .grand span', (els) => els.map((e) => e.textContent)); log('shared link document totals', sharedTotal.join(' / ')); await ctx2.close();
// invoice + payment
await page.click('[data-act="invoice"]'); await page.waitForSelector('.sheet'); await page.click('.sheet button:has-text("Create invoice")'); await page.waitForSelector('.doc-bar b:has-text("Invoice")'); await page.waitForTimeout(300); const invStamp = await page.textContent('.doc .stamp'); log('invoice stamp', invStamp);
await page.click('[data-act="pay"]'); await page.waitForSelector('.sheet input[data-f="amount"]'); await page.click('.sheet [data-q="deposit"]'); await page.click('.sheet button:has-text("Save payment")'); await page.waitForTimeout(300); const bal = await page.$$eval('.doc .doc-totals .grand', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' '))); log('invoice after deposit:', bal.join(' | ')); await full('18-invoice-full');
await page.click('[data-act="pay"]'); await page.waitForSelector('.sheet input[data-f="amount"]'); await page.click('.sheet [data-q="full"]'); await page.click('.sheet button:has-text("Save payment")'); await page.waitForTimeout(300); log('after full payment stamp', await page.textContent('.doc .stamp'));
await page.click('.doc-bar [data-act="close"]'); await page.waitForTimeout(300);
// home with project
await page.click('.tabbar [data-tab="home"]'); await page.waitForSelector('[data-open]'); await shot('19-home-projects');
// manual entry: L-shape
await page.click('.tabbar [data-tab="scan"]'); await page.click('[data-act="manual"]'); await page.waitForSelector('.sheet .seg'); await page.click('.sheet .seg button:has-text("L-shape")'); await shot('20-manual-dimensions'); await page.click('.sheet button:has-text("Continue")'); await page.waitForSelector('.sheet button:has-text("Save room")');
await page.click('.sheet [data-act="add-door"]'); await page.waitForSelector('.sheet .sheet-body select[data-f="wall"]'); await page.locator('.sheet-backdrop').last().locator('button:has-text("Save")').click(); await page.waitForTimeout(200);
await page.click('.sheet button:has-text("Save room")'); await page.waitForSelector('#screen-model canvas'); await page.waitForTimeout(800);
const rooms = await page.evaluate(() => window.__roompilot.store.activeProject().rooms.map((r) => `${r.name}:${r.corners.length}c/${r.openings.length}o`)); log('rooms now', rooms.join(', ')); await shot('21-model-lshape');
// draw editor
await page.click('.tabbar [data-tab="scan"]'); await page.click('[data-act="manual"]'); await page.waitForSelector('.sheet'); await page.click('.sheet button:has-text("Draw a custom outline")'); await page.waitForSelector('.plan-editor canvas'); await page.waitForTimeout(300);
const cv = await page.$('.plan-editor canvas'); const cb = await cv.boundingBox(); for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.8, 0.7], [0.5, 0.7], [0.5, 0.5], [0.2, 0.5]]) { await page.mouse.click(cb.x + cb.width * fx, cb.y + cb.height * fy); await page.waitForTimeout(80); } await shot('22-draw-editor');
await page.click('[data-act="done"]'); await page.waitForSelector('.sheet button:has-text("Save room")'); const drawnCorners = await page.$$eval('.sheet .list .item', (els) => els.length); log('drawn room rows in review', drawnCorners); await page.click('.sheet button:has-text("Discard")');
// camera scan overlay (fake camera) — verifies the HUD mounts and exits cleanly
await page.click('[data-act="camera"]'); await page.waitForSelector('.fullscreen .shutter'); await page.waitForTimeout(900); await shot('23-camera-scan-hud'); await page.click('.fullscreen [data-act="exit"]'); await page.waitForTimeout(200);
// quick measure
await page.click('[data-act="measure"]'); await page.waitForSelector('.fullscreen .shutter'); await page.waitForTimeout(400); await shot('24-quick-measure'); await page.click('.fullscreen [data-act="exit"]');
// dark mode
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', storageState: await ctx.storageState() }); const p3 = await ctx3.newPage(); await p3.goto(BASE + '#/estimate', { waitUntil: 'networkidle' }); await p3.waitForTimeout(600); await p3.screenshot({ path: `${OUT}/25-dark-estimate.png` }); await ctx3.close();
// ---- simulated Claude artifact runtime: sample (AI) + downloads capabilities
{
  const fakeRuntime = () => {
    const canned = { scopeText: 'Remove the existing carpet, install luxury vinyl plank with new baseboard, paint walls and ceiling, and add recessed lighting.', assemblies: [{ key: 'demo_floor', reason: 'carpet in photos', opts: [{ key: 'type', value: 'carpet' }] }, { key: 'floor_lvp', reason: '', opts: [{ key: 'grade', value: '3.49' }] }, { key: 'baseboard', reason: '', opts: [] }, { key: 'paint_walls', reason: '', opts: [] }, { key: 'recessed', reason: '', opts: [{ key: 'count', value: '6' }] }, { key: 'dumpster', reason: '', opts: [] }], customItems: [{ name: 'Haul away old furniture', cat: 'labor', unit: 'hr', qty: 2, unitCost: 55, note: 'two movers' }], flags: ['Subfloor condition under the carpet is unknown', 'Ceiling height was assumed'], upsells: [{ key: 'paint_trim', reason: 'fresh walls need matching trim' }], assumptions: ['Single room; no plumbing or structural work'], confidence: 'medium' };
    const sample = async () => ({ text: JSON.stringify(canned), truncated: false, modelTierApplied: 'complex' });
    sample.json = async (prompt, opts) => { window.__samplePrompt = prompt; window.__sampleOpts = { images: opts && opts.images ? opts.images.length : 0, modelTier: opts && opts.modelTier }; return canned; };
    sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 6, maxInputBytes: 20000000, mediaTypes: ['image/jpeg', 'image/png'] } });
    const downloads = { save: async ({ filename, data }) => { window.__saved = (window.__saved || []).concat([{ filename, size: data.size || data.byteLength || String(data).length }]); return { status: 'saved' }; } };
    window.claude = { use: async (name) => (name === 'sample' ? sample : name === 'downloads' ? downloads : null) };
  };
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  await ctxA.addInitScript(fakeRuntime);
  const pa = await ctxA.newPage(); pa.on('pageerror', (e) => errors.push('artifact-sim pageerror: ' + e.message)); pa.on('console', (m) => { if (m.type() === 'error') errors.push('artifact-sim console: ' + m.text()); });
  await pa.goto(BASE + '#/estimate', { waitUntil: 'networkidle' }); await pa.waitForSelector('[data-act="ai"]');
  const aiLabel = await pa.textContent('[data-act="ai"]'); log('AI button (artifact sim):', aiLabel.trim());
  // add a photo so the image path is exercised
  await pa.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#9b7853'; g.fillRect(0, 0, 64, 48); const p = window.__roompilot.store.activeProject(); p.photos.push(c.toDataURL('image/jpeg', 0.8)); window.__roompilot.store.update(() => {}, 'estimate'); });
  await pa.waitForTimeout(400); await pa.reload({ waitUntil: 'networkidle' }); await pa.waitForSelector('[data-act="ai"]');
  const before = await pa.$$eval('#screen-estimate .chips .chip.on', (els) => els.length);
  await pa.evaluate(() => { const p = window.__roompilot.store.activeProject(); p.estimate.assemblies = p.estimate.assemblies.filter((a) => a.key !== 'dumpster' && a.key !== 'recessed'); window.__roompilot.store.update(() => {}, 'estimate'); }); await pa.waitForTimeout(300); await pa.reload({ waitUntil: 'networkidle' }); await pa.waitForSelector('[data-act="ai"]');
  const photosNow = await pa.evaluate(() => window.__roompilot.store.activeProject().photos.length); log('photos on project before AI run', photosNow);
  await pa.click('[data-act="ai"]'); await pa.waitForSelector('#screen-estimate .flag', { timeout: 15000 }); await pa.waitForTimeout(400);
  const after = await pa.$$eval('#screen-estimate .chips .chip.on', (els) => els.map((e) => e.textContent.trim()));
  const aiOpts = await pa.evaluate(() => window.__sampleOpts); const scopeNow = await pa.inputValue('#screen-estimate textarea'); const customLine = await pa.$('#screen-estimate .line:has-text("Haul away old furniture")');
  log('AI merge: work items', before, '→', after.length, '| images sent', aiOpts && aiOpts.images, '| tier', aiOpts && aiOpts.modelTier, '| custom line present', !!customLine, '| scope now:', scopeNow.slice(0, 60) + '…');
  const aiReview = await pa.$$eval('#screen-estimate .flag', (els) => els.length); log('AI review flags rendered', aiReview);
  await pa.screenshot({ path: `${OUT}/26-ai-estimate.png` }); await pa.evaluate(() => { document.getElementById('screen-estimate').scrollTop = 900; }); await pa.screenshot({ path: `${OUT}/27-ai-review.png` });
  // downloads capability: GLB export gets zipped, SVG direct, PDF button saves HTML
  await pa.evaluate(() => window.__fullbid.navigate('model')); await pa.waitForSelector('#screen-model canvas'); await pa.waitForTimeout(800);
  await pa.click('[data-act="glb"]'); await pa.waitForTimeout(600); await pa.click('[data-act="svg"]'); await pa.waitForTimeout(300);
  await pa.click('.tabbar [data-tab="estimate"]'); await pa.waitForSelector('[data-act="preview"]'); await pa.click('[data-act="preview"]'); await pa.waitForSelector('.doc'); await pa.click('.doc-bar [data-act="print"]'); await pa.waitForTimeout(800);
  const saved = await pa.evaluate(() => window.__saved || []); log('artifact downloads:', saved.map((s) => `${s.filename} (${s.size} B)`).join(', '));
  if (!saved.some((s) => s.filename.endsWith('.zip')) || !saved.some((s) => s.filename.endsWith('.svg')) || !saved.some((s) => s.filename.endsWith('.html'))) errors.push('artifact downloads missing: ' + JSON.stringify(saved));
  const keysAfter = await pa.evaluate(() => window.__roompilot.store.activeProject().estimate.assemblies.map((a) => a.key + ':' + JSON.stringify(a.opts)));
  const wanted = ['demo_floor', 'floor_lvp', 'baseboard', 'paint_walls', 'recessed', 'dumpster'];
  if (!(wanted.every((k) => keysAfter.some((x) => x.startsWith(k + ':'))) && keysAfter.some((x) => x.startsWith('recessed:') && x.includes('"count":6')) && keysAfter.some((x) => x.startsWith('demo_floor:') && x.includes('carpet')) && aiOpts && aiOpts.images === 1 && customLine)) errors.push('AI merge assertion failed: ' + JSON.stringify({ keysAfter, aiOpts, customLine: !!customLine }));
  await ctxA.close();
}
// ---- own-key AI path: real vendored SDK bundle in Chromium, api.anthropic.com intercepted
{
  const ctxK = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const pk = await ctxK.newPage(); pk.on('pageerror', (e) => errors.push('own-key pageerror: ' + e.message));
  const captured = []; let mode = 'ok';
  const canned = { id: 'msg_e2e', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, stop_details: null,
    content: [{ type: 'text', text: JSON.stringify({ scopeText: 'Replace carpet with LVP, new baseboard, repaint walls and ceiling.', assemblies: [{ key: 'floor_lvp', reason: 'carpet worn', opts: [{ key: 'grade', value: '3.49' }] }, { key: 'baseboard', reason: '', opts: [] }, { key: 'popcorn', reason: 'textured ceiling visible', opts: [] }], customItems: [{ name: 'Repair water-damaged subfloor (allowance)', cat: 'labor', unit: 'ls', qty: 1, unitCost: 450, note: 'stain under window' }], flags: ['Possible water damage near the window — confirm subfloor before pricing final'], upsells: [{ key: 'paint_ceiling', reason: 'scraped ceiling needs paint' }], assumptions: ['Existing baseboard is removable'], confidence: 'high' }) }],
    usage: { input_tokens: 5200, output_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
  await pk.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    captured.push({ url: req.url(), headers: req.headers(), body: JSON.parse(req.postData() || '{}') });
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', 'content-type': 'application/json', 'request-id': 'req_e2e' };
    if (mode === 'unauthorized') return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(canned) });
  });
  await pk.goto(BASE + '#/settings', { waitUntil: 'networkidle' }); await pk.waitForSelector('input[placeholder="sk-ant-…"]');
  await pk.fill('input[placeholder="sk-ant-…"]', 'sk-ant-e2e-test'); await pk.press('input[placeholder="sk-ant-…"]', 'Tab'); await pk.waitForTimeout(300);
  const statusPill = await pk.textContent('[data-role="ai-status"]'); log('AI status after key:', statusPill.trim());
  await pk.screenshot({ path: `${OUT}/28-settings-ai.png` });
  const backupKey = await pk.evaluate(() => JSON.parse(window.__roompilot.store.exportJSON()).settings.ai.apiKey); log('API key in backup export:', JSON.stringify(backupKey));
  if (backupKey !== '') errors.push('API key leaked into backup');
  await pk.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#8f919c'; g.fillRect(0, 0, 64, 48); const p = window.__roompilot.store.activeProject(); p.photos.push(c.toDataURL('image/jpeg', 0.8)); window.__roompilot.store.update(() => {}, 'estimate'); }); await pk.waitForTimeout(300);
  await pk.click('.tabbar [data-tab="estimate"]'); await pk.waitForSelector('[data-act="ai"]');
  await pk.click('[data-act="ai"]'); await pk.waitForSelector('#screen-estimate .line:has-text("Repair water-damaged subfloor")', { timeout: 20000 }); await pk.waitForTimeout(300);
  const c0 = captured[0] || { headers: {}, body: {} }; const b = c0.body;
  const hdrOk = c0.headers['authorization'] === 'Bearer sk-ant-e2e-test' && c0.headers['anthropic-dangerous-direct-browser-access'] === 'true' && String(c0.headers['anthropic-beta'] || '').includes('server-side-fallback-2026-07-01') && c0.headers['anthropic-version'];
  const parts = { model: b.model === 'claude-opus-5-5', fallbacks: b.fallbacks === 'default', format: !!(b.output_config && b.output_config.format && b.output_config.format.type === 'json_schema'), effort: !!(b.output_config && b.output_config.effort === 'high'), image: !!(Array.isArray(b.messages) && b.messages[0].content.some((x) => x.type === 'image')), brief: !!(Array.isArray(b.messages) && b.messages[0].content.some((x) => x.type === 'text' && x.text.includes('Job brief'))), noThinkingParam: !('thinking' in b), cachedSystem: !!(Array.isArray(b.system) && b.system[0].cache_control) };
  const bodyOk = Object.values(parts).every(Boolean); if (!bodyOk) log('body parts:', JSON.stringify(parts));
  log('own-key request:', c0.url, '| headers ok', !!hdrOk, '| body ok', !!bodyOk, '| images', (b.messages ? b.messages[0].content.filter((x) => x.type === 'image').length : 0), '| version', c0.headers['anthropic-version']);
  const costTxt = await pk.$eval('#screen-estimate', (el) => (el.textContent.match(/≈ \$[0-9.,]+/) || [''])[0]); const popcorn = await pk.$('#screen-estimate .chip.on:has-text("Popcorn")');
  log('own-key result: popcorn chip', !!popcorn, '| cost shown', costTxt);
  if (!hdrOk || !bodyOk || !popcorn || !costTxt) errors.push('own-key AI assertions failed: ' + JSON.stringify({ hdrOk: !!hdrOk, bodyOk: !!bodyOk, popcorn: !!popcorn, costTxt }));
  await pk.screenshot({ path: `${OUT}/29-ai-own-key-result.png` });
  mode = 'unauthorized'; await pk.reload({ waitUntil: 'networkidle' }); await pk.waitForSelector('[data-act="ai"]'); await pk.click('[data-act="ai"]'); await pk.waitForSelector('.toast:has-text("Invalid API key")', { timeout: 15000 }); log('401 → toast "Invalid API key" shown');
  await ctxK.close();
}
// service worker registered?
const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length); log('service worker registrations', sw);
} catch (e) { console.log('\nE2E FAILURE:', e.message.split('\n')[0]); try { await page.screenshot({ path: `${OUT}/zz-failure.png` }); } catch {} errors.push('e2e: ' + e.message.split('\n')[0]); }
await browser.close();
console.log('\nWARNINGS (first 5):'); warnings.slice(0, 5).forEach((w) => console.log('  ', w.slice(0, 200)));
console.log('\nERRORS:', errors.length); errors.forEach((e) => console.log('  ', e.slice(0, 400)));
process.exit(errors.length ? 1 : 0);

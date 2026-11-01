// "smart estimate": plain-language scope → assemblies, missing-detail flags, upsells, voice input
import { ASSEMBLIES, ASSEMBLY_MAP } from './catalog.js';
import { kindOf, KINDS } from '../geometry.js';

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1, single: 1, couple: 2, dozen: 12 };
const norm = (t) => ' ' + String(t || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'"\s\-\.]/g, ' ').replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|single|couple|dozen)\b/g, (w) => WORDS[w]).replace(/\s+/g, ' ') + ' ';
const has = (t, kw) => new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es|ing|ed)?([^a-z]|$)`).test(t);

const COUNT_TARGETS = [
  [/(\d+)\s*(recessed|can light|pot light|downlight|led light|wafer)/, 'recessed', 'count'],
  [/(\d+)\s*(outlet|receptacle|plug)/, 'outlets', 'outlets'],
  [/(\d+)\s*(switch)/, 'outlets', 'switches'],
  [/(\d+)\s*(interior )?(door)/, 'interior_door', 'count'],
  [/(\d+)\s*(window)/, 'window_replace', 'count'],
  [/(\d+)\s*(patch|hole)/, 'drywall_repair', 'count'],
  [/(\d+)\s*(ceiling fan|fan|fixture|pendant|chandelier)/, 'ceiling_fan', 'count'],
  [/(\d+)\s*(lf|linear feet|linear ft|feet|ft)\s*(of )?(cabinet)/, 'cabinets', 'lf'],
  [/(\d+)\s*(sf|sq ?ft|square feet)\s*(of )?(backsplash)/, 'backsplash', 'sf'],
  [/(\d+)\s*(sf|sq ?ft|square feet)\s*(of )?(shower|tile shower)/, 'tile_shower', 'sf'],
  [/(\d+)\s*(lf|linear feet|feet|ft)\s*(of )?(new )?(wall|framing|partition)/, 'framing', 'lf'],
  [/(\d+)\s*(hour|hr)s?\s*(of )?(demo)/, 'demo_general', 'hours'],
];

/** Parse a plain-language description into assembly selections with options. */
export function parseScope(text) {
  const t = norm(text);
  const picked = new Map();
  const add = (key, opts = {}) => { if (!ASSEMBLY_MAP[key]) return; const cur = picked.get(key) || { key, opts: {} }; cur.opts = { ...cur.opts, ...opts }; picked.set(key, cur); };
  for (const a of ASSEMBLIES) for (const kw of a.keywords || []) if (has(t, kw)) { add(a.key); break; }
  const NEG = "(no|not|don't|dont|without|skip|except|excluding|exclude|minus|leave|keep)\\s+(the\\s+|any\\s+|a\\s+|existing\\s+)?";
  const negated = (word) => new RegExp(`${NEG}${word}`).test(t);
  // "remove / old / existing <floor type>" describes the floor being torn out, not the new floor
  const REMOVAL = '(remov\\w*|replac\\w*|tear\\w*( out| up)?|rip\\w*( up| out)?|pull\\w*( up| out)?|demo\\w*|old|existing|current)\\s+(the\\s+|all\\s+|of\\s+)?(old\\s+|existing\\s+)?';
  const FLOOR_KW = { floor_carpet: ['carpet', 'carpeting'], floor_tile: ['tile', 'tiles'], floor_hardwood: ['hardwood', 'wood floor', 'wood floors'], floor_laminate: ['laminate'], floor_lvp: ['vinyl', 'lvp', 'lvt', 'linoleum'] };
  const DEMO_TYPE = { floor_carpet: 'carpet', floor_tile: 'tile', floor_hardwood: 'hardwood', floor_laminate: 'vinyl', floor_lvp: 'vinyl' };
  let existingFloor = null;
  for (const [key, kws] of Object.entries(FLOOR_KW)) for (const kw of kws) if (new RegExp(`${REMOVAL}${kw}`).test(t)) { existingFloor = existingFloor || DEMO_TYPE[key]; if (!new RegExp(`(install\\w*|new|lay\\w*|put\\w* (in|down)|replace\\w* with)\\s+(\\w+\\s+){0,3}${kw}`).test(t)) picked.delete(key); }
  if (existingFloor) add('demo_floor', { type: existingFloor });
  // "paint walls and ceiling": ceiling mentioned in a paint context (but not "ceiling fan" / "drywall ceiling" / "popcorn ceiling")
  const ceilingMentioned = /(?<!drywall |popcorn |new )ceilings?(?! fan)/.test(t);
  if (picked.has('paint_walls') && ceilingMentioned && !picked.has('paint_ceiling') && !negated('ceilings?')) add('paint_ceiling');
  if (/\bwhole room\b|\beverything\b|\bentire room\b/.test(t) && picked.has('paint_walls')) { add('paint_ceiling'); add('paint_trim'); }
  if (/\bdoors?\b/.test(t) && !/(replace|new|install|prehung|paint)\w*\s+(the\s+)?(\d+\s+)?(interior\s+)?doors?/.test(t)) picked.delete('interior_door');
  if (/\bwindows?\b/.test(t) && !/(replace|new|install)\w*\s+(the\s+)?(\d+\s+)?windows?/.test(t)) picked.delete('window_replace');
  // negations: "no paint", "don't paint", "without painting", "no ceiling", "skip the trim"
  for (const a of ASSEMBLIES) for (const kw of a.keywords || []) if (negated(kw)) picked.delete(a.key);
  const CONCEPTS = { 'ceilings?': ['paint_ceiling', 'drywall_ceiling', 'popcorn'], 'trim': ['paint_trim'], 'baseboards?': ['baseboard'], 'doors?': ['interior_door', 'paint_doors', 'door_casing'], 'windows?': ['window_replace', 'window_trim'], 'floor(s|ing)?': ['floor_lvp', 'floor_laminate', 'floor_hardwood', 'floor_tile', 'floor_carpet', 'demo_floor'], 'permits?': ['permit'], 'dumpster': ['dumpster'], 'clean ?up': ['cleanup'], 'demo(lition)?': ['demo_general', 'demo_floor', 'demo_drywall'] };
  for (const [w, ks] of Object.entries(CONCEPTS)) if (negated(w)) ks.forEach((k) => picked.delete(k));
  // exterior disambiguation
  if (/(over|on top of|onto)\s+(the\s+|existing\s+)?concrete/.test(t) && !/(pour|new slab|slab|patio|sidewalk|walkway|flatwork)/.test(t)) picked.delete('concrete_slab');
  if (/asphalt shingle/.test(t)) picked.delete('asphalt_paving');
  if (picked.has('ext_paint') && !/(interior|inside|bedroom|kitchen|bath|living room|walls and ceiling|ceiling)/.test(t)) { picked.delete('paint_walls'); picked.delete('paint_ceiling'); }
  if (picked.has('roof_shingles') && /(ceiling|attic)/.test(t) && !/(shingle|reroof|re-roof|roof replacement|new roof|tear)/.test(t)) picked.delete('roof_shingles');
  if (picked.has('deck_build') && /(roof deck|roof decking|deck boards on the roof)/.test(t)) picked.delete('deck_build');
  if ((picked.has('roof_shingles') || picked.has('roof_tearoff')) && /(tear|strip|replace|reroof|re-roof|new roof)/.test(t)) add('roof_tearoff');
  // counts & measures
  for (const [re, key, opt] of COUNT_TARGETS) { const m = t.match(re); if (m) add(key, { [opt]: Number(m[1]) }); }
  // qualifiers
  const grade = /\b(premium|high[- ]end|luxury|best|top of the line|designer)\b/.test(t) ? 'best' : /\b(budget|basic|cheap|economy|builder[- ]grade|good enough)\b/.test(t) ? 'good' : null;
  if (grade) {
    if (picked.has('paint_walls')) add('paint_walls', { grade: grade === 'best' ? 'premium' : 'contractor' });
    if (picked.has('floor_lvp')) add('floor_lvp', { grade: grade === 'best' ? 4.99 : 2.49 });
    if (picked.has('floor_tile')) add('floor_tile', { grade: grade === 'best' ? 10 : 3.5 });
    if (picked.has('cabinets')) add('cabinets', { grade: grade === 'best' ? 600 : 185 });
    if (picked.has('baseboard')) add('baseboard', { profile: grade === 'best' ? 3.95 : 1.45 });
  }
  if (/\b1 coat\b|\bone coat\b|\bsingle coat\b/.test(t)) { if (picked.has('paint_walls')) add('paint_walls', { coats: 1 }); if (picked.has('paint_ceiling')) add('paint_ceiling', { coats: 1 }); }
  if (/\b(full|complete)\s+prim/.test(t)) add('paint_walls', { primer: 'full' });
  if (/\bno prim/.test(t) && picked.has('paint_walls')) add('paint_walls', { primer: 'none' });
  if (/diagonal|herringbone|chevron|pattern/.test(t)) { if (picked.has('floor_lvp')) add('floor_lvp', { waste: 0.15 }); if (picked.has('floor_tile')) add('floor_tile', { waste: 0.2 }); }
  if (/large[- ]format|24x24|24 x 24|12x24|12 x 24/.test(t) && picked.has('floor_tile')) add('floor_tile', { largeFormat: true });
  if (/solid hardwood|solid oak/.test(t)) add('floor_hardwood', { type: 'solid' }); if (/unfinished|site[- ]finish/.test(t) && picked.has('floor_hardwood')) add('floor_hardwood', { type: 'unfinished' });
  if (/knockdown/.test(t) && picked.has('drywall_walls')) add('drywall_walls', { texture: 'knockdown' }); if (/orange peel/.test(t) && picked.has('drywall_walls')) add('drywall_walls', { texture: 'orange' }); if (/level 5|skim/.test(t) && picked.has('drywall_walls')) add('drywall_walls', { finish: 5 });
  // existing floor type for demo
  const hasFloor = ['floor_lvp', 'floor_laminate', 'floor_hardwood', 'floor_tile', 'floor_carpet'].some((k) => picked.has(k));
  if (hasFloor && /(remove|tear|rip|existing|old|replace|demo)/.test(t) && !picked.has('demo_floor') && !negated('demo(lition)?')) add('demo_floor');
  if (picked.has('demo_floor') && !(picked.get('demo_floor').opts || {}).type) { const type = /old carpet|existing carpet|remove carpet|carpet/.test(t) && !picked.has('floor_carpet') ? 'carpet' : /old tile|existing tile|remove tile/.test(t) ? 'tile' : /old hardwood|existing hardwood|remove hardwood|old wood/.test(t) ? 'hardwood' : /old vinyl|existing vinyl|laminate|linoleum|remove vinyl/.test(t) ? 'vinyl' : null; if (type) add('demo_floor', { type }); }
  if (/toilet/.test(t)) add('bath_fixtures', { toilet: true }); if (/vanity|sink|faucet/.test(t)) add('bath_fixtures', { vanity: true }); if (/tub|shower valve/.test(t)) add('bath_fixtures', { tub: true }); if (/exhaust|bath fan/.test(t)) add('bath_fixtures', { exhaust: true });
  // dumpster implied by any demo
  if ([...picked.keys()].some((k) => k.startsWith('demo_') || k === 'popcorn' || k === 'cabinets') && !picked.has('dumpster') && !negated('dumpster')) add('dumpster');
  return { assemblies: [...picked.values()], matched: picked.size, text };
}

/** Missing-detail flags (level: warn | info). */
export function flags(project, settings) {
  const out = []; const est = project.estimate; const keys = new Set((est.assemblies || []).map((a) => a.key));
  const rooms = project.rooms || [];
  if (!rooms.length && !(est.products || []).length) out.push({ level: 'warn', msg: 'Nothing measured yet — quantities are zero until you measure an area or configure a product.', go: 'scan' });
  const kindsHave = new Set(rooms.map(kindOf)); const missing = new Map();
  for (const a of est.assemblies || []) { const def = ASSEMBLY_MAP[a.key]; if (!def || def.scope === 'project' || !rooms.length) continue; const ks = def.kinds || ['room']; if (!ks.some((k) => kindsHave.has(k))) missing.set(def.name, ks); }
  for (const [name, ks] of missing) out.push({ level: 'warn', msg: `${name} needs a measured ${ks.map((k) => KINDS[k].label.toLowerCase()).join(' or ')} — it has no quantities yet.`, go: 'scan' });
  for (const inst of est.products || []) if (!inst.ai && !inst.areaId && !(Number(inst.qty) > 0)) out.push({ level: 'warn', msg: 'A configured product has no quantity — link it to a measured area or enter a quantity.', go: 'build' });
  if (rooms.some((r) => r.ceilingAssumed)) out.push({ level: 'info', msg: `Ceiling height assumed at ${settings.units === 'metric' ? '2.44 m' : "8' 0\""} for ${rooms.filter((r) => r.ceilingAssumed).map((r) => r.name).join(', ')}. Measure it to tighten wall and paint quantities.`, go: 'model' });
  if (rooms.some((r) => kindOf(r) === 'room') && rooms.filter((r) => kindOf(r) === 'room').every((r) => !(r.openings || []).length)) out.push({ level: 'info', msg: 'No doors or windows marked. Wall area (paint, drywall) may be overstated and baseboard understated.', go: 'model' });
  if (!settings.region.zip && (!settings.region.state || settings.region.state === 'US')) out.push({ level: 'info', msg: 'Set your ZIP code in Settings for regional labor and material pricing.', go: 'settings' });
  const floors = ['floor_lvp', 'floor_laminate', 'floor_hardwood', 'floor_tile', 'floor_carpet'].filter((k) => keys.has(k));
  if (floors.length > 1) out.push({ level: 'warn', msg: `Multiple floor types selected (${floors.map((k) => ASSEMBLY_MAP[k].name).join(', ')}). Remove the ones you do not need or assign each to a room.` });
  if (floors.length && !keys.has('demo_floor')) out.push({ level: 'warn', msg: 'New flooring selected but no removal of the existing floor. Add "Remove existing flooring" if this is not new construction.', add: 'demo_floor' });
  const demo = [...keys].some((k) => k.startsWith('demo_') || k === 'popcorn' || k === 'cabinets');
  if (demo && !keys.has('dumpster')) out.push({ level: 'warn', msg: 'Demolition without a dumpster or disposal line.', add: 'dumpster' });
  if (keys.has('drywall_walls') && !keys.has('paint_walls')) out.push({ level: 'warn', msg: 'New drywall usually needs primer and paint.', add: 'paint_walls' });
  if ((keys.has('outlets') || keys.has('recessed') || keys.has('bath_fixtures') || keys.has('framing') || keys.has('roof_shingles') || keys.has('deck_build')) && !keys.has('permit') && !(est.items || []).some((i) => /permit/i.test(i.name))) out.push({ level: 'info', msg: 'Electrical, plumbing, framing, roofing and deck work typically requires a permit.', add: 'permit' });
  if (keys.has('cabinets') && !keys.has('countertops')) out.push({ level: 'info', msg: 'Cabinets selected without countertops.', add: 'countertops' });
  if (est.items && est.items.some((i) => !(Number(i.qty) > 0))) out.push({ level: 'warn', msg: 'Some line items have a zero quantity.' });
  if (est.items && est.items.some((i) => !(Number(i.unitCost) > 0))) out.push({ level: 'warn', msg: 'Some line items have no unit cost.' });
  if (!(Number(est.adj.taxRate) > 0)) out.push({ level: 'info', msg: 'Sales tax rate is 0%. Confirm your jurisdiction.' });
  if (!project.client || !project.client.name) out.push({ level: 'info', msg: 'Add the client name and address before sending.' });
  if (!settings.company.name) out.push({ level: 'info', msg: 'Add your company name and logo in Settings so the PDF is branded.', go: 'settings' });
  if (est.assemblies && est.assemblies.length && !est.scopeText) out.push({ level: 'info', msg: 'Write a one-paragraph scope summary — it prints at the top of the estimate.' });
  return out;
}

const UPSELL_RULES = [
  { when: (k) => k.some((x) => x.startsWith('floor_')), add: 'baseboard', reason: 'New floors almost always need new or re-set baseboard.' },
  { when: (k) => k.some((x) => x.startsWith('floor_')), add: 'protection', reason: 'Furniture moving and finish protection is billable.' },
  { when: (k) => k.includes('paint_walls'), add: 'paint_ceiling', reason: 'Fresh walls make an old ceiling look dingy.' },
  { when: (k) => k.includes('paint_walls'), add: 'paint_trim', reason: 'Trim and baseboard are usually painted with the walls.' },
  { when: (k) => k.includes('paint_walls'), add: 'drywall_repair', reason: 'Most repaints uncover holes and cracks to patch.' },
  { when: (k) => k.includes('baseboard'), add: 'paint_trim', reason: 'Primed baseboard still needs a finish coat.' },
  { when: (k) => k.includes('cabinets'), add: 'countertops', reason: 'Counters are replaced with cabinets 9 times out of 10.' },
  { when: (k) => k.includes('cabinets') || k.includes('countertops'), add: 'backsplash', reason: 'Backsplash is a high-margin add-on with the counters.' },
  { when: (k) => k.includes('cabinets'), add: 'recessed', reason: 'Kitchen remodels usually include lighting upgrades.' },
  { when: (k) => k.includes('drywall_walls'), add: 'insulation', reason: 'Walls are open — insulate now while it is cheap.' },
  { when: (k) => k.includes('drywall_walls'), add: 'outlets', reason: 'Add or relocate outlets while the walls are open.' },
  { when: (k) => k.includes('tile_shower'), add: 'bath_fixtures', reason: 'Valve, trim and fan are easy to swap during a tile job.' },
  { when: (k) => k.includes('recessed'), add: 'paint_ceiling', reason: 'Cutting in lights leaves patches on the ceiling.' },
  { when: (k) => k.includes('popcorn'), add: 'paint_ceiling', reason: 'A scraped ceiling needs primer and paint.' },
  { when: (k) => k.length >= 2, add: 'cleanup', reason: 'Final cleanup is expected by clients and worth billing.' },
];
export function upsells(project) {
  const keys = (project.estimate.assemblies || []).map((a) => a.key); const seen = new Set(keys); const out = [];
  for (const r of UPSELL_RULES) if (r.when(keys) && !seen.has(r.add) && ASSEMBLY_MAP[r.add]) { seen.add(r.add); out.push({ key: r.add, name: ASSEMBLY_MAP[r.add].name, reason: r.reason }); }
  return out.slice(0, 5);
}

/** Web Speech voice input. Returns a controller or null when unsupported. */
export function startVoice({ onResult, onEnd, onError, lang = 'en-US' }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return null;
  const rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = true; let finalText = '';
  rec.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; } onResult && onResult((finalText + interim).trim(), finalText.trim()); };
  rec.onerror = (e) => onError && onError(e.error || 'speech error'); rec.onend = () => onEnd && onEnd(finalText.trim());
  try { rec.start(); } catch (e) { onError && onError(String(e)); return null; }
  return { stop: () => { try { rec.stop(); } catch {} } };
}

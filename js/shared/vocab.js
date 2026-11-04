// Shared vocabulary between Fullbid and Contractor Visual Studio (CVS). The ONLY place these lists live.
// See docs/FULLBID-DIRECTION.md section 3.

// ---- 3.1 Trades: shared id → { cvs id, Fullbid labor trade id (profile.js TRADES) }
export const TRADES = {
  demo: { label: 'Demolition', cvs: 'demo', fullbid: 'demo' },
  carpentry: { label: 'Carpentry', cvs: 'carpentry', fullbid: 'carpenter' },
  finish_carpentry: { label: 'Finish carpentry', cvs: 'finish carpentry', fullbid: 'finish_carpentry' },
  plumbing: { label: 'Plumbing', cvs: 'plumbing', fullbid: 'plumber' },
  electrical: { label: 'Electrical', cvs: 'electrical', fullbid: 'electrician' },
  tile: { label: 'Tile & wall panels', cvs: 'tile', fullbid: 'tile' },
  drywall: { label: 'Drywall', cvs: 'drywall', fullbid: 'drywall' },
  paint: { label: 'Painting', cvs: 'paint', fullbid: 'painter' },
  glass: { label: 'Glass', cvs: 'glass', fullbid: 'glass' },
  cleanup: { label: 'Cleanup', cvs: 'cleanup', fullbid: 'cleanup' },
  flooring: { label: 'Flooring', cvs: null, fullbid: 'flooring' },
  hvac: { label: 'HVAC', cvs: null, fullbid: 'hvac' },
  roofing: { label: 'Roofing', cvs: null, fullbid: 'roofer' },
  siding: { label: 'Siding', cvs: null, fullbid: 'siding' },
  masonry: { label: 'Concrete & masonry', cvs: null, fullbid: 'mason' },
  paving: { label: 'Asphalt & sealcoat', cvs: null, fullbid: 'paving' },
  marine: { label: 'Marine (seawalls, docks)', cvs: null, fullbid: 'marine' },
  fencing: { label: 'Fencing', cvs: null, fullbid: 'fencing' },
  landscaping: { label: 'Landscaping', cvs: null, fullbid: 'landscaping' },
};
/** Any trade name (shared id, CVS id or Fullbid id) → Fullbid labor trade id. Unknown → 'carpenter'. */
export function fullbidTrade(name) {
  const n = String(name || '').trim().toLowerCase();
  if (TRADES[n]) return TRADES[n].fullbid;
  for (const t of Object.values(TRADES)) if (t.cvs === n || t.fullbid === n) return t.fullbid;
  const alias = { laborer: 'laborer', framing: 'carpenter', finish: 'finish_carpentry', plumber: 'plumber', electrician: 'electrician', painter: 'painter', roofer: 'roofer', mason: 'mason', concrete: 'mason' };
  return alias[n] || 'carpenter';
}
/** Fullbid labor trade id → shared id. */
export function sharedTrade(fullbidId) { for (const [k, t] of Object.entries(TRADES)) if (t.fullbid === fullbidId) return k; return fullbidId === 'laborer' ? 'demo' : fullbidId; }

// ---- 3.2 Units (imperial only). Canonical id → printed form.
export const UNITS = { ea: 'ea', set: 'set', 'sq ft': 'sq ft', sq: 'sq', lf: 'lf', in: 'in', ft: 'ft', 'cu yd': 'cu yd', gal: 'gal', tube: 'tube', bag: 'bag', box: 'box', bundle: 'bundle', roll: 'roll', sheet: 'sheet', panel: 'panel', piece: 'piece', hr: 'hr', job: 'job', ls: 'ls' };
const UNIT_WORDS = { each: 'ea', ea: 'ea', pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece', set: 'set', sets: 'set', kit: 'set', kits: 'set', pair: 'set', pairs: 'set', sf: 'sq ft', sqft: 'sq ft', 'sq ft': 'sq ft', 'square feet': 'sq ft', sq: 'sq', square: 'sq', squares: 'sq', lf: 'lf', 'linear ft': 'lf', 'linear feet': 'lf', in: 'in', inch: 'in', inches: 'in', ft: 'ft', foot: 'ft', feet: 'ft', cy: 'cu yd', 'cu yd': 'cu yd', 'cubic yards': 'cu yd', gal: 'gal', gallon: 'gal', gallons: 'gal', tube: 'tube', tubes: 'tube', bag: 'bag', bags: 'bag', box: 'box', boxes: 'box', bundle: 'bundle', bundles: 'bundle', roll: 'roll', rolls: 'roll', sheet: 'sheet', sheets: 'sheet', panel: 'panel', panels: 'panel', hr: 'hr', hrs: 'hr', hour: 'hr', hours: 'hr', job: 'job', 'lump sum': 'job', ls: 'ls', allowance: 'ls', pail: 'ea', pails: 'ea', can: 'ea', cans: 'ea', ton: 'ton', tons: 'ton', bucket: 'ea', buckets: 'ea', cartridge: 'tube', cartridges: 'tube', qt: 'ea', quart: 'ea' };
/** CVS unit text ("bags (50 lb)", "sheets (3 × 5 ft)", "sq ft") → canonical id for math (by the first word). */
export function unitFromText(text) {
  const t = String(text || '').trim().toLowerCase(); if (!t) return 'ea';
  const base = t.replace(/\(.*?\)/g, '').trim();
  if (UNIT_WORDS[base]) return UNIT_WORDS[base];
  for (const two of [base.split(/\s+/).slice(0, 2).join(' ')]) if (UNIT_WORDS[two]) return UNIT_WORDS[two];
  const first = base.split(/[\s,]+/)[0]; return UNIT_WORDS[first] || 'ea';
}

// ---- 3.3 Measurement kinds and sources
export const MEASURE_KINDS = {
  roof_area: 'sq ft', roof_pitch: 'x/12', eaves: 'lf', rakes: 'lf', ridges: 'lf', valleys: 'lf', step_flashing: 'lf', flashing: 'lf',
  hips: 'lf', roof_layers: 'layers', // Fullbid-side for now (the roofing pack reads them when present); see docs/CVS-REQUESTS.md
  gutters: 'lf', downspouts: 'ea', siding_area: 'sq ft', stone_area: 'sq ft', windows: 'ea', entry_doors: 'ea', garage_doors: 'ea', lights: 'lf',
  seawall_length: 'lf', seawall_returns: 'lf', seawall_area: 'sq ft', driveway_area: 'sq ft', patio_area: 'sq ft', deck_area: 'sq ft', fence_length: 'lf', floor_area: 'sq ft', wall_area: 'sq ft',
  'bath.roomL': 'ft', 'bath.roomW': 'ft', 'bath.ceilingIn': 'in', 'bath.showerW': 'in', 'bath.showerD': 'in', 'bath.wallH': 'in', 'bath.vanityWallIn': 'in',
};
/** Plain names for the measurement kinds, as a contractor says them. */
export const MEASURE_NAMES = {
  roof_area: 'Roof area', roof_pitch: 'Roof pitch', eaves: 'Eaves', rakes: 'Rakes', ridges: 'Ridges and hips', valleys: 'Valleys', step_flashing: 'Step flashing', flashing: 'Wall flashing', hips: 'Hips', roof_layers: 'Layers to tear off',
  gutters: 'Gutters', downspouts: 'Downspouts', siding_area: 'Siding area', stone_area: 'Stone area', windows: 'Windows', entry_doors: 'Entry doors', garage_doors: 'Garage doors', lights: 'Light runs',
  seawall_length: 'Seawall length', seawall_returns: 'Return walls', seawall_area: 'Seawall face', driveway_area: 'Driveway area', patio_area: 'Patio area', deck_area: 'Deck area', fence_length: 'Fence length', floor_area: 'Floor area', wall_area: 'Wall area',
  'bath.roomL': 'Bathroom length', 'bath.roomW': 'Bathroom width', 'bath.ceilingIn': 'Ceiling height', 'bath.showerW': 'Shower width', 'bath.showerD': 'Shower depth', 'bath.wallH': 'Shower wall height', 'bath.vanityWallIn': 'Vanity wall',
};
export const SOURCE_NAMES = { measured: 'Measured on site', report: 'Measurement report', satellite: 'Satellite', photo: 'From a photo', homeowner: 'Homeowner', typed: 'Typed in', typical: 'Typical size', estimate: 'Estimate' };
export const SOURCE_RANK = { measured: 5, report: 5, satellite: 3, photo: 2, homeowner: 2, typed: 2, typical: 1, estimate: 1 };
export const rankOf = (source) => SOURCE_RANK[source] ?? 1;
/** Merge one measurement into a list: a higher-ranked number wins; equal or lower never silently overwrites. */
export function mergeMeasurement(list, m) {
  const i = list.findIndex((x) => x.kind === m.kind);
  if (i < 0) { list.push({ ...m }); return { action: 'added' }; }
  const cur = list[i];
  if (rankOf(m.source) > rankOf(cur.source)) { list[i] = { ...m, replaced: { value: cur.value, source: cur.source } }; return { action: 'replaced', from: cur }; }
  if (cur.value !== m.value) return { action: 'kept', conflict: m };
  return { action: 'same' };
}

// ---- 3.4 Where a line is bought, and CVS material groups → Fullbid material classes (suppliers.js CLASSES)
export const FROM = { supplier: 'From the company whose tool made the design', 'home-center': 'Home center', online: 'Bought online (price seen on a date, not a quote)', contractor: 'Contractor stock', specialty: 'Specialty supplier' };
const GROUP_CLASS = [
  [/lumber|framing/i, 'lumber'], [/drywall/i, 'building'], [/plumbing/i, 'plumbing'], [/electrical|lighting/i, 'electrical'], [/waterproof|setting|tile|grout|thinset|backer/i, 'flooring'],
  [/paint|finishing|caulk/i, 'paint'], [/demo|protection|disposal|haul/i, 'building'], [/glass|shower door/i, 'windows_doors'], [/fixture|faucet|valve|tub|toilet|vanity|shower|accessor/i, 'plumbing'],
  [/wall panel|panel|surround/i, 'kitchen'], [/roof|shingle|underlayment|ridge|drip|flashing|ice/i, 'roofing'], [/gutter|downspout/i, 'roofing'], [/siding|trim|soffit|fascia/i, 'siding'],
  [/window|door/i, 'windows_doors'], [/concrete|paver|stone|masonry/i, 'masonry'], [/asphalt|sealcoat/i, 'paving'], [/fence/i, 'fence'], [/deck/i, 'lumber'], [/cabinet|counter/i, 'kitchen'], [/floor/i, 'flooring'], [/fastener|hardware|screw|nail/i, 'hardware'],
];
export function classForGroup(group, item = '') { const s = `${group || ''} ${item || ''}`; for (const [re, cls] of GROUP_CLASS) if (re.test(group || '')) return cls; for (const [re, cls] of GROUP_CLASS) if (re.test(s)) return cls; return 'building'; }

// ---- 4.4 Which pack takes a CVS module (unknown → general)
export const MODULE_PACK = {
  exterior: 'roofing', seawall: 'seawall', shower: 'bath', shower_glass: 'bath', bathtub: 'bath', walk_in_tub: 'bath', spa_bath: 'bath', bathroom: 'bath',
  kitchen: 'kitchen', cabinets: 'kitchen', countertops: 'kitchen', flooring: 'flooring', hardwood: 'flooring', carpet: 'flooring', interior_paint: 'painting', commercial_paint: 'painting',
  deck: 'decks', deck_restore: 'decks', pergola: 'decks', porch: 'decks', fence: 'fences', fence_restore: 'fences', driveway: 'concrete', patio: 'concrete', parking_lot: 'asphalt', road: 'asphalt',
};
/** Exterior designs split by each material's area/group; driveway/patio by the design's material. */
export function packForModule(module, hint = '') {
  if (module === 'exterior') { const h = String(hint).toLowerCase(); if (/gutter|downspout/.test(h)) return 'gutters'; if (/siding|soffit|fascia|stone|trim/.test(h)) return 'siding'; if (/window|door/.test(h)) return 'windows_doors'; return 'roofing'; }
  if (module === 'driveway' || module === 'patio') return /asphalt|sealcoat|blacktop/i.test(hint) ? 'asphalt' : 'concrete';
  return MODULE_PACK[module] || 'general';
}

// ---- Price evidence tiers (section 7)
export const EVIDENCE = { E0: 'Starter price — replace with yours', E1: 'Company price book starter', E2: 'Your price', E3: 'Supplier price', E4: 'Quote for this job', E5: 'Actual cost' };

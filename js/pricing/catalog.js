// Pricing catalog. National-average 2025–26 unit costs (editable by the user; regional
// indexes are applied by the estimator). Every assembly turns room geometry into material / labor / fee lines.
//
// ctx fields (imperial, derived from room metrics): sf (floor), ceilSf, wallSf (net), wallSfGross, perimLf,
// baseLf, crownLf, casingLf, winTrimLf, doors, windows, H (ft), rooms, opt(key), n(key, dflt)

import { ALL_WORK_ITEMS } from '../trades/index.js';
import { M, L, F, up, sel, num, bool } from '../trades/_helpers.js';

export const ASSEMBLIES = ALL_WORK_ITEMS; // definitions live in js/trades/<pack>/pack.js


// ---- metadata: which measurement kinds an assembly applies to, default supplier class for its materials,
//      and the labor trade its labor lines belong to (used for own labor rates and labor-hour planning).
const TRADE_META = { Painting: ['paint', 'painter'], Flooring: ['flooring', 'flooring'], 'Trim & Doors': ['lumber', 'carpenter'], Drywall: ['building', 'drywall'], Electrical: ['electrical', 'electrician'], 'Kitchen & Bath': ['kitchen', 'carpenter'], General: ['building', 'laborer'], Roofing: ['roofing', 'roofer'], Siding: ['siding', 'siding'], 'Decks & Patios': ['lumber', 'carpenter'], 'Concrete & Masonry': ['masonry', 'mason'], 'Asphalt & Paving': ['paving', 'paving'], Fencing: ['fence', 'carpenter'] };
const OVERRIDES = { bath_fixtures: { cls: 'plumbing', ltrade: 'plumber' }, tile_shower: { cls: 'flooring', ltrade: 'tile' }, floor_tile: { ltrade: 'tile' }, backsplash: { cls: 'flooring', ltrade: 'tile' }, window_replace: { cls: 'windows_doors', kinds: ['room', 'exterior'] }, window_trim: { kinds: ['room', 'exterior'] }, interior_door: { cls: 'windows_doors' }, insulation: { ltrade: 'laborer' }, demo_floor: { ltrade: 'laborer' }, demo_drywall: { ltrade: 'laborer' }, demo_general: { ltrade: 'laborer' }, framing: { cls: 'lumber', ltrade: 'carpenter' }, popcorn: { ltrade: 'drywall' }, countertops: { ltrade: 'carpenter' }, paint_doors: { kinds: ['room', 'exterior'] } };
for (const a of ASSEMBLIES) { const [cls, ltrade] = TRADE_META[a.trade] || ['building', 'laborer']; Object.assign(a, { kinds: a.kinds || ['room'], cls: a.cls || cls, ltrade: a.ltrade || ltrade }, OVERRIDES[a.key] || {}); }

export const ASSEMBLY_MAP = Object.fromEntries(ASSEMBLIES.map((a) => [a.key, a]));
export const TRADES = [...new Set(ASSEMBLIES.map((a) => a.trade))];
export const UNITS = ['sf', 'lf', 'ea', 'gal', 'sheet', 'hr', 'ls', 'day', 'box', 'sy'];

/** Quick-add library for custom lines (national averages). */
export const ITEM_LIBRARY = [
  M('General materials allowance', 'ls', 1, 250), L('General labor', 'hr', 1, 65), L('Helper / apprentice labor', 'hr', 1, 38), L('Electrician', 'hr', 1, 95), L('Plumber', 'hr', 1, 105), L('Painter', 'hr', 1, 55), L('Carpenter', 'hr', 1, 72),
  F('Travel / mobilization', 'ea', 1, 85), F('Equipment rental', 'day', 1, 120), F('Design / consultation', 'hr', 1, 90), M('Caulk, adhesives & fasteners', 'ls', 1, 45), M('Shoe molding / quarter round', 'lf', 1, 1.1), L('Install shoe molding', 'lf', 1, 1.75),
];

/** Pre-built scope bundles — one tap to select several assemblies. */
export const BUNDLES = [
  { key: 'refresh', name: 'Paint refresh', desc: 'Walls, ceiling, trim', assemblies: ['paint_walls', 'paint_ceiling', 'paint_trim', 'protection'] },
  { key: 'floors', name: 'New floors', desc: 'Demo + LVP + baseboard', assemblies: ['demo_floor', 'floor_lvp', 'baseboard', 'dumpster', 'cleanup'] },
  { key: 'bedroom', name: 'Bedroom remodel', desc: 'Floors, paint, trim, lighting', assemblies: ['demo_floor', 'floor_lvp', 'baseboard', 'paint_walls', 'paint_ceiling', 'paint_trim', 'recessed', 'dumpster', 'cleanup'] },
  { key: 'gut', name: 'Gut & rebuild', desc: 'Demo drywall, insulate, drywall, paint, floors', assemblies: ['demo_drywall', 'demo_floor', 'insulation', 'drywall_walls', 'paint_walls', 'paint_ceiling', 'floor_lvp', 'baseboard', 'outlets', 'dumpster', 'cleanup', 'permit'] },
  { key: 'kitchen', name: 'Kitchen refresh', desc: 'Cabinets, counters, backsplash, floors, paint', assemblies: ['cabinets', 'countertops', 'backsplash', 'floor_tile', 'paint_walls', 'recessed', 'dumpster', 'cleanup', 'permit'] },
  { key: 'bath', name: 'Bathroom remodel', desc: 'Fixtures, tile, paint', assemblies: ['bath_fixtures', 'tile_shower', 'floor_tile', 'paint_walls', 'paint_ceiling', 'dumpster', 'cleanup', 'permit'] },
  { key: 'reroof', name: 'Re-roof', desc: 'Tear-off, shingle system, gutters, permit', assemblies: ['roof_tearoff', 'roof_shingles', 'gutters', 'permit', 'cleanup'] },
  { key: 'reside', name: 'Re-side', desc: 'Vinyl siding with wrap, trim and disposal', assemblies: ['siding_vinyl', 'dumpster', 'cleanup'] },
  { key: 'deck', name: 'New deck', desc: 'Footings, framing, decking, railing, permit', assemblies: ['deck_build', 'permit', 'cleanup'] },
  { key: 'driveway', name: 'Driveway care', desc: 'Crack fill and two-coat sealcoat', assemblies: ['sealcoat'] },
  { key: 'yard', name: 'Fence & patio', desc: 'Fence run plus paver patio', assemblies: ['fence', 'pavers', 'dumpster', 'cleanup'] },
];

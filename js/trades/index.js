// All trade packs. The core reads work items, products and pack metadata only through here.
import * as painting from './painting/pack.js';
import * as flooring from './flooring/pack.js';
import * as windows_doors from './windows_doors/pack.js';
import * as general from './general/pack.js';
import * as kitchen from './kitchen/pack.js';
import * as bath from './bath/pack.js';
import * as roofing from './roofing/pack.js';
import * as gutters from './gutters/pack.js';
import * as siding from './siding/pack.js';
import * as decks from './decks/pack.js';
import * as fences from './fences/pack.js';
import * as concrete from './concrete/pack.js';
import * as asphalt from './asphalt/pack.js';
import * as seawall from './seawall/pack.js';

export const PACKS = [painting, flooring, windows_doors, general, kitchen, bath, roofing, gutters, siding, decks, fences, concrete, asphalt, seawall];
export const PACK_MAP = Object.fromEntries(PACKS.map((p) => [p.meta.id, p]));
// Original catalog order is kept so behavior (parsing, tiers, listings) does not change.
export const WORK_ITEM_ORDER = ["paint_walls", "paint_ceiling", "paint_trim", "paint_doors", "floor_lvp", "floor_laminate", "floor_hardwood", "floor_tile", "floor_carpet", "demo_floor", "baseboard", "crown", "door_casing", "interior_door", "window_trim", "window_replace", "drywall_walls", "drywall_ceiling", "drywall_repair", "demo_drywall", "insulation", "popcorn", "outlets", "recessed", "ceiling_fan", "cabinets", "countertops", "backsplash", "bath_fixtures", "tile_shower", "framing", "demo_general", "dumpster", "protection", "cleanup", "permit", "roof_tearoff", "roof_shingles", "gutters", "siding_vinyl", "siding_fibercement", "ext_paint", "deck_build", "concrete_slab", "pavers", "sealcoat", "asphalt_paving", "fence"];
export const PRODUCT_ORDER = ["toilet", "vanity", "kitchen_faucet", "disposal", "water_heater", "tankless", "dishwasher", "ceiling_fan", "light_fixture", "recessed", "mini_split", "interior_door", "window", "entry_door", "patio_door", "garage_door", "lvp", "tile_floor", "cabinets", "roof_system", "siding_system", "gutter_system", "deck_boards", "fence_system", "exterior_light"];
const order = (list, keys) => list.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
export const ALL_WORK_ITEMS = order(PACKS.flatMap((p) => p.workItems.map((w) => Object.assign(w, { pack: p.meta.id }))), WORK_ITEM_ORDER);
export const ALL_PRODUCTS = order(PACKS.flatMap((p) => p.products.map((s) => Object.assign(s, { pack: p.meta.id }))), PRODUCT_ORDER);
export const packOfWorkItem = (key) => (ALL_WORK_ITEMS.find((w) => w.key === key) || {}).pack || 'general';

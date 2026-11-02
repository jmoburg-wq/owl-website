// Trade pack: Bath (shower, tub, whole bathroom). Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "bath",
  "name": "Bath (shower, tub, whole bathroom)",
  "cvsModules": [
    "shower",
    "shower_glass",
    "bathtub",
    "walk_in_tub",
    "spa_bath",
    "bathroom"
  ],
  "areaKinds": [
    "room"
  ],
  "measurements": [
    "bath.roomL",
    "bath.roomW",
    "bath.ceilingIn",
    "bath.showerW",
    "bath.showerD",
    "bath.wallH",
    "bath.vanityWallIn"
  ],
  "trades": [
    "demo",
    "plumbing",
    "electrical",
    "carpentry",
    "tile",
    "drywall",
    "paint",
    "glass",
    "finish_carpentry",
    "cleanup"
  ],
  "sequence": [
    "Demo",
    "Rough plumbing (valve) and electrical",
    "Inspection",
    "Backer, waterproofing or panel substrate",
    "Walls: tile, panels or unit",
    "Floor",
    "Fixtures and trim",
    "Measure for glass after walls are up",
    "Glass install",
    "Paint and accessories",
    "Cleanup"
  ],
  "holdPoints": [
    "Shower glass is measured after the walls are finished and takes weeks to make",
    "Made-to-order bases and wall systems have lead times",
    "The trim the client picks needs its matching rough-in valve before walls close"
  ],
  "proposal": {
    "scope": [
      "Wet area only (shower or tub-to-shower conversion) or the whole room, as listed."
    ],
    "exclusions": [
      "Repair of hidden rot or framing beyond the allowance",
      "Relocating drains or vents unless listed"
    ],
    "selections": [
      "Wall system and color",
      "Valve trim finish (sets the rough-in valve)",
      "Glass style and hardware finish",
      "Allowance selections and their choose-by dates"
    ]
  },
  "cvsReplaces": [
    "bath_fixtures",
    "tile_shower",
    "floor_tile",
    "paint_walls",
    "paint_ceiling",
    "demo_general"
  ]
};

export const workItems = [
  { key: 'bath_fixtures', trade: 'Kitchen & Bath', name: 'Bathroom fixtures', icon: 'grid', keywords: ['toilet', 'vanity', 'bathroom', 'sink', 'faucet', 'bath remodel'],
    options: [bool('toilet', 'Toilet', true), bool('vanity', 'Vanity & faucet', true), bool('tub', 'Tub/shower valve & trim', false), bool('exhaust', 'Exhaust fan', false)],
    items: (c) => { const out = []; if (c.opt('toilet')) out.push(M('Toilet (elongated, 1.28 gpf)', 'ea', 1, 280), L('Remove & install toilet', 'ea', 1, 225)); if (c.opt('vanity')) out.push(M('36" vanity w/ top', 'ea', 1, 650), M('Faucet & supply lines', 'ea', 1, 165), L('Remove & install vanity, faucet, hookups', 'ea', 1, 425)); if (c.opt('tub')) out.push(M('Tub/shower valve & trim kit', 'ea', 1, 240), L('Replace valve & trim', 'ea', 1, 385)); if (c.opt('exhaust')) out.push(M('Exhaust fan (80 cfm)', 'ea', 1, 95), L('Install/replace exhaust fan', 'ea', 1, 185)); return out; } },
  { key: 'tile_shower', trade: 'Kitchen & Bath', name: 'Tile shower walls', icon: 'grid', keywords: ['shower tile', 'tile shower', 'shower walls', 'tub surround'],
    options: [num('sf', 'Wall area (sf)', 90)],
    items: (c) => { const sf = c.n('sf', 90); return [M('Shower wall tile', 'sf', up(sf * 1.15, 1), 6), M('Waterproofing membrane / backer', 'sf', sf, 2.5), M('Thinset, grout, niche, trim', 'sf', sf, 1.8), L('Backer, waterproof, set & grout', 'sf', sf, 16)]; } },
];

export const products = [
  { key: 'toilet', name: 'Toilet', group: 'Plumbing', where: 'interior', cls: 'plumbing', unit: 'ea', icon: 'home', vendors: 'Ferguson, Home Depot, Lowe\'s',
    attrs: [TIER, psel('rough', 'Rough-in', [['12', '12" (standard)'], ['10', '10"'], ['14', '14"']], '12'), pbool('replace', 'Replacing an existing toilet', true), pbool('newValve', 'Replace the shutoff valve', true)],
    price: (a) => T(a, 180, 320, 650),
    build: ({ qty: q, a }) => { const parts = [P('Wax ring with horn (or wax-free seal)', 'ea', q, 7, 'plumbing', 'Seals the toilet to the flange. Always replaced.'), P('Closet bolts, washers & caps', 'ea', q, 6, 'plumbing', 'Old bolts are corroded or get cut off during removal.'), P('Braided supply line 3/8" × 7/8"', 'ea', q, 9, 'plumbing', 'A new line prevents leaks from brittle old supplies.'), P('Siliconized caulk (white)', 'tube', 1, 7, 'hardware', 'Bead around the base; leave the back open so leaks show.', 'recommended')];
      if (a.newValve) parts.push(P('1/4-turn angle stop valve', 'ea', q, 14, 'plumbing', 'Old multi-turn valves often fail to close or start leaking once disturbed.', 'recommended'));
      parts.push(P('Flange repair ring / spacer', 'ea', q, 12, 'plumbing', 'Needed if the flange is cracked or sits below the finished floor.', 'optional'));
      if (a.rough !== '12') parts.push(P(`${a.rough}" rough-in model premium`, 'ea', q, 60, 'plumbing', 'Non-standard rough-ins cost more and are often special order.'));
      const labor = [LAB('Set toilet, connect supply & test', 1.25 * q, 'plumber')]; const fees = [];
      if (a.replace) { labor.unshift(LAB('Shut off, drain & remove old toilet', 0.6 * q, 'plumber')); fees.push(FEE('Old toilet haul-away & disposal', 'ea', q, 25, 'Transfer stations charge per fixture.')); }
      if (a.newValve) labor.push(LAB('Replace shutoff valve', 0.5 * q, 'plumber'));
      return { parts, labor, fees, notes: ['Measure the rough-in (wall to bolt center) before ordering.', 'Press on the floor around the flange — soft spots mean a subfloor repair.'] }; } },
  { key: 'vanity', name: 'Bathroom vanity + top + faucet', group: 'Plumbing', where: 'interior', cls: 'kitchen', unit: 'ea', icon: 'grid', vendors: 'Home Depot, Lowe\'s, Ferguson',
    attrs: [psel('size', 'Width', [['24', '24"'], ['30', '30"'], ['36', '36"'], ['48', '48"'], ['60', '60" double']], '36'), TIER, pbool('topIncluded', 'Top & sink included with vanity', true), pbool('replace', 'Replacing an existing vanity', true)],
    price: (a) => Math.round({ 24: 280, 30: 380, 36: 520, 48: 780, 60: 1200 }[a.size] * T(a, 0.8, 1, 1.8)),
    build: ({ qty: q, a }) => { const dbl = a.size === '60'; const sinks = q * (dbl ? 2 : 1); const parts = [P('Lavatory faucet', 'ea', sinks, T(a, 85, 165, 320), 'plumbing', 'Vanities rarely include the faucet.'), P('P-trap kit 1-1/4"', 'ea', sinks, 14, 'plumbing', 'New trap sized to the new sink height.'), P('Braided faucet supply lines', 'ea', sinks * 2, 9, 'plumbing', 'Hot and cold per sink.'), P('1/4-turn angle stops', 'ea', sinks * 2, 14, 'plumbing', 'Replace old stops while the wall is open.', 'recommended'), P('Silicone, shims & cabinet screws', 'ls', q, 18, 'hardware', 'Level, anchor to studs and seal the top.')];
      if (!a.topIncluded) parts.push(P('Vanity top with sink(s)', 'ea', q, dbl ? 520 : 260, 'kitchen', 'Order separately when the cabinet ships without a top.'));
      parts.push(P('Side splash', 'ea', q, 35, 'kitchen', 'Needed when the vanity sits against a side wall.', 'optional'), P('Mirror / medicine cabinet', 'ea', q, 140, 'kitchen', 'Most clients upgrade the mirror with a new vanity.', 'optional'));
      const labor = [LAB('Set, level & anchor vanity', (dbl ? 2.5 : 1.5) * q, 'carpenter'), LAB('Install top, faucet(s) & drain', (dbl ? 2 : 1.25) * q, 'plumber')]; const fees = [];
      if (a.replace) { labor.unshift(LAB('Disconnect & remove old vanity', 1 * q, 'plumber')); fees.push(FEE('Old vanity disposal', 'ea', q, 30, 'Bulky-item disposal fee.')); }
      if (dbl && a.replace) { parts.push(P('Second drain & supply rough-in parts', 'ls', q, 85, 'plumbing', 'A double vanity replacing a single needs a second drain and supplies.')); labor.push(LAB('Add second drain & supplies in wall', 4 * q, 'plumber')); }
      return { parts, labor, fees, notes: ['Check drain and supply heights against the vanity\'s drawers.', 'Patch and paint behind the old vanity footprint if the new one is smaller.'] }; } },
];

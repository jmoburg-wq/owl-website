// Trade pack: Flooring. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "flooring",
  "name": "Flooring",
  "cvsModules": [
    "flooring",
    "hardwood",
    "carpet"
  ],
  "areaKinds": [
    "room"
  ],
  "measurements": [
    "floor_area"
  ],
  "trades": [
    "flooring",
    "tile",
    "demo",
    "finish_carpentry"
  ],
  "sequence": [
    "Remove existing floor",
    "Flatten and prep subfloor",
    "Acclimate material",
    "Install",
    "Transitions and base trim"
  ],
  "holdPoints": [
    "Material acclimation (usually 48 hours)"
  ],
  "proposal": {
    "scope": [
      "Remove the existing floor, prepare the subfloor and install the selected flooring with transitions."
    ],
    "exclusions": [
      "Subfloor replacement beyond the allowance",
      "Moving appliances with gas connections"
    ],
    "selections": [
      "Flooring product and color",
      "Transition style at each doorway"
    ]
  },
  "cvsReplaces": []
};

export const workItems = [
  { key: 'floor_lvp', trade: 'Flooring', name: 'Luxury vinyl plank (LVP)', icon: 'layers', keywords: ['lvp', 'luxury vinyl', 'vinyl plank', 'vinyl flooring', 'lvt', 'waterproof flooring'],
    options: [sel('grade', 'Product grade', [{ v: 2.49, label: 'Good — $2.49/sf' }, { v: 3.49, label: 'Better — $3.49/sf' }, { v: 4.99, label: 'Best — $4.99/sf' }], 3.49), bool('underlayment', 'Separate underlayment', false), sel('waste', 'Waste factor', [{ v: 0.08, label: '8%' }, { v: 0.1, label: '10%' }, { v: 0.15, label: '15% (diagonal/herringbone)' }], 0.1)],
    items: (c) => { const w = +c.opt('waste'); const out = [M('LVP flooring', 'sf', up(c.sf * (1 + w), 1), +c.opt('grade'), { note: `${Math.round(c.sf)} sf + ${Math.round(w * 100)}% waste` })]; if (c.opt('underlayment')) out.push(M('Underlayment (foam/cork)', 'sf', up(c.sf * 1.05, 1), 0.45)); out.push(M('Transition strips / reducers', 'ea', Math.max(1, c.doors), 28)); out.push(L('Install LVP (floating, click-lock)', 'sf', Math.round(c.sf), 2.25)); out.push(L('Install transitions & undercut doors', 'ea', Math.max(1, c.doors), 25)); return out; } },
  { key: 'floor_laminate', trade: 'Flooring', name: 'Laminate flooring', icon: 'layers', keywords: ['laminate'],
    items: (c) => [M('Laminate flooring (AC4)', 'sf', up(c.sf * 1.1, 1), 2.25), M('Underlayment', 'sf', up(c.sf * 1.05, 1), 0.45), M('Transition strips', 'ea', Math.max(1, c.doors), 26), L('Install laminate', 'sf', Math.round(c.sf), 2.0), L('Install transitions', 'ea', Math.max(1, c.doors), 25)] },
  { key: 'floor_hardwood', trade: 'Flooring', name: 'Hardwood flooring', icon: 'layers', keywords: ['hardwood', 'wood floor', 'oak floor', 'engineered wood', 'engineered hardwood', 'solid hardwood'],
    options: [sel('type', 'Type', [{ v: 'engineered', label: 'Engineered — $6.50/sf' }, { v: 'solid', label: 'Solid prefinished — $7.50/sf' }, { v: 'unfinished', label: 'Solid unfinished — $5.75/sf + finish' }], 'engineered')],
    items: (c) => { const t = c.opt('type'); const price = t === 'engineered' ? 6.5 : t === 'solid' ? 7.5 : 5.75; const out = [M(`${t[0].toUpperCase() + t.slice(1)} hardwood`, 'sf', up(c.sf * 1.12, 1), price, { note: '12% waste' }), M('Rosin paper / underlayment & fasteners', 'sf', up(c.sf * 1.05, 1), 0.35), M('Transitions & reducers', 'ea', Math.max(1, c.doors), 34), L('Install hardwood (nail/glue-down)', 'sf', Math.round(c.sf), 4.5)]; if (t === 'unfinished') { out.push(M('Stain & polyurethane (3 coats)', 'sf', Math.round(c.sf), 0.6)); out.push(L('Sand, stain & finish', 'sf', Math.round(c.sf), 3.5)); } return out; } },
  { key: 'floor_tile', trade: 'Flooring', name: 'Tile flooring', icon: 'grid', keywords: ['tile floor', 'floor tile', 'porcelain', 'ceramic tile', 'tile the floor', 'tiling'],
    options: [sel('grade', 'Tile', [{ v: 3.5, label: 'Good — $3.50/sf' }, { v: 6, label: 'Better — $6.00/sf' }, { v: 10, label: 'Best — $10.00/sf' }], 6), bool('backer', 'Cement backer board', true), sel('waste', 'Waste factor', [{ v: 0.12, label: '12%' }, { v: 0.15, label: '15%' }, { v: 0.2, label: '20% (diagonal/pattern)' }], 0.15), bool('largeFormat', 'Large format (≥ 24")', false)],
    items: (c) => { const w = +c.opt('waste'); const out = [M('Porcelain/ceramic tile', 'sf', up(c.sf * (1 + w), 1), +c.opt('grade'), { note: `${Math.round(w * 100)}% waste` }), M('Thinset, grout, spacers & sealer', 'sf', Math.round(c.sf), 0.95)]; if (c.opt('backer')) { out.push(M('Cement backer board + screws/tape', 'sf', up(c.sf * 1.08, 1), 1.4)); out.push(L('Install backer board', 'sf', Math.round(c.sf), 1.5)); } out.push(L('Set tile & grout', 'sf', Math.round(c.sf), 8.5 + (c.opt('largeFormat') ? 2 : 0))); return out; } },
  { key: 'floor_carpet', trade: 'Flooring', name: 'Carpet', icon: 'layers', keywords: ['carpet', 'carpeting'],
    items: (c) => [M('Carpet (mid-grade)', 'sf', up(c.sf * 1.1, 1), 2.75), M('Carpet pad (8 lb)', 'sf', up(c.sf * 1.05, 1), 0.65), M('Tack strip, seam tape & transitions', 'ls', 1, Math.max(25, c.perimLf * 0.6)), L('Install carpet & pad', 'sf', Math.round(c.sf), 1.25)] },
  { key: 'demo_floor', trade: 'Flooring', name: 'Remove existing flooring', icon: 'trash', keywords: ['remove floor', 'tear out floor', 'demo floor', 'rip up', 'remove carpet', 'remove tile', 'remove old floor', 'existing floor'],
    options: [sel('type', 'Existing floor', [{ v: 'carpet', label: 'Carpet & pad' }, { v: 'vinyl', label: 'Vinyl / laminate' }, { v: 'hardwood', label: 'Hardwood' }, { v: 'tile', label: 'Tile (incl. thinset)' }], 'carpet')],
    items: (c) => { const rate = { carpet: 0.75, vinyl: 1.1, hardwood: 2.25, tile: 3.5 }[c.opt('type')]; return [L(`Remove ${c.opt('type')} flooring & haul to dumpster`, 'sf', Math.round(c.sf), rate), L('Floor prep / scrape / level', 'sf', Math.round(c.sf), c.opt('type') === 'tile' ? 1.1 : 0.35), M('Floor patch / leveler', 'sf', Math.round(c.sf), 0.2)]; } },
];

export const products = [
  { key: 'lvp', name: 'Luxury vinyl plank', group: 'Flooring', where: 'interior', cls: 'flooring', unit: 'sf', icon: 'layers', measure: { kinds: ['room'], metric: 'sf' }, vendors: 'Home Depot, Lowe\'s, Floor & Decor',
    attrs: [psel('tier', 'Product', [['good', 'Good — 12 mil'], ['better', 'Better — 20 mil'], ['best', 'Best — rigid core, 28 mil']], 'better'), pbool('separateUnder', 'Separate underlayment', false), pbool('concrete', 'Over concrete (vapor barrier)', false), psel('remove', 'Existing floor', [['none', 'None / already removed'], ['carpet', 'Carpet & pad'], ['vinyl', 'Vinyl / laminate'], ['tile', 'Tile']], 'carpet')],
    price: (a) => T(a, 2.49, 3.49, 4.99),
    build: ({ qty, a, geo }) => { const sf = qty; const doors = Math.max(1, geo.doors || 1); const perim = geo.perimLf || Math.sqrt(sf) * 4; const parts = [P('Transition strips / reducers', 'ea', doors, 28, 'flooring', 'One at every doorway to another floor type.'), P('Shoe molding / quarter round', 'lf', ceil(perim * 1.1), 1.1, 'lumber', 'Covers the expansion gap at the walls.', 'recommended'), P('Floor patch / leveler', 'sf', Math.round(sf * 0.15), 0.6, 'flooring', 'LVP telegraphs dips; most floors need some flattening.', 'recommended')];
      if (a.separateUnder) parts.push(P('Underlayment', 'sf', ceil(sf * 1.05), 0.45, 'flooring', 'Only if the plank has no attached pad.'));
      if (a.concrete) parts.push(P('6-mil vapor barrier', 'sf', ceil(sf * 1.1), 0.12, 'flooring', 'Required over concrete for the warranty.'));
      const labor = [LAB('Install LVP (floating, click-lock)', sf * 0.035, 'flooring'), LAB('Undercut door jambs & set transitions', 0.4 * doors, 'flooring'), LAB('Install shoe molding', perim * 0.02, 'carpenter')]; const fees = [];
      if (a.remove !== 'none') { labor.unshift(LAB(`Remove ${a.remove} & prep subfloor`, sf * { carpet: 0.012, vinyl: 0.02, tile: 0.055 }[a.remove], 'laborer')); fees.push(FEE('Flooring debris disposal', 'sf', Math.round(sf), a.remove === 'tile' ? 0.35 : 0.12, 'Landfill weight charge.')); }
      return { main: { qty: ceil(sf * 1.1), note: `${Math.round(sf)} sf + 10% waste` }, parts, labor, fees, notes: ['Acclimate planks 48 hours on site.', 'Check flatness: 3/16" in 10 ft is the usual limit.'] }; } },
  { key: 'tile_floor', name: 'Floor tile', group: 'Flooring', where: 'interior', cls: 'flooring', unit: 'sf', icon: 'grid', measure: { kinds: ['room'], metric: 'sf' }, vendors: 'Floor & Decor, tile showrooms, Home Depot',
    attrs: [psel('tier', 'Tile', [['good', 'Ceramic — $3.50/sf'], ['better', 'Porcelain — $6/sf'], ['best', 'Large-format porcelain / stone — $10/sf']], 'better'), psel('substrate', 'Underlayment', [['membrane', 'Uncoupling membrane'], ['backer', 'Cement backer board']], 'membrane')],
    price: (a) => T(a, 3.5, 6, 10),
    build: ({ qty, a, geo }) => { const sf = qty; const lf = a.tier === 'best'; const doors = Math.max(1, geo.doors || 1); const parts = [P('Modified thinset (50 lb)', 'bag', ceil(sf / (lf ? 45 : 70)), 32, 'flooring', 'Large tile needs more coverage.'), P('Grout (25 lb)', 'bag', Math.max(1, ceil(sf / 150)), 28, 'flooring', 'Sanded for joints over 1/8".'), P(a.substrate === 'membrane' ? 'Uncoupling membrane' : 'Cement backer board + screws/tape', 'sf', ceil(sf * 1.08), a.substrate === 'membrane' ? 1.6 : 1.4, 'flooring', 'Prevents cracked tile and grout.'), P('Edge trim / transition', 'ea', doors, 32, 'flooring', 'Finished edge at doorways.'), P('Grout sealer', 'ea', 1, 22, 'flooring', 'Protects grout from stains.', 'recommended')];
      if (lf) parts.push(P('Tile leveling clips & wedges', 'ls', 1, 45, 'flooring', 'Prevents lippage on large tile.'));
      return { main: { qty: ceil(sf * (lf ? 1.12 : 1.15)), note: `${Math.round(sf)} sf + waste` }, parts, labor: [LAB('Install underlayment', sf * 0.025, 'tile'), LAB('Set tile', sf * (lf ? 0.17 : 0.14), 'tile'), LAB('Grout & seal', sf * 0.03, 'tile')], fees: [], notes: ['Large-format tile needs a very flat floor (1/8" in 10 ft).'] }; } },
];

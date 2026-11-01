// Trade pack: Siding. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "siding",
  "name": "Siding",
  "cvsModules": [
    "exterior"
  ],
  "areaKinds": [
    "exterior"
  ],
  "measurements": [
    "siding_area",
    "stone_area",
    "windows",
    "entry_doors"
  ],
  "trades": [
    "siding",
    "demo",
    "paint"
  ],
  "sequence": [
    "Tear off",
    "Weather barrier and flashing",
    "Siding and trim",
    "Paint (fiber cement)"
  ],
  "holdPoints": [
    "Color lot: order all siding together"
  ],
  "proposal": {
    "scope": [
      "Remove the existing siding and install the selected siding, trim and flashing."
    ],
    "exclusions": [
      "Sheathing replacement beyond the allowance",
      "Lead paint abatement"
    ],
    "selections": [
      "Siding profile and color",
      "Trim color"
    ]
  },
  "cvsReplaces": [
    "siding_vinyl",
    "siding_fibercement"
  ]
};

export const workItems = [
  { key: 'siding_vinyl', trade: 'Siding', name: 'Vinyl siding', icon: 'grid', kinds: ['exterior'], cls: 'siding', ltrade: 'siding',
    keywords: ['vinyl siding', 'siding', 'reside', 're-side', 'new siding'],
    options: [sel('grade', 'Product line', [{ v: 105, label: 'Builder — $105/sq' }, { v: 145, label: 'Premium — $145/sq' }, { v: 260, label: 'Insulated — $260/sq' }], 145), bool('tearoff', 'Remove existing siding', true), bool('wrap', 'House wrap', true)],
    items: (c) => { const sq = c.wallSf / 100; const openLf = c.casingLf + c.winTrimLf; const out = []; if (c.opt('tearoff')) out.push(L('Remove existing siding & haul', 'sq', up(sq, 0.1), 65)); if (c.opt('wrap')) out.push(M('House wrap (9 × 150 ft roll)', 'roll', Math.ceil((c.wallSfGross * 1.1) / 1350), 175), M('House wrap tape', 'roll', Math.max(1, Math.ceil(c.wallSfGross / 500)), 18), L('Install house wrap', 'sq', up(sq, 0.1), 22));
      out.push(M('Vinyl siding', 'sq', up(sq * 1.1, 0.5), Number(c.opt('grade')), { note: `${sq.toFixed(1)} sq net + 10% waste` }), M('J-channel (12.5 ft)', 'ea', Math.ceil((openLf * 1.1) / 12.5), 9, { note: 'Around windows and doors' }), M('Outside corner posts (10 ft)', 'ea', Math.ceil((c.outsideCorners * c.H) / 10), 34), M('Inside corners (10 ft)', 'ea', Math.ceil((c.insideCorners * c.H) / 10), 22), M('Starter strip (12 ft)', 'ea', Math.ceil(c.perimLf / 12), 8.5), M('Undersill / utility trim', 'ea', Math.max(1, c.windows), 7), M('Siding nails (5 lb)', 'box', Math.max(1, Math.ceil(sq / 10)), 22, { cls: 'hardware' }), M('Kick-out flashing', 'ea', 2, 14, { note: 'Where roof edges meet walls — the most-missed leak point' }), M('Light & vent mounting blocks', 'ea', 4, 11));
      out.push(L('Install siding, corners & trim', 'sq', up(sq, 0.1), 195), L('Trim out windows & doors', 'ea', c.doors + c.windows, 45)); return out; } },
  { key: 'siding_fibercement', trade: 'Siding', name: 'Fiber cement siding (lap)', icon: 'grid', kinds: ['exterior'], cls: 'siding', ltrade: 'siding',
    keywords: ['fiber cement', 'hardie', 'hardieplank', 'james hardie', 'cement board siding'],
    options: [sel('finish', 'Finish', [{ v: 210, label: 'Primed — $210/sq' }, { v: 290, label: 'Factory color (ColorPlus) — $290/sq' }], 210), bool('tearoff', 'Remove existing siding', true)],
    items: (c) => { const sq = c.wallSf / 100; const openLf = c.casingLf + c.winTrimLf; const primed = Number(c.opt('finish')) < 250; const out = []; if (c.opt('tearoff')) out.push(L('Remove existing siding & haul', 'sq', up(sq, 0.1), 70));
      out.push(M('Fiber cement lap siding', 'sq', up(sq * 1.12, 0.5), Number(c.opt('finish')), { note: '12% waste' }), M('Trim boards 5/4 × 4 (12 ft)', 'ea', Math.ceil((openLf + c.outsideCorners * c.H * 2) / 12), 24, { note: 'Windows, doors and corners' }), M('Weather-resistive barrier (9 × 150 ft)', 'roll', Math.ceil((c.wallSfGross * 1.1) / 1350), 185), M('Z-flashing & head flashing', 'ea', Math.max(1, c.windows + c.doors), 9), M('Kick-out flashing', 'ea', 2, 14), M('Siding nails (stainless/galv, 5 lb)', 'box', Math.max(1, Math.ceil(sq / 6)), 28, { cls: 'hardware' }), M('Sealant (paintable)', 'tube', Math.ceil(openLf / 25) + 4, 8, { cls: 'paint' }), M('Touch-up paint kit', 'ea', primed ? 0 : 1, 45));
      out.push(L('Install WRB & flashing', 'sq', up(sq, 0.1), 28), L('Install fiber cement siding & trim', 'sq', up(sq, 0.1), 290)); if (primed) out.push(M('Exterior paint (2 coats)', 'gal', Math.ceil((c.wallSf * 2) / 300), 55, { cls: 'paint' }), L('Paint siding & trim', 'sf', Math.round(c.wallSf), 1.6)); return out; } },
];

export const products = [
  { key: 'siding_system', name: 'Siding', group: 'Siding', where: 'exterior', cls: 'siding', unit: 'sq', icon: 'grid', measure: { kinds: ['exterior'], metric: 'wallSq' }, vendors: 'ABC Supply, Beacon, lumber yards',
    attrs: [psel('type', 'Siding', [['vinyl', 'Vinyl — $145/sq'], ['insulated', 'Insulated vinyl — $260/sq'], ['fiber', 'Fiber cement — $210/sq'], ['lp', 'Engineered wood (LP SmartSide) — $230/sq']], 'vinyl'), pbool('tearoff', 'Remove existing siding', true)],
    price: (a) => ({ vinyl: 145, insulated: 260, fiber: 210, lp: 230 }[a.type]),
    build: ({ qty: sq, a, geo }) => { const H = geo.H || 9; const openLf = (geo.casingLf || 0) + (geo.winTrimLf || 0) || sq * 4; const oc = geo.outsideCorners || 4; const perim = geo.perimLf || Math.sqrt(sq * 100) * 2; const vinyl = a.type === 'vinyl' || a.type === 'insulated';
      const parts = [P('House wrap (9 × 150 ft)', 'roll', ceil((sq * 100 * 1.1) / 1350), 175, 'siding', 'Weather-resistive barrier behind the siding.'), P(vinyl ? 'J-channel (12.5 ft)' : 'Trim boards (12 ft)', 'ea', ceil((openLf * 1.1) / 12), vinyl ? 9 : 24, 'siding', 'Frames every window and door.'), P(vinyl ? 'Outside corner posts (10 ft)' : 'Corner boards (12 ft)', 'ea', ceil((oc * H) / 10), vinyl ? 34 : 26, 'siding', 'One run per outside corner.'), P('Starter strip', 'ea', ceil(perim / 12), 8.5, 'siding', 'Locks in the first course.'), P('Kick-out flashing', 'ea', 2, 14, 'roofing', 'Where roof edges meet walls — the most-missed leak point.'), P('Siding nails', 'box', Math.max(1, ceil(sq / 8)), 24, 'hardware', 'Corrosion-resistant, per manufacturer spec.'), P('Mounting blocks (lights, vents, faucets)', 'ea', 6, 11, 'siding', 'Every penetration needs a block.', 'recommended')];
      if (!vinyl) parts.push(P('Exterior paint (2 coats) or touch-up kit', 'gal', a.type === 'fiber' ? ceil((sq * 100 * 2) / 300) : 2, 55, 'paint', 'Primed products must be painted within the warranty window.'));
      const labor = [LAB('Install house wrap & flashing', sq * 0.4, 'siding'), LAB('Install siding, corners & trim', sq * (vinyl ? 3.2 : 4.8), 'siding')]; const fees = [];
      if (a.tearoff) { labor.unshift(LAB('Remove existing siding', sq * 1.1, 'laborer')); fees.push(FEE('Siding dumpster & disposal', 'ea', Math.max(1, ceil(sq / 20)), 450, 'One container per ~20 squares.')); }
      return { main: { qty: Math.ceil(sq * 1.1 * 2) / 2, note: `${sq.toFixed(1)} sq net + 10% waste` }, parts, labor, fees, notes: ['Order colors and trim from the same production lot.', 'Pre-1978 homes: test for lead paint before tear-off.'] }; } },
];

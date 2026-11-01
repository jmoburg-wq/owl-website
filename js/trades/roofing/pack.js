// Trade pack: Roofing. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "roofing",
  "name": "Roofing",
  "cvsModules": [
    "exterior"
  ],
  "areaKinds": [
    "roof"
  ],
  "measurements": [
    "roof_area",
    "roof_pitch",
    "eaves",
    "rakes",
    "ridges",
    "valleys",
    "step_flashing",
    "flashing"
  ],
  "trades": [
    "roofing",
    "demo",
    "cleanup"
  ],
  "sequence": [
    "Order materials (roof-top delivery)",
    "Tear off",
    "Deck repair",
    "Underlayment, ice & water, drip edge",
    "Shingles, flashing, ridge",
    "Cleanup and magnet sweep"
  ],
  "holdPoints": [
    "Weather window",
    "Permit before tear-off where required"
  ],
  "proposal": {
    "scope": [
      "Remove the existing roof and install the selected shingle system with underlayment, flashing and ventilation."
    ],
    "exclusions": [
      "Decking beyond the allowance (billed per sheet)",
      "Chimney rebuild",
      "Skylight replacement unless listed"
    ],
    "selections": [
      "Shingle line and color",
      "Drip edge color"
    ]
  },
  "cvsReplaces": [
    "roof_tearoff",
    "roof_shingles"
  ]
};

export const workItems = [
  { key: 'roof_tearoff', trade: 'Roofing', name: 'Roof tear-off & deck repair', icon: 'trash', kinds: ['roof'], cls: 'roofing', ltrade: 'roofer',
    keywords: ['tear off', 'tear-off', 'strip the roof', 'remove shingles', 'reroof', 're-roof', 'replace the roof', 'roof replacement', 'new roof'],
    options: [num('layers', 'Layers to remove', null, 'Default: from the roof measurement'), sel('deck', 'Deck replacement allowance', [{ v: 0, label: 'None' }, { v: 0.05, label: '5% of deck' }, { v: 0.1, label: '10% of deck' }, { v: 0.25, label: '25% of deck' }], 0.05)],
    items: (c) => { const layers = c.n('layers', c.layers || 1); const sq = c.roofSq; const out = []; if (layers > 0) { out.push(L(`Tear off ${layers} layer${layers > 1 ? 's' : ''} of shingles & underlayment`, 'sq', up(sq, 0.1), 55 + 25 * (layers - 1))); out.push(F('Roofing dumpster & disposal', 'ea', Math.max(1, Math.ceil((sq * layers) / 25)), 525, { note: '≈ one 20–30 yd per 25 squares-layers' })); out.push(L('Magnet sweep & site cleanup', 'ls', 1, 120)); } const sheets = Math.ceil((c.roofSf * Number(c.opt('deck'))) / 32); if (sheets > 0) { out.push(M('Roof decking 7/16" OSB (allowance)', 'sheet', sheets, 24, { note: 'Unit-priced: billed only if needed' })); out.push(L('Replace rotted decking', 'sheet', sheets, 38)); } return out; } },
  { key: 'roof_shingles', trade: 'Roofing', name: 'Asphalt shingle roof system', icon: 'home', kinds: ['roof'], cls: 'roofing', ltrade: 'roofer',
    keywords: ['shingle', 'shingles', 'roof', 'roofing', 'reroof', 're-roof', 'architectural shingles', 'new roof'],
    options: [sel('grade', 'Shingle line', [{ v: 95, label: '3-tab — $95/sq' }, { v: 125, label: 'Architectural — $125/sq' }, { v: 260, label: 'Designer / luxury — $260/sq' }], 125), sel('waste', 'Waste factor', [{ v: 'auto', label: 'Auto (10% gable, 15% hip)' }, { v: 0.1, label: '10%' }, { v: 0.15, label: '15%' }, { v: 0.2, label: '20% (cut-up roof)' }], 'auto'), sel('underlayment', 'Underlayment', [{ v: 'synthetic', label: 'Synthetic' }, { v: 'felt', label: '15# felt' }], 'synthetic'), sel('ice', 'Ice & water shield', [{ v: 'eaves', label: 'Eaves only' }, { v: 'eaves+valleys', label: 'Eaves + valleys' }, { v: 'cold', label: 'Cold climate (6 ft eaves + valleys)' }], 'eaves+valleys'), bool('ridgeVent', 'Ridge vent', true), num('boots', 'Pipe boots', 3)],
    items: (c) => { const sq = c.roofSq; const w = c.opt('waste') === 'auto' ? (c.hipLf > 0 ? 0.15 : 0.1) : Number(c.opt('waste')); const bundles = Math.ceil(sq * (1 + w) * 3); const perBundle = Number(c.opt('grade')) / 3; const iceSf = (c.opt('ice') === 'cold' ? 6 : 3) * c.eaveLf + (c.opt('ice') === 'eaves' ? 0 : 3 * c.valleyLf); const steep = c.pitch >= 10 ? 1.45 : c.pitch >= 8 ? 1.25 : 1; const story = 1 + 0.1 * Math.max(0, c.stories - 1);
      const out = [M('Shingles', 'bundle', bundles, Math.round(perBundle * 100) / 100, { note: `${sq.toFixed(1)} sq + ${Math.round(w * 100)}% waste · 3 bundles/sq` }), M('Starter strip', 'bundle', Math.max(1, Math.ceil((c.eaveLf + c.rakeLf) / 105)), 62), M('Hip & ridge cap', 'bundle', Math.max(c.ridgeLf + c.hipLf > 0 ? 1 : 0, Math.ceil((c.ridgeLf + c.hipLf) / 31)), 75)];
      out.push(c.opt('underlayment') === 'felt' ? M('15# felt underlayment (4 sq roll)', 'roll', Math.ceil((sq * 1.1) / 4), 32) : M('Synthetic underlayment (10 sq roll)', 'roll', Math.ceil((sq * 1.1) / 10), 165));
      if (iceSf > 0) out.push(M('Ice & water shield (2 sq roll)', 'roll', Math.ceil(iceSf / 200), 115, { note: `${Math.round(iceSf)} sf at eaves${c.opt('ice') === 'eaves' ? '' : ' and valleys'}` }));
      out.push(M('Drip edge (10 ft)', 'ea', Math.ceil(((c.eaveLf + c.rakeLf) * 1.05) / 10), 9.5), M('Roofing coil nails (7,200 ct)', 'box', Math.max(1, Math.ceil(sq / 15)), 58, { cls: 'hardware' }), M('Pipe boots / vent flashing', 'ea', c.n('boots', 3), 18), M('Step & counter flashing allowance', 'ls', 1, 85), M('Roof sealant & cap nails', 'ls', 1, 45, { cls: 'hardware' }));
      if (c.opt('ridgeVent') && c.ridgeLf > 0) { out.push(M('Ridge vent (4 ft)', 'ea', Math.ceil(c.ridgeLf / 4), 22)); out.push(L('Cut slot & install ridge vent', 'lf', Math.round(c.ridgeLf), 3.5)); }
      out.push(L('Install underlayment, ice & water, drip edge', 'sq', up(sq, 0.1), 28), L(`Install shingles (${c.pitch}/12${steep > 1 ? ', steep' : ''}${c.stories > 1 ? `, ${c.stories}-story` : ''})`, 'sq', up(sq, 0.1), Math.round(95 * steep * story * 100) / 100), L('Starter, hip & ridge, boots & flashing', 'lf', Math.round(c.eaveLf + c.rakeLf + c.ridgeLf + c.hipLf), 0.9));
      return out; } },
];

export const products = [
  { key: 'roof_system', name: 'Shingle roof system', group: 'Roofing', where: 'exterior', cls: 'roofing', unit: 'bundle', icon: 'home', measure: { kinds: ['roof'], metric: 'roofSq' }, vendors: 'ABC Supply, Beacon, SRS, Home Depot',
    attrs: [psel('tier', 'Shingle line', [['good', '3-tab'], ['better', 'Architectural'], ['best', 'Designer / luxury']], 'better'), pbool('system', 'Use the manufacturer\'s matching accessories (system warranty)', true), pbool('tearoff', 'Tear off existing roof', true)],
    price: (a) => Math.round((T(a, 95, 125, 260) / 3) * 100) / 100,
    build: ({ qty: sq, a, geo }) => { const eave = geo.eaveLf || Math.sqrt(sq * 100) * 2.2, rake = geo.rakeLf || Math.sqrt(sq * 100) * 1.6, ridge = geo.ridgeLf || Math.sqrt(sq * 100), hip = geo.hipLf || 0, valley = geo.valleyLf || 0; const w = hip > 0 ? 0.15 : 0.1; const sys = a.system ? ' (manufacturer system)' : ''; const layers = geo.layers || 1; const steep = (geo.pitch || 6) >= 8 ? 1.25 : 1;
      const parts = [P(`Starter strip${sys}`, 'bundle', Math.max(1, ceil((eave + rake) / 105)), 62, 'roofing', 'Seals the first course at eaves and rakes.'), P(`Hip & ridge cap${sys}`, 'bundle', Math.max(1, ceil((ridge + hip) / 31)), 75, 'roofing', 'Field shingles are not made to bend over ridges.'), P(`Synthetic underlayment${sys}`, 'roll', ceil((sq * 1.1) / 10), 165, 'roofing', 'Secondary water barrier under the shingles.'), P(`Ice & water shield${sys}`, 'roll', Math.max(1, ceil((eave * 3 + valley * 3) / 200)), 115, 'roofing', 'Commonly required at eaves in cold climates and in valleys; check your local rules.'), P('Drip edge (10 ft)', 'ea', ceil(((eave + rake) * 1.05) / 10), 9.5, 'roofing', 'Commonly required on eaves and rakes; check your local rules.'), P('Roofing coil nails', 'box', Math.max(1, ceil(sq / 15)), 58, 'hardware', '4–6 nails per shingle per the manufacturer.'), P('Pipe boots', 'ea', 3, 18, 'roofing', 'Old boots crack and are the #2 leak source.'), P('Ridge vent', 'ea', ceil(ridge / 4), 22, 'roofing', 'Balanced ventilation is required for the shingle warranty.', 'recommended'), P('Step & counter flashing allowance', 'ls', 1, 85, 'roofing', 'Walls, chimneys and skylights.')];
      const labor = [LAB('Install underlayment, ice & water, drip edge', sq * 0.45, 'roofer'), LAB('Install shingles, starter, ridge & flashing', sq * 1.6 * steep, 'roofer')]; const fees = [];
      if (a.tearoff) { labor.unshift(LAB(`Tear off ${layers} layer${layers > 1 ? 's' : ''}`, sq * 0.9 * layers, 'roofer')); fees.push(FEE('Roofing dumpster & disposal', 'ea', Math.max(1, ceil((sq * layers) / 25)), 525, 'About one 20–30 yd container per 25 squares-layers.')); parts.push(P('Decking repair allowance (OSB)', 'sheet', ceil(sq * 0.5), 24, 'lumber', 'Unit-priced: billed only for rotted sheets found.', 'recommended')); }
      fees.push(FEE('Roofing permit', 'ea', 1, 150, 'Most municipalities require a re-roof permit.'));
      return { main: { qty: ceil(sq * (1 + w) * 3), note: `${sq.toFixed(1)} sq + ${Math.round(w * 100)}% waste · 3 bundles/sq` }, parts, labor, fees, notes: ['Matching manufacturer accessories qualify most lines for the enhanced system warranty.', 'Check attic ventilation (1 sf net free area per 150–300 sf of attic).'] }; } },
];

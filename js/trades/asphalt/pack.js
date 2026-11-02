// Trade pack: Asphalt & sealcoating. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "asphalt",
  "name": "Asphalt & sealcoating",
  "cvsModules": [
    "parking_lot",
    "road"
  ],
  "areaKinds": [
    "flat"
  ],
  "measurements": [
    "driveway_area"
  ],
  "trades": [
    "paving"
  ],
  "sequence": [
    "Clean and crack fill",
    "Sealcoat or pave",
    "Cure and re-open"
  ],
  "holdPoints": [
    "Dry weather, above 50°F"
  ],
  "proposal": {
    "scope": [
      "Clean, repair and seal or pave the listed area."
    ],
    "exclusions": [
      "Base failures beyond the listed repair",
      "Line striping unless listed"
    ],
    "selections": [
      "Number of coats",
      "Striping layout"
    ]
  },
  "cvsReplaces": [
    "sealcoat",
    "asphalt_paving"
  ]
};

export const workItems = [
  { key: 'sealcoat', trade: 'Asphalt & Paving', name: 'Asphalt sealcoating & crack fill', icon: 'layers', kinds: ['flat'], cls: 'paving', ltrade: 'paving',
    keywords: ['sealcoat', 'seal coat', 'sealcoating', 'driveway sealer', 'seal the driveway', 'crack fill', 'crack sealing'],
    options: [sel('coats', 'Coats', [{ v: 1, label: '1 coat' }, { v: 2, label: '2 coats' }], 2), num('cracks', 'Crack fill (lf)', null, 'Default: half the perimeter')],
    items: (c) => { const sf = c.flatSf; if (!sf) return []; const coats = +c.opt('coats'); const gal = Math.ceil((sf * coats) / 80); const cracks = c.n('cracks', Math.round(c.flatPerimLf * 0.5)); return [M('Asphalt emulsion sealer (5 gal pail)', 'pail', Math.ceil(gal / 5), 38, { note: `${gal} gal at ~80 sf/gal/coat` }), M('Silica sand additive (50 lb)', 'bag', Math.max(1, Math.ceil(gal / 25)), 14), M('Crack filler', 'lf', cracks, 0.45), M('Oil-spot primer', 'ls', 1, 25), L('Clean, edge & prime oil spots', 'sf', Math.round(sf), 0.08), L('Crack fill', 'lf', cracks, 0.6), L(`Apply sealcoat — ${coats} coat${coats > 1 ? 's' : ''}`, 'sf', Math.round(sf), 0.09 * coats), F('Mobilization', 'ea', 1, 150)]; } },
  { key: 'asphalt_paving', trade: 'Asphalt & Paving', name: 'Asphalt paving (overlay or new)', icon: 'layers', kinds: ['flat'], cls: 'paving', ltrade: 'paving',
    keywords: ['asphalt', 'blacktop', 'pave the driveway', 'paving', 'repave', 'overlay', 'new driveway'],
    options: [sel('thickness', 'Asphalt thickness', [{ v: 2, label: '2" (overlay)' }, { v: 3, label: '3" (new residential)' }], 3), sel('base', 'Stone base', [{ v: 0, label: 'Existing base OK' }, { v: 4, label: '4" new base' }, { v: 6, label: '6" new base' }], 4), bool('remove', 'Remove existing asphalt', true)],
    items: (c) => { const sf = c.flatSf; if (!sf) return []; const t = Number(c.opt('thickness')); const base = Number(c.opt('base')); const tons = Math.ceil(((sf * (t / 12) * 145) / 2000) * 1.05 * 10) / 10; const out = [M('Hot-mix asphalt', 'ton', tons, 95, { note: `${t}" compacted, 145 lb/cf` })]; if (base) out.push(M(`Aggregate base ${base}"`, 'ton', Math.ceil(((sf * (base / 12)) / 27) * 1.4 * 10) / 10, 32)); if (c.opt('remove')) out.push(L('Remove existing asphalt & haul', 'sf', Math.round(sf), 1.6)); out.push(L('Grade & compact base', 'sf', Math.round(sf), 0.9), L('Pave & roll', 'sf', Math.round(sf), 1.4), F('Equipment mobilization (paver, roller)', 'ea', 1, 850)); return out; } },
];

export const products = [
];

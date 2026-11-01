// Trade pack: Concrete & pavers. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "concrete",
  "name": "Concrete & pavers",
  "cvsModules": [
    "driveway",
    "patio"
  ],
  "areaKinds": [
    "flat"
  ],
  "measurements": [
    "driveway_area",
    "patio_area"
  ],
  "trades": [
    "masonry",
    "demo"
  ],
  "sequence": [
    "Excavate",
    "Base",
    "Forms and reinforcement",
    "Place and finish / lay pavers",
    "Cure"
  ],
  "holdPoints": [
    "Concrete cure before use"
  ],
  "proposal": {
    "scope": [
      "Excavate, prepare the base and install the concrete or pavers as described."
    ],
    "exclusions": [
      "Removal of buried debris or rock",
      "Drainage systems unless listed"
    ],
    "selections": [
      "Finish or paver style and color"
    ]
  },
  "cvsReplaces": [
    "concrete_slab",
    "pavers"
  ]
};

export const workItems = [
  { key: 'concrete_slab', trade: 'Concrete & Masonry', name: 'Concrete flatwork (patio, slab, walk)', icon: 'grid', kinds: ['flat'], cls: 'masonry', ltrade: 'mason',
    keywords: ['concrete', 'slab', 'concrete patio', 'sidewalk', 'walkway', 'concrete driveway', 'pour a slab', 'flatwork'],
    options: [num('thickness', 'Thickness (in)', null, 'Default: from the area (4")'), sel('reinf', 'Reinforcement', [{ v: 0.55, label: '#4 rebar @ 18"' }, { v: 0.35, label: 'Wire mesh' }, { v: 0.15, label: 'Fiber mix' }], 0.55), sel('finish', 'Finish', [{ v: 0, label: 'Broom' }, { v: 2.8, label: 'Stamped' }, { v: 1.2, label: 'Exposed aggregate' }], 0), bool('pump', 'Pump truck', false)],
    items: (c) => { const sf = c.flatSf; if (!sf) return []; const t = c.n('thickness', c.thicknessIn || 4); const cy = Math.ceil(((sf * (t / 12)) / 27) * 1.08 * 4) / 4; const finish = Number(c.opt('finish')); const out = [M('Ready-mix concrete (4,000 psi)', 'cy', cy, 175, { note: `${t}" thick + 8% overage` }), M('Gravel base 4"', 'ton', Math.ceil(((sf * (4 / 12)) / 27) * 1.4 * 10) / 10, 38), M('Reinforcement', 'sf', Math.round(sf), Number(c.opt('reinf'))), M('Form boards & stakes', 'lf', Math.round(c.flatPerimLf), 1.6, { cls: 'lumber' }), M('Expansion joint & sealant', 'lf', Math.round(c.flatPerimLf * 0.5), 1.2)];
      if (cy < 4) out.push(F('Short-load fee (under 4 cy)', 'ea', 1, 95)); if (c.opt('pump')) out.push(F('Concrete pump truck', 'ea', 1, 650)); if (finish >= 2) out.push(M('Stamp release & sealer', 'sf', Math.round(sf), 0.65));
      out.push(L('Excavate & grade', 'sf', Math.round(sf), 1.4), L('Set forms, base & reinforcement', 'sf', Math.round(sf), 1.8), L('Place & finish concrete', 'sf', Math.round(sf), 3.2 + finish)); return out; } },
  { key: 'pavers', trade: 'Concrete & Masonry', name: 'Paver patio / walkway', icon: 'grid', kinds: ['flat'], cls: 'masonry', ltrade: 'mason',
    keywords: ['paver', 'pavers', 'paver patio', 'hardscape', 'brick patio'],
    options: [sel('grade', 'Paver', [{ v: 3.5, label: 'Standard concrete — $3.50/sf' }, { v: 5.5, label: 'Architectural — $5.50/sf' }, { v: 9, label: 'Premium / natural stone — $9.00/sf' }], 5.5)],
    items: (c) => { const sf = c.flatSf; if (!sf) return []; const baseTons = Math.ceil(((sf * (6 / 12)) / 27) * 1.4 * 10) / 10; return [M('Pavers', 'sf', Math.ceil(sf * 1.05), Number(c.opt('grade')), { note: '5% waste' }), M('Crushed stone base 6"', 'ton', baseTons, 36), M('Bedding sand 1"', 'ton', Math.ceil(((sf * (1 / 12)) / 27) * 1.35 * 10) / 10, 42), M('Geotextile fabric', 'sf', Math.ceil(sf * 1.1), 0.25), M('Edge restraint (8 ft) + spikes', 'ea', Math.ceil(c.flatPerimLf / 8), 14), M('Polymeric sand (50 lb)', 'bag', Math.ceil(sf / 60), 32), F('Equipment rental (plate compactor, wet saw)', 'day', Math.max(1, Math.ceil(sf / 400)), 165), L('Excavate 8–9" & haul spoils', 'sf', Math.round(sf), 2.6), L('Install & compact base', 'sf', Math.round(sf), 2.4), L('Lay, cut & edge pavers, sweep in sand', 'sf', Math.round(sf), 6.5)]; } },
];

export const products = [
];

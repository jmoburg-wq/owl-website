// Trade pack: Fences. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "fences",
  "name": "Fences",
  "cvsModules": [
    "fence",
    "fence_restore"
  ],
  "areaKinds": [
    "linear"
  ],
  "measurements": [
    "fence_length"
  ],
  "trades": [
    "fencing",
    "carpentry"
  ],
  "sequence": [
    "Locate utilities (811)",
    "Set posts",
    "Panels and gates"
  ],
  "holdPoints": [
    "Utility locate before digging (usually 2–3 business days)"
  ],
  "proposal": {
    "scope": [
      "Install the fence and gates as described."
    ],
    "exclusions": [
      "Survey or property-line disputes",
      "Removal of trees or stumps"
    ],
    "selections": [
      "Fence style, height and color",
      "Gate locations"
    ]
  },
  "cvsReplaces": [
    "fence"
  ]
};

export const workItems = [
  { key: 'fence', trade: 'Fencing', name: 'Fence', icon: 'ruler', kinds: ['linear'], cls: 'fence', ltrade: 'carpenter',
    keywords: ['fence', 'fencing', 'privacy fence', 'chain link', 'vinyl fence', 'wood fence'],
    options: [sel('type', 'Fence type', [{ v: 'wood', label: 'Wood privacy 6 ft' }, { v: 'vinyl', label: 'Vinyl privacy 6 ft' }, { v: 'chain', label: 'Chain link 4 ft' }, { v: 'aluminum', label: 'Aluminum ornamental 4 ft' }], 'wood'), num('gates', 'Gates', null, 'Default: from the measurement'), bool('remove', 'Remove old fence', false)],
    items: (c) => { const lf = Math.round(c.linLf); if (!lf) return []; const t = c.opt('type'); const P = { wood: [16, 18, 95], vinyl: [32, 45, 280], chain: [10, 28, 120], aluminum: [30, 42, 260] }[t]; const posts = Math.ceil(lf / 8) + 1 + c.turns; const gates = c.n('gates', c.gates); const out = [M(t === 'chain' ? 'Chain link fabric, top rail & ties' : 'Fence panels / pickets & rails', 'lf', lf, P[0]), M('Fence posts', 'ea', posts, P[1]), M('Post concrete (50 lb fast-set)', 'bag', posts * 2, 7.5, { cls: 'masonry' }), M('Brackets, caps & fasteners', 'lf', lf, 0.6, { cls: 'hardware' })]; if (gates) out.push(M('Gate kit with hinges & latch', 'ea', gates, P[2])); if (c.opt('remove')) out.push(L('Remove old fence & haul', 'lf', lf, 5)); out.push(L('Call 811, lay out & dig post holes', 'ea', posts, 32), L('Set posts in concrete', 'ea', posts, 18), L('Install panels, rails & pickets', 'lf', lf, t === 'chain' ? 6 : 9)); if (gates) out.push(L('Build & hang gates', 'ea', gates, 85)); return out; } },
];

export const products = [
  { key: 'fence_system', name: 'Fence', group: 'Outdoor', where: 'exterior', cls: 'fence', unit: 'lf', icon: 'ruler', measure: { kinds: ['linear'], metric: 'linLf' }, vendors: 'Home Depot, Lowe\'s, fence suppliers, lumber yards',
    attrs: [psel('type', 'Fence', [['wood', 'Wood privacy 6 ft — $16/lf'], ['vinyl', 'Vinyl privacy 6 ft — $32/lf'], ['chain', 'Chain link 4 ft — $10/lf'], ['aluminum', 'Aluminum 4 ft — $30/lf']], 'wood')],
    price: (a) => ({ wood: 16, vinyl: 32, chain: 10, aluminum: 30 }[a.type]),
    build: ({ qty: lf, a, geo }) => { const t = a.type; const posts = ceil(lf / 8) + 1 + (geo.turns || 0); const gates = geo.gates || 0; const PP = { wood: [18, 95], vinyl: [45, 280], chain: [28, 120], aluminum: [42, 260] }[t];
      return { parts: [P('Fence posts', 'ea', posts, PP[0], 'fence', 'Every 8 ft plus ends and corners.'), P('Post concrete (50 lb fast-set)', 'bag', posts * 2, 7.5, 'masonry', 'Two bags per post.'), P('Brackets, caps & fasteners', 'lf', Math.round(lf), 0.6, 'hardware', 'Panel brackets, post caps and screws.')].concat(gates ? [P('Gate kit with hinges & latch', 'ea', gates, PP[1], 'fence', 'Gates need their own hardware and a stout post.')] : []).concat(t === 'wood' ? [P('Stain / sealer', 'gal', ceil(lf / 75), 38, 'paint', 'Protects new wood after it dries out (4–8 weeks).', 'optional')] : []), labor: [LAB('Call 811, lay out & dig post holes', posts * 0.45, 'laborer'), LAB('Set posts in concrete', posts * 0.3, 'carpenter'), LAB('Install panels, rails & pickets', lf * (t === 'chain' ? 0.08 : 0.13), 'carpenter')].concat(gates ? [LAB('Build & hang gates', gates * 1.5, 'carpenter')] : []), fees: [FEE('Fence permit (where required)', 'ea', 1, 75, 'Many towns require a fence permit and setback check.', 'optional')], notes: ['Confirm property lines (survey) before setting posts.', 'Check HOA rules on height and style.'] }; } },
];

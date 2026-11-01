// Trade pack: Gutters. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "gutters",
  "name": "Gutters",
  "cvsModules": [
    "exterior"
  ],
  "areaKinds": [
    "roof",
    "linear"
  ],
  "measurements": [
    "gutters",
    "downspouts"
  ],
  "trades": [
    "roofing"
  ],
  "sequence": [
    "Remove old gutters",
    "Form and hang",
    "Downspouts"
  ],
  "holdPoints": [],
  "proposal": {
    "scope": [
      "Install seamless gutters and downspouts."
    ],
    "exclusions": [
      "Fascia repair unless listed"
    ],
    "selections": [
      "Gutter color and size"
    ]
  },
  "cvsReplaces": [
    "gutters"
  ]
};

export const workItems = [
  { key: 'gutters', trade: 'Roofing', name: 'Seamless gutters & downspouts', icon: 'ruler', kinds: ['roof', 'linear'], cls: 'roofing', ltrade: 'roofer',
    keywords: ['gutter', 'gutters', 'downspout', 'downspouts', 'seamless gutter'],
    options: [sel('size', 'Size', [{ v: 2.4, label: '5" K-style aluminum' }, { v: 3.1, label: '6" K-style aluminum' }], 2.4), num('downspouts', 'Downspouts', null, 'Default: 1 per 35 lf, min 2'), bool('guards', 'Gutter guards', false), bool('remove', 'Remove old gutters', true)],
    items: (c) => { const lf = Math.round(c.roofSq > 0 ? c.eaveLf : c.linLf); if (!lf) return []; const ds = c.n('downspouts', Math.max(2, Math.ceil(lf / 35))); const story = 1 + 0.15 * Math.max(0, (c.stories || 1) - 1); const out = [M('Seamless gutter (formed on site)', 'lf', Math.ceil(lf * 1.05), Number(c.opt('size'))), M('Downspout 10 ft + 2 elbows', 'ea', ds, 32), M('Hidden hangers', 'ea', Math.ceil(lf / 2), 2.2, { cls: 'hardware' }), M('End caps, outlets, miters & sealant', 'ls', 1, Math.round(25 + lf * 0.4))];
      if (c.opt('remove')) out.push(L('Remove old gutters & haul', 'lf', lf, 1.25)); out.push(L('Form & hang seamless gutters', 'lf', lf, Math.round(4.5 * story * 100) / 100), L('Install downspouts & splash blocks', 'ea', ds, 35)); if (c.opt('guards')) out.push(M('Gutter guards', 'lf', lf, 3.8), L('Install gutter guards', 'lf', lf, 2.5)); return out; } },
];

export const products = [
  { key: 'gutter_system', name: 'Seamless gutters', group: 'Roofing', where: 'exterior', cls: 'roofing', unit: 'lf', icon: 'ruler', measure: { kinds: ['roof', 'linear'], metric: 'gutterLf' }, vendors: 'ABC Supply, gutter suppliers',
    attrs: [psel('size', 'Gutter', [['5', '5" K-style'], ['6', '6" K-style']], '5'), pbool('guards', 'Gutter guards', false)],
    price: (a) => (a.size === '6' ? 3.1 : 2.4),
    build: ({ qty: lf, a }) => { const ds = Math.max(2, ceil(lf / 35)); return { main: { qty: ceil(lf * 1.05) }, parts: [P('Downspouts 10 ft + elbows', 'ea', ds, 32, 'roofing', 'One per 35 ft of gutter (min 2).'), P('Hidden hangers', 'ea', ceil(lf / 2), 2.2, 'hardware', 'Every 24".'), P('End caps, outlets, miters & sealant', 'ls', 1, Math.round(25 + lf * 0.4), 'roofing', 'Trim pieces for every run.'), P('Splash blocks / extensions', 'ea', ds, 12, 'roofing', 'Move water 4–6 ft from the foundation.', 'recommended')].concat(a.guards ? [P('Gutter guards', 'lf', lf, 3.8, 'roofing', 'Keeps leaves out.')] : []), labor: [LAB('Remove old gutters', lf * 0.02, 'roofer'), LAB('Form & hang gutters, downspouts', lf * 0.09 + ds * 0.5, 'roofer')].concat(a.guards ? [LAB('Install guards', lf * 0.04, 'roofer')] : []), fees: [], notes: ['Pitch gutters 1/4" per 10 ft toward outlets.'] }; } },
];

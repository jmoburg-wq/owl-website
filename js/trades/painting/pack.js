// Trade pack: Painting. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "painting",
  "name": "Painting",
  "cvsModules": [
    "interior_paint",
    "commercial_paint"
  ],
  "areaKinds": [
    "room",
    "exterior"
  ],
  "measurements": [
    "wall_area",
    "floor_area"
  ],
  "trades": [
    "paint",
    "carpentry"
  ],
  "sequence": [
    "Protect floors and furniture",
    "Patch and prep",
    "Prime",
    "Paint ceilings, then walls, then trim",
    "Touch-up and cleanup"
  ],
  "holdPoints": [],
  "proposal": {
    "scope": [
      "Prepare, prime and paint the listed surfaces in the colors selected."
    ],
    "exclusions": [
      "Repair of hidden water damage",
      "Lead paint abatement (pre-1978 homes are tested first)"
    ],
    "selections": [
      "Colors and sheen for each surface",
      "Are furniture and wall items moved by the client?"
    ]
  },
  "cvsReplaces": []
};

export const workItems = [
  { key: 'paint_walls', trade: 'Painting', name: 'Paint walls', icon: 'wand',
    keywords: ['paint', 'painting', 'repaint', 'paint the walls', 'wall paint', 'color'],
    options: [sel('coats', 'Coats', [{ v: 1, label: '1 coat' }, { v: 2, label: '2 coats' }], 2), sel('primer', 'Primer', [{ v: 'spot', label: 'Spot prime' }, { v: 'full', label: 'Full prime' }, { v: 'none', label: 'None' }], 'spot'), sel('grade', 'Paint grade', [{ v: 'contractor', label: 'Contractor ($42/gal)' }, { v: 'premium', label: 'Premium ($68/gal)' }], 'contractor')],
    items: (c) => { const coats = +c.opt('coats'); const gal = up((c.wallSf * coats) / 350 * 1.1, 1); const price = c.opt('grade') === 'premium' ? 68 : 42; const out = [M(`Interior wall paint (${c.opt('grade')})`, 'gal', gal, price, { note: `${coats} coat${coats > 1 ? 's' : ''} over ${Math.round(c.wallSf)} sf net wall` })]; if (c.opt('primer') === 'full') out.push(M('Primer', 'gal', up(c.wallSf / 300, 1), 32)); else if (c.opt('primer') === 'spot') out.push(M('Spot primer & patch compound', 'ls', 1, Math.max(18, c.wallSf * 0.04))); out.push(M('Painting sundries (tape, plastic, rollers)', 'sf', Math.round(c.wallSf), 0.08)); out.push(L('Wall prep & masking', 'sf', Math.round(c.wallSf), 0.18)); out.push(L(`Paint walls — ${coats} coat${coats > 1 ? 's' : ''}`, 'sf', Math.round(c.wallSf), 0.55 * coats)); return out; } },
  { key: 'paint_ceiling', trade: 'Painting', name: 'Paint ceiling', icon: 'wand', keywords: ['ceiling paint', 'paint ceiling', 'paint the ceiling', 'ceilings'],
    options: [sel('coats', 'Coats', [{ v: 1, label: '1 coat' }, { v: 2, label: '2 coats' }], 2)],
    items: (c) => { const coats = +c.opt('coats'); return [M('Flat ceiling paint', 'gal', up((c.ceilSf * coats) / 350 * 1.1, 1), 38), L(`Paint ceiling — ${coats} coat${coats > 1 ? 's' : ''}`, 'sf', Math.round(c.ceilSf), 0.45 * coats + 0.2)]; } },
  { key: 'paint_trim', trade: 'Painting', name: 'Paint trim & baseboard', icon: 'wand', keywords: ['paint trim', 'trim paint', 'paint baseboard', 'paint the trim', 'paint molding'],
    items: (c) => { const lf = Math.round(c.baseLf + c.casingLf + c.winTrimLf); return [M('Semi-gloss trim enamel', 'gal', up(lf * 0.45 / 350 * 1.2, 1), 58), L('Prep, caulk & paint trim', 'lf', lf, 1.85)]; } },
  { key: 'paint_doors', trade: 'Painting', name: 'Paint doors', icon: 'door', keywords: ['paint door', 'paint doors', 'door paint'],
    options: [num('count', 'Doors', null, 'Defaults to doors in the room')],
    items: (c) => { const n = c.n('count', c.doors); return [M('Door enamel & supplies', 'ea', n, 9), L('Prep & paint door (both sides) + jamb', 'ea', n, 85)]; } },
  { key: 'ext_paint', trade: 'Painting', name: 'Exterior paint', icon: 'wand', kinds: ['exterior'], cls: 'paint', ltrade: 'painter',
    keywords: ['exterior paint', 'paint the exterior', 'paint the house', 'house painting', 'exterior painting', 'repaint the house'],
    options: [sel('coats', 'Coats', [{ v: 1, label: '1 coat' }, { v: 2, label: '2 coats' }], 2), sel('prep', 'Prep', [{ v: 'light', label: 'Wash + spot scrape' }, { v: 'heavy', label: 'Full scrape + prime' }], 'light')],
    items: (c) => { const coats = +c.opt('coats'); const openLf = c.casingLf + c.winTrimLf; const heavy = c.opt('prep') === 'heavy'; return [M('Exterior acrylic paint', 'gal', Math.ceil((c.wallSf * coats * 1.1) / 300), 58), M(heavy ? 'Bonding primer (full)' : 'Spot primer', 'gal', heavy ? Math.ceil(c.wallSf / 300) : Math.max(1, Math.ceil(c.wallSf / 1500)), 42), M('Exterior caulk', 'tube', Math.ceil((openLf + c.outsideCorners * c.H) / 25), 8), M('Masking, plastic & sundries', 'sf', Math.round(c.wallSf), 0.06), L('Pressure wash', 'sf', Math.round(c.wallSf), 0.18), L(heavy ? 'Scrape, sand & prime' : 'Spot scrape & prime', 'sf', Math.round(c.wallSf), heavy ? 0.85 : 0.3), L(`Paint body — ${coats} coat${coats > 1 ? 's' : ''}`, 'sf', Math.round(c.wallSf), 0.95 * coats), L('Paint trim & openings', 'lf', Math.round(openLf), 2.25)]; } },
];

export const products = [
];

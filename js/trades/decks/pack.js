// Trade pack: Decks, porches & pergolas. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "decks",
  "name": "Decks, porches & pergolas",
  "cvsModules": [
    "deck",
    "deck_restore",
    "pergola",
    "porch"
  ],
  "areaKinds": [
    "flat"
  ],
  "measurements": [
    "deck_area"
  ],
  "trades": [
    "carpentry",
    "demo"
  ],
  "sequence": [
    "Permit",
    "Footings and inspection",
    "Framing",
    "Decking",
    "Railing and stairs"
  ],
  "holdPoints": [
    "Footing inspection before framing"
  ],
  "proposal": {
    "scope": [
      "Build the deck as described, with footings, framing, decking and railing."
    ],
    "exclusions": [
      "Grading and drainage",
      "Electrical unless listed"
    ],
    "selections": [
      "Decking line and color",
      "Railing style"
    ]
  },
  "cvsReplaces": [
    "deck_build"
  ]
};

export const workItems = [
  { key: 'deck_build', trade: 'Decks & Patios', name: 'Deck (framing, decking, railing)', icon: 'layers', kinds: ['flat'], cls: 'lumber', ltrade: 'carpenter',
    keywords: ['deck', 'build a deck', 'new deck', 'composite deck', 'trex', 'timbertech', 'decking'],
    options: [sel('decking', 'Decking', [{ v: 3.2, label: 'Pressure-treated — $3.20/sf' }, { v: 6.5, label: 'Cedar — $6.50/sf' }, { v: 9.5, label: 'Composite — $9.50/sf' }, { v: 12.5, label: 'PVC / premium composite — $12.50/sf' }], 9.5), num('railLf', 'Railing (lf)', null, 'Default: perimeter minus the house side'), num('stairs', 'Stair runs', null, 'Default: 1 if over 18" high'), bool('ledger', 'Attached to house (ledger)', true)],
    items: (c) => { const sf = c.flatSf; if (!sf) return []; const comp = Number(c.opt('decking')) >= 9; const attached = c.opt('ledger'); const ledgerLf = attached ? (c.attachedLf || Math.max(c.flatW, c.flatD)) : 0; const rail = c.n('railLf', Math.max(0, Math.round(c.flatPerimLf - ledgerLf))); const stairs = c.n('stairs', c.heightFt > 1.5 ? 1 : 0); const posts = Math.max(4, Math.ceil(sf / 48));
      const out = [M('Framing lumber — PT joists, beams, rim (2×8/2×10)', 'sf', Math.round(sf), 4.2), M('Joist hangers, post bases & structural screws', 'sf', Math.round(sf), 0.85, { cls: 'hardware' }), M('6×6 PT posts', 'ea', posts, 48), M('Footings — tube form + concrete', 'ea', posts, 42, { cls: 'masonry' }), M('Decking boards', 'sf', Math.ceil(sf * 1.1), Number(c.opt('decking')), { note: '10% waste' }), M(comp ? 'Hidden fastener clips (manufacturer system)' : 'Deck screws (coated)', 'sf', Math.round(sf), comp ? 1.1 : 0.35, { cls: 'hardware' })];
      if (comp) out.push(M('Joist protection tape', 'sf', Math.round(sf), 0.25, { note: 'Required by some composite warranties' }), M('Composite fascia boards', 'lf', Math.round(c.flatPerimLf), 8));
      if (attached) out.push(M('Ledger flashing + structural ledger screws', 'lf', Math.round(ledgerLf), 4.5, { note: 'Missing ledger flashing is the #1 cause of deck rot' }));
      if (rail) out.push(M(comp ? 'Composite railing system' : 'Wood railing (posts, rails, balusters)', 'lf', rail, comp ? 55 : 28));
      if (stairs) out.push(M('Stair stringers, treads & landing pad', 'ea', stairs, comp ? 420 : 260));
      out.push(L('Layout, dig footings & set posts', 'ea', posts, 95), L('Frame deck', 'sf', Math.round(sf), 9), L('Install decking', 'sf', Math.round(sf), comp ? 6 : 4.5)); if (rail) out.push(L('Install railing', 'lf', rail, 18)); if (stairs) out.push(L('Build stairs', 'ea', stairs, 420)); return out; } },
];

export const products = [
  { key: 'deck_boards', name: 'Composite / wood deck', group: 'Outdoor', where: 'exterior', cls: 'lumber', unit: 'sf', icon: 'layers', measure: { kinds: ['flat'], metric: 'sf' }, vendors: 'Lumber yards, Home Depot, Lowe\'s, Trex/TimberTech dealers',
    attrs: [psel('tier', 'Decking', [['good', 'Pressure-treated — $3.20/sf'], ['better', 'Composite — $9.50/sf'], ['best', 'Premium capped PVC — $12.50/sf']], 'better'), pbool('railing', 'Railing', true), pbool('newFrame', 'New framing (not just resurfacing)', true)],
    price: (a) => T(a, 3.2, 9.5, 12.5),
    build: ({ qty: sf, a, geo }) => { const comp = a.tier !== 'good'; const perim = geo.flatPerimLf || Math.sqrt(sf) * 4; const posts = Math.max(4, ceil(sf / 48)); const parts = [P(comp ? 'Hidden fastener clips (manufacturer system)' : 'Coated deck screws', 'sf', Math.round(sf), comp ? 1.1 : 0.35, 'hardware', comp ? 'Composite warranties require the maker\'s fasteners.' : 'Two screws per joist crossing.'), P('Fascia / rim boards to match', 'lf', ceil(perim), comp ? 8 : 3, 'lumber', 'Covers the framing edge.', 'recommended')];
      if (comp) parts.push(P('Joist protection tape', 'sf', Math.round(sf), 0.25, 'lumber', 'Extends framing life under composite; some warranties require it.', 'recommended'));
      const labor = [LAB('Install decking', sf * (comp ? 0.1 : 0.075), 'carpenter')];
      if (a.newFrame) { parts.push(P('Framing lumber (PT joists, beams, rim)', 'sf', Math.round(sf), 4.2, 'lumber', 'Joists 16" o.c. (12" for diagonal decking).'), P('Joist hangers & structural screws', 'sf', Math.round(sf), 0.85, 'hardware', 'Rated connectors are commonly required; check your local rules.'), P('6×6 posts + footings', 'ea', posts, 90, 'lumber', 'Footings below frost depth.'), P('Ledger flashing & ledger screws', 'lf', Math.round(geo.attachedLf || Math.sqrt(sf)), 4.5, 'building', 'The #1 cause of deck failure is an unflashed ledger.')); labor.unshift(LAB('Footings, posts & framing', sf * 0.16 + posts * 1.5, 'carpenter')); }
      if (a.railing) { const rail = Math.round(perim * 0.75); parts.push(P(comp ? 'Railing system (posts, rails, balusters)' : 'Wood railing kit', 'lf', rail, comp ? 55 : 28, 'lumber', 'Required over 30" above grade.')); labor.push(LAB('Install railing', rail * 0.3, 'carpenter')); }
      return { main: { qty: ceil(sf * 1.1), note: `${Math.round(sf)} sf + 10% waste` }, parts, labor, fees: [FEE('Deck permit', 'ea', 1, 175, 'Most attached decks require a permit and inspections.', 'recommended')], notes: ['Composite spans: check the board\'s maximum joist spacing.', 'Call 811 before digging footings.'] }; } },
];

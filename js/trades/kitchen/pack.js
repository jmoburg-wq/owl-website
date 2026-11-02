// Trade pack: Kitchen. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "kitchen",
  "name": "Kitchen",
  "cvsModules": [
    "kitchen",
    "cabinets",
    "countertops"
  ],
  "areaKinds": [
    "room"
  ],
  "measurements": [
    "floor_area"
  ],
  "trades": [
    "carpentry",
    "finish_carpentry",
    "plumbing",
    "electrical",
    "tile"
  ],
  "sequence": [
    "Order cabinets",
    "Demo",
    "Rough plumbing and electrical",
    "Set cabinets",
    "Template countertops",
    "Install countertops",
    "Backsplash",
    "Fixtures and appliances"
  ],
  "holdPoints": [
    "Cabinet lead time",
    "Countertop template after cabinets are set; install 1–3 weeks later"
  ],
  "proposal": {
    "scope": [
      "Remove the existing kitchen finishes and install the selected cabinets, countertops, backsplash and fixtures."
    ],
    "exclusions": [
      "Appliance purchase unless listed",
      "Moving gas lines"
    ],
    "selections": [
      "Cabinet line, door style and finish",
      "Countertop material and edge",
      "Sink and faucet"
    ]
  },
  "cvsReplaces": []
};

export const workItems = [
  { key: 'cabinets', trade: 'Kitchen & Bath', name: 'Kitchen cabinets', icon: 'grid', keywords: ['cabinet', 'cabinets', 'kitchen cabinets', 'cabinetry'],
    options: [num('lf', 'Cabinet run (lf)', null, 'Default: 60% of perimeter'), sel('grade', 'Grade', [{ v: 185, label: 'Stock — $185/lf' }, { v: 350, label: 'Semi-custom — $350/lf' }, { v: 600, label: 'Custom — $600/lf' }], 350)],
    items: (c) => { const lf = c.n('lf', Math.round(c.perimLf * 0.6)); return [M('Base & wall cabinets', 'lf', lf, +c.opt('grade')), M('Hardware, fillers, toe kick, crown', 'lf', lf, 18), L('Remove old cabinets', 'lf', lf, 22), L('Install cabinets (level, shim, secure)', 'lf', lf, 85)]; } },
  { key: 'countertops', trade: 'Kitchen & Bath', name: 'Countertops', icon: 'grid', keywords: ['countertop', 'countertops', 'counter', 'quartz', 'granite'],
    options: [num('sf', 'Countertop (sf)', null, 'Default: cabinet run × 2.1'), sel('type', 'Material', [{ v: 45, label: 'Laminate — $45/sf installed' }, { v: 75, label: 'Quartz — $75/sf installed' }, { v: 85, label: 'Granite — $85/sf installed' }], 75)],
    items: (c) => { const sf = c.n('sf', Math.round(c.perimLf * 0.6 * 2.1)); return [M('Countertop slab, fabricated & installed', 'sf', sf, +c.opt('type')), L('Template, plumbing disconnect/reconnect', 'ls', 1, 285)]; } },
  { key: 'backsplash', trade: 'Kitchen & Bath', name: 'Tile backsplash', icon: 'grid', keywords: ['backsplash', 'subway tile'],
    options: [num('sf', 'Backsplash (sf)', null, 'Default: cabinet run × 1.5')],
    items: (c) => { const sf = c.n('sf', Math.round(c.perimLf * 0.6 * 1.5)); return [M('Backsplash tile', 'sf', up(sf * 1.15, 1), 8.5), M('Thinset, grout, trim pieces', 'sf', sf, 1.6), L('Set & grout backsplash', 'sf', sf, 18)]; } },
];

export const products = [
  { key: 'kitchen_faucet', name: 'Kitchen faucet', group: 'Plumbing', where: 'interior', cls: 'plumbing', unit: 'ea', icon: 'home', vendors: 'Ferguson, Home Depot, Lowe\'s',
    attrs: [TIER, pbool('soap', 'Add soap dispenser', false)], price: (a) => T(a, 120, 240, 420),
    build: ({ qty: q, a }) => ({ parts: [P('1/4-turn angle stops', 'ea', q * 2, 14, 'plumbing', 'Old valves under the sink are often seized.', 'recommended'), P('Braided supply lines (if not included)', 'ea', q * 2, 9, 'plumbing', 'Many pull-downs include them — check the box.', 'optional'), P('Deck plate (3-hole sinks)', 'ea', q, 18, 'plumbing', 'Covers unused holes when going to a single-handle faucet.', 'optional'), P('Plumber\'s putty / silicone', 'ea', 1, 6, 'hardware', 'Seals the base.')].concat(a.soap ? [P('Soap dispenser', 'ea', q, 35, 'plumbing', 'Uses a spare sink hole.')] : []), labor: [LAB('Remove old faucet', 0.5 * q, 'plumber'), LAB('Install faucet & test', 1 * q, 'plumber')], fees: [], notes: ['Confirm sink hole count and spacing.', 'Pull-down faucets need clearance above for the spout.'] }) },
  { key: 'disposal', name: 'Garbage disposal', group: 'Plumbing', where: 'interior', cls: 'plumbing', unit: 'ea', icon: 'bolt', vendors: 'Home Depot, Lowe\'s, Ferguson',
    attrs: [psel('hp', 'Motor', [['0.33', '1/3 HP'], ['0.5', '1/2 HP'], ['0.75', '3/4 HP']], '0.5'), pbool('outlet', 'Outlet already under the sink', true)], price: (a) => ({ 0.33: 95, 0.5: 150, 0.75: 230 }[a.hp]),
    build: ({ qty: q, a }) => { const parts = [P('Power cord kit', 'ea', q, 15, 'electrical', 'Most disposals ship without a cord.'), P('Disposal tailpiece / P-trap kit', 'ea', q, 14, 'plumbing', 'Trap height changes with the disposal outlet.'), P('Plumber\'s putty', 'ea', 1, 6, 'hardware', 'Seals the sink flange.')]; const labor = [LAB('Install disposal & connect drain/dishwasher', 1.25 * q, 'plumber')];
      if (!a.outlet) { parts.push(P('Switched outlet: box, wire, switch, GFCI', 'ls', q, 45, 'electrical', 'Powers the disposal: a switched outlet or a hardwired connection, as the maker\'s instructions call for.')); labor.push(LAB('Run circuit & add switched outlet', 2.5 * q, 'electrician')); }
      return { parts, labor, fees: [], notes: ['Knock out the dishwasher plug if a dishwasher connects to it.'] }; } },
  { key: 'dishwasher', name: 'Dishwasher', group: 'Kitchen', where: 'interior', cls: 'kitchen', unit: 'ea', icon: 'grid', vendors: 'Home Depot, Lowe\'s, Best Buy',
    attrs: [TIER, pbool('replace', 'Replacing an existing dishwasher', true)], price: (a) => T(a, 450, 750, 1150),
    build: ({ qty: q, a }) => ({ parts: [P('Dishwasher install kit (braided line + 90° elbow)', 'ea', q, 18, 'plumbing', 'Supply line and elbow are not included with most units.'), P('Power cord kit / connectors', 'ea', q, 15, 'electrical', 'Depends on whether the circuit is plug-in or hardwired.'), P('Drain hose extension / air gap', 'ea', q, 12, 'plumbing', 'Keeps drain water from flowing back into the dishwasher; use the high loop or air gap the maker\'s instructions call for.', 'recommended')], labor: [LAB('Install, level & connect dishwasher', 1.5 * q, 'plumber')].concat(a.replace ? [LAB('Remove old dishwasher', 0.75 * q, 'plumber')] : []), fees: a.replace ? [FEE('Appliance haul-away', 'ea', q, 30, 'Appliance recycling fee.')] : [], notes: ['Check the cabinet opening (usually 24" W × 34" H).'] }) },
  { key: 'cabinets', name: 'Kitchen cabinets', group: 'Kitchen', where: 'interior', cls: 'kitchen', unit: 'lf', icon: 'grid', vendors: 'Home Depot, Lowe\'s, cabinet dealers',
    attrs: [psel('tier', 'Line', [['good', 'Stock — $185/lf'], ['better', 'Semi-custom — $350/lf'], ['best', 'Custom — $600/lf']], 'better'), pnum('pulls', 'Pulls/knobs', null, 'Default: about 1 per foot')],
    price: (a) => T(a, 185, 350, 600),
    build: ({ qty: lf, a }) => { const pulls = Number(a.pulls) > 0 ? Number(a.pulls) : ceil(lf * 0.9); return { parts: [P('Cabinet pulls / knobs', 'ea', pulls, T(a, 4, 9, 22), 'hardware', 'Rarely included with the boxes.'), P('Fillers, toe kick & scribe molding', 'lf', ceil(lf), 9, 'kitchen', 'Closes gaps at walls and the floor.'), P('Crown molding (to match)', 'lf', ceil(lf * 0.5), 14, 'kitchen', 'Finishes the top of upper cabinets.', 'recommended'), P('Cabinet screws & shims', 'ls', 1, 25, 'hardware', 'Anchor to studs.'), P('Under-cabinet LED lighting', 'lf', ceil(lf * 0.5), 18, 'electrical', 'High-impact upgrade during a cabinet job.', 'optional')], labor: [LAB('Remove old cabinets', lf * 0.3, 'carpenter'), LAB('Install & level cabinets', lf * 0.9, 'carpenter'), LAB('Install hardware', pulls * 0.1, 'carpenter'), LAB('Disconnect/reconnect sink & appliances', 2, 'plumber')], fees: [FEE('Cabinet debris disposal', 'ls', 1, 120, 'Bulky debris.')], notes: ['Lead time: stock 1–2 weeks, semi-custom 4–8 weeks.', 'Order countertops after cabinets are set (template on site).'] }; } },
];

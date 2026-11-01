// Trade pack: Windows & doors. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "windows_doors",
  "name": "Windows & doors",
  "cvsModules": [],
  "areaKinds": [
    "room",
    "exterior"
  ],
  "measurements": [
    "windows",
    "entry_doors",
    "garage_doors"
  ],
  "trades": [
    "carpentry",
    "finish_carpentry",
    "glass"
  ],
  "sequence": [
    "Measure and order",
    "Remove old unit",
    "Install, flash and seal",
    "Interior and exterior trim"
  ],
  "holdPoints": [
    "Made-to-order windows and doors: confirm lead time before scheduling"
  ],
  "proposal": {
    "scope": [
      "Remove and dispose of the old units and install the selected windows and doors with flashing and trim."
    ],
    "exclusions": [
      "Structural header changes",
      "Interior painting beyond trim touch-up"
    ],
    "selections": [
      "Product line, color and hardware finish",
      "Grille pattern"
    ]
  },
  "cvsReplaces": []
};

export const workItems = [
  { key: 'door_casing', trade: 'Trim & Doors', name: 'Door casing', icon: 'door', keywords: ['casing', 'door trim', 'door casing'],
    options: [num('count', 'Doors', null, 'Defaults to doors in the room')],
    items: (c) => { const n = c.n('count', c.doors); return [M('Casing set (2¼" colonial, primed)', 'ea', n, 42), L('Install door casing', 'ea', n, 68)]; } },
  { key: 'interior_door', trade: 'Trim & Doors', name: 'Replace interior doors', icon: 'door', keywords: ['new door', 'replace door', 'interior door', 'doors', 'prehung'],
    options: [num('count', 'Doors', null, 'Defaults to doors in the room'), sel('type', 'Door', [{ v: 185, label: 'Hollow-core prehung — $185' }, { v: 320, label: 'Solid-core prehung — $320' }], 185)],
    items: (c) => { const n = c.n('count', c.doors); return [M('Prehung interior door', 'ea', n, +c.opt('type')), M('Lockset / hinges', 'ea', n, 38), L('Remove old door, install & adjust prehung', 'ea', n, 175)]; } },
  { key: 'window_trim', trade: 'Trim & Doors', name: 'Window trim & sills', icon: 'window', keywords: ['window trim', 'window casing', 'window sill'],
    options: [num('count', 'Windows', null, 'Defaults to windows in the room')],
    items: (c) => { const n = c.n('count', c.windows); return [M('Window casing, stool & apron', 'ea', n, 52), L('Install window trim', 'ea', n, 75)]; } },
  { key: 'window_replace', trade: 'Trim & Doors', name: 'Replace windows', icon: 'window', keywords: ['replace window', 'new window', 'window replacement', 'windows'],
    options: [num('count', 'Windows', null, 'Defaults to windows in the room'), sel('type', 'Window', [{ v: 450, label: 'Vinyl double-hung — $450' }, { v: 750, label: 'Fiberglass / composite — $750' }], 450)],
    items: (c) => { const n = c.n('count', c.windows); return [M('Replacement window', 'ea', n, +c.opt('type')), M('Flashing, foam, sealant', 'ea', n, 28), L('Remove & install replacement window', 'ea', n, 275)]; } },
];

export const products = [
  { key: 'interior_door', name: 'Interior door (prehung)', group: 'Doors & windows', where: 'interior', cls: 'windows_doors', unit: 'ea', icon: 'door', vendors: 'Home Depot, Lowe\'s, lumber yard',
    attrs: [psel('core', 'Door', [['hollow', 'Hollow core'], ['solid', 'Solid core'], ['shaker', 'Solid shaker']], 'hollow'), pbool('paint', 'Paint door & trim', true)],
    price: (a) => ({ hollow: 120, solid: 220, shaker: 360 }[a.core]),
    build: ({ qty: q, a }) => ({ parts: [P('Passage / privacy lockset', 'ea', q, 32, 'hardware', 'Prehung doors ship without knobs.'), P('Casing set (both sides)', 'ea', q, 42, 'lumber', 'Old casing rarely survives removal.'), P('Shims, finish nails & caulk', 'ls', q, 8, 'hardware', 'Set, plumb and trim the door.')].concat(a.paint ? [P('Semi-gloss enamel & primer', 'qt', q, 18, 'paint', 'Factory primer still needs finish coats.')] : []).concat([P('Door stop', 'ea', q, 5, 'hardware', 'Protects the wall from the knob.', 'recommended')]), labor: [LAB('Remove old door & casing', 0.75 * q, 'carpenter'), LAB('Set prehung door & adjust', 1.5 * q, 'carpenter'), LAB('Case both sides', 1 * q, 'carpenter')].concat(a.paint ? [LAB('Prime & paint door and casing', 1.25 * q, 'painter')] : []), fees: [FEE('Debris disposal', 'ea', q, 10, 'Old door and casing.')], notes: ['Measure the rough opening, not the old door.', 'Check swing direction (left/right hand) before ordering.'] }) },
  { key: 'window', name: 'Replacement window', group: 'Doors & windows', where: 'exterior', cls: 'windows_doors', unit: 'ea', icon: 'window', vendors: 'ABC Supply, Pella/Andersen dealers, Home Depot',
    attrs: [psel('material', 'Material', [['vinyl', 'Vinyl'], ['fiberglass', 'Fiberglass / composite'], ['wood', 'Wood, clad exterior']], 'vinyl'), psel('size', 'Size', [['sm', 'Up to 60 UI'], ['md', '61–101 UI'], ['lg', '102+ UI / picture']], 'md'), psel('install', 'Install type', [['insert', 'Insert (pocket)'], ['full', 'Full-frame tear-out']], 'insert'), pbool('pre1978', 'Home built before 1978 (lead-safe RRP)', false)],
    price: (a) => Math.round({ vinyl: 420, fiberglass: 720, wood: 1100 }[a.material] * { sm: 0.8, md: 1, lg: 1.5 }[a.size]),
    build: ({ qty: q, a }) => { const full = a.install === 'full'; const parts = [P('Low-expansion window foam', 'can', ceil(q / 2), 9, 'building', 'Seals the gap without bowing the frame.'), P('Flashing tape', 'roll', ceil(q / 3), 14, 'building', 'Integrates the window with the weather barrier.'), P('Exterior sealant', 'tube', q, 9, 'paint', 'Perimeter seal outside.'), P('Aluminum capping coil (wrap)', 'ls', q, 35, 'siding', 'Covers exposed wood trim outside.', 'recommended'), P('Interior stool, apron & casing', 'ea', q, 55, 'lumber', 'Old trim often cracks when the window comes out.', 'recommended')];
      if (full) parts.push(P('Sill pan / sill flashing', 'ea', q, 22, 'building', 'Full-frame installs must be pan-flashed.'));
      const labor = [LAB(full ? 'Tear out & install full-frame window' : 'Remove sashes & install insert window', (full ? 4 : 2) * q, 'carpenter'), LAB('Interior trim & caulk', 0.75 * q, 'carpenter'), LAB('Exterior capping & seal', 0.75 * q, 'carpenter')];
      if (a.pre1978) { parts.push(P('Lead-safe containment kit (RRP)', 'ea', q, 35, 'building', 'EPA RRP rule applies to pre-1978 homes.')); labor.push(LAB('RRP setup, cleaning & verification', 0.75 * q, 'carpenter')); }
      return { parts, labor, fees: [FEE('Old window disposal', 'ea', q, 20, 'Glass and frame disposal.')], notes: ['Measure width and height in three places; order the smallest.', 'Lead time is often 3–6 weeks for custom sizes.'] }; } },
  { key: 'entry_door', name: 'Exterior entry door (prehung)', group: 'Doors & windows', where: 'exterior', cls: 'windows_doors', unit: 'ea', icon: 'door', vendors: 'Home Depot, Lowe\'s, ABC Supply, door dealers',
    attrs: [psel('material', 'Door', [['steel', 'Steel'], ['fiberglass', 'Fiberglass'], ['fiberglass_glass', 'Fiberglass with glass']], 'fiberglass'), TIER],
    price: (a) => ({ steel: 350, fiberglass: 650, fiberglass_glass: 1200 }[a.material]),
    build: ({ qty: q, a }) => ({ parts: [P('Entry lockset + deadbolt', 'ea', q, T(a, 85, 160, 300), 'hardware', 'Prehung doors ship bored but without hardware.'), P('Door sill pan', 'ea', q, 35, 'building', 'The most common rot point under exterior doors.', 'recommended'), P('Flashing tape & low-expansion foam', 'ls', q, 22, 'building', 'Air- and water-seal the opening.'), P('Brickmold / exterior casing', 'ea', q, 45, 'lumber', 'Often damaged during removal.'), P('Interior casing set', 'ea', q, 42, 'lumber', 'Trim the inside.'), P('Exterior caulk & paint/stain kit', 'ls', q, 40, 'paint', 'Finish and seal.')], labor: [LAB('Remove old door & frame', 1.5 * q, 'carpenter'), LAB('Install prehung door, shim & adjust', 3 * q, 'carpenter'), LAB('Trim & finish', 1.5 * q, 'carpenter')], fees: [FEE('Old door disposal', 'ea', q, 35, 'Door and frame disposal.')], notes: ['Confirm handing and jamb depth (2×4 vs 2×6 wall).', 'Rekey to the client\'s existing keys if requested.'] }) },
  { key: 'patio_door', name: 'Sliding patio door', group: 'Doors & windows', where: 'exterior', cls: 'windows_doors', unit: 'ea', icon: 'door', vendors: 'ABC Supply, Pella/Andersen dealers, Home Depot',
    attrs: [psel('material', 'Material', [['vinyl', 'Vinyl'], ['fiberglass', 'Fiberglass'], ['clad', 'Wood, aluminum-clad']], 'vinyl'), psel('width', 'Width', [['6', '6 ft'], ['8', '8 ft']], '6')],
    price: (a) => Math.round({ vinyl: 900, fiberglass: 1600, clad: 3200 }[a.material] * (a.width === '8' ? 1.3 : 1)),
    build: ({ qty: q }) => ({ parts: [P('Sill pan', 'ea', q, 45, 'building', 'Required for a warranty-compliant install.'), P('Flashing tape, foam & sealant', 'ls', q, 38, 'building', 'Weather-seal the opening.'), P('Interior casing', 'ea', q, 55, 'lumber', 'Trim the inside.'), P('Exterior trim / capping', 'ls', q, 60, 'siding', 'Cover the exterior frame.'), P('Security bar / foot lock', 'ea', q, 25, 'hardware', 'Inexpensive upgrade clients appreciate.', 'optional')], labor: [LAB('Remove old door (2 people)', 4 * q, 'carpenter'), LAB('Set, shim & adjust new door (2 people)', 8 * q, 'carpenter'), LAB('Interior & exterior trim', 2 * q, 'carpenter')], fees: [FEE('Glass door disposal', 'ea', q, 45, 'Disposal of old unit.')], notes: ['Heavy units need two installers.', 'Check the subfloor at the sill for rot before ordering.'] }) },
  { key: 'garage_door', name: 'Garage door', group: 'Doors & windows', where: 'exterior', cls: 'windows_doors', unit: 'ea', icon: 'door', vendors: 'Garage door dealers, Home Depot, Lowe\'s',
    attrs: [psel('size', 'Size', [['9x7', '9 × 7 single'], ['16x7', '16 × 7 double']], '16x7'), psel('insul', 'Construction', [['none', 'Non-insulated steel'], ['ins', 'Insulated steel'], ['carriage', 'Carriage-style insulated']], 'ins'), pbool('opener', 'New opener', true)],
    price: (a) => Math.round({ none: 750, ins: 1300, carriage: 2400 }[a.insul] * (a.size === '9x7' ? 0.6 : 1)),
    build: ({ qty: q, a }) => ({ parts: [P('Perimeter weatherstrip & bottom seal', 'ea', q, 55, 'windows_doors', 'Old stops are usually brittle.'), P('Lock / handle kit', 'ea', q, 25, 'hardware', 'Manual lock for doors without openers.', 'optional')].concat(a.opener ? [P('Belt-drive opener with Wi-Fi', 'ea', q, 320, 'windows_doors', 'Quieter than chain drive.'), P('Opener outlet / wiring', 'ls', q, 25, 'electrical', 'Ceiling outlet near the motor.')] : []), labor: [LAB('Remove old door, springs & tracks', 2.5 * q * 2, 'carpenter'), LAB('Install door, tracks & torsion springs', 6 * q, 'carpenter')].concat(a.opener ? [LAB('Install & program opener', 3 * q, 'carpenter')] : []), fees: [FEE('Old door disposal', 'ea', q, 75, 'Bulky metal disposal.')], notes: ['Torsion springs store dangerous energy — trained installers only.', 'Measure headroom and side room before ordering.'] }) },
];

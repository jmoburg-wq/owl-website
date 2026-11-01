// Trade pack: Drywall, electrical & general. Plain data and pure functions only — no UI.
import { M, L, F, up, sel, num, bool, psel, pbool, pnum, P, LAB, FEE, ceil, TIER, T } from '../_helpers.js';

export const meta = {
  "id": "general",
  "name": "Drywall, electrical & general",
  "cvsModules": [],
  "areaKinds": [
    "room",
    "exterior",
    "roof",
    "flat",
    "linear"
  ],
  "measurements": [
    "floor_area",
    "wall_area"
  ],
  "trades": [
    "drywall",
    "electrical",
    "carpentry",
    "finish_carpentry",
    "plumbing",
    "hvac",
    "demo",
    "cleanup"
  ],
  "sequence": [
    "Protect and demo",
    "Rough framing, electrical and plumbing",
    "Inspections",
    "Insulate and drywall",
    "Trim",
    "Final cleanup"
  ],
  "holdPoints": [
    "Rough-in inspection before walls close"
  ],
  "proposal": {
    "scope": [
      "Perform the listed general construction work."
    ],
    "exclusions": [
      "Work not listed",
      "Permit fees unless listed"
    ],
    "selections": []
  },
  "cvsReplaces": []
};

export const workItems = [
  { key: 'baseboard', trade: 'Trim & Doors', name: 'Baseboard', icon: 'ruler', keywords: ['baseboard', 'baseboards', 'base trim', 'base molding', 'new base'],
    options: [sel('profile', 'Profile', [{ v: 1.45, label: '3¼" primed MDF — $1.45/lf' }, { v: 2.35, label: '5¼" primed MDF — $2.35/lf' }, { v: 3.95, label: '5¼" stain-grade hardwood — $3.95/lf' }], 2.35), bool('remove', 'Remove existing baseboard', true)],
    items: (c) => { const lf = Math.round(c.baseLf); const out = [M('Baseboard', 'lf', up(lf * 1.1, 8), +c.opt('profile'), { note: '10% waste' }), M('Fasteners, caulk, filler', 'lf', lf, 0.12), L('Install baseboard (cut, cope, nail, caulk)', 'lf', lf, 3.25)]; if (c.opt('remove')) out.unshift(L('Remove existing baseboard', 'lf', lf, 0.75)); return out; } },
  { key: 'crown', trade: 'Trim & Doors', name: 'Crown molding', icon: 'ruler', keywords: ['crown', 'crown molding', 'crown moulding'],
    items: (c) => { const lf = Math.round(c.crownLf); return [M('Crown molding (3⅝" primed)', 'lf', up(lf * 1.12, 8), 3.2), M('Fasteners, caulk, filler', 'lf', lf, 0.15), L('Install crown molding', 'lf', lf, 5.5)]; } },
  { key: 'drywall_walls', trade: 'Drywall', name: 'Drywall — walls (hang & finish)', icon: 'grid', keywords: ['drywall', 'sheetrock', 'hang drywall', 'new drywall', 'gypsum'],
    options: [sel('finish', 'Finish level', [{ v: 4, label: 'Level 4 (paint-ready)' }, { v: 5, label: 'Level 5 (skim)' }], 4), sel('texture', 'Texture', [{ v: 'none', label: 'Smooth' }, { v: 'orange', label: 'Orange peel' }, { v: 'knockdown', label: 'Knockdown' }], 'none')],
    items: (c) => { const sheets = up((c.wallSf * 1.1) / 32, 1); const out = [M('½" drywall 4×8', 'sheet', sheets, 16), M('Joint compound, tape, screws, corner bead', 'sf', Math.round(c.wallSf), 0.22), L('Hang drywall', 'sf', Math.round(c.wallSf), 0.75), L(`Tape & finish — level ${c.opt('finish')}`, 'sf', Math.round(c.wallSf), c.opt('finish') === 5 ? 1.95 : 1.25)]; if (c.opt('texture') !== 'none') out.push(L(`Spray ${c.opt('texture')} texture`, 'sf', Math.round(c.wallSf), 0.55)); return out; } },
  { key: 'drywall_ceiling', trade: 'Drywall', name: 'Drywall — ceiling', icon: 'grid', keywords: ['ceiling drywall', 'drywall ceiling', 'new ceiling'],
    items: (c) => [M('⅝" drywall 4×8 (ceiling)', 'sheet', up((c.ceilSf * 1.1) / 32, 1), 19), M('Compound, tape, screws', 'sf', Math.round(c.ceilSf), 0.24), L('Hang ceiling drywall', 'sf', Math.round(c.ceilSf), 0.95), L('Tape & finish ceiling', 'sf', Math.round(c.ceilSf), 1.35)] },
  { key: 'drywall_repair', trade: 'Drywall', name: 'Drywall repairs / patches', icon: 'grid', keywords: ['patch', 'patches', 'drywall repair', 'holes', 'fix drywall', 'repair wall'],
    options: [num('count', 'Patches', 2)],
    items: (c) => { const n = c.n('count', 2); return [M('Patch kit, compound, tape', 'ea', n, 18), L('Patch, tape, float & sand', 'ea', n, 95)]; } },
  { key: 'demo_drywall', trade: 'Drywall', name: 'Remove drywall (walls)', icon: 'trash', keywords: ['remove drywall', 'demo drywall', 'tear out walls', 'gut'],
    items: (c) => [L('Demo drywall to studs & haul', 'sf', Math.round(c.wallSf), 0.85), L('Pull nails/screws, inspect framing', 'sf', Math.round(c.wallSf), 0.15)] },
  { key: 'insulation', trade: 'Drywall', name: 'Wall insulation (batts)', icon: 'layers', keywords: ['insulation', 'insulate', 'batts', 'r-13', 'r13', 'r-15'],
    options: [sel('share', 'Walls to insulate', [{ v: 1, label: 'All walls' }, { v: 0.5, label: 'Half (exterior)' }, { v: 0.25, label: 'One wall' }], 0.5)],
    items: (c) => { const sf = Math.round(c.wallSfGross * +c.opt('share')); return [M('R-13/R-15 batt insulation', 'sf', up(sf * 1.05, 1), 0.78), M('Vapor retarder & fasteners', 'sf', sf, 0.08), L('Install batts', 'sf', sf, 0.65)]; } },
  { key: 'popcorn', trade: 'Drywall', name: 'Popcorn ceiling removal', icon: 'trash', keywords: ['popcorn', 'popcorn ceiling', 'scrape ceiling', 'textured ceiling'],
    items: (c) => [M('Plastic, compound, primer', 'sf', Math.round(c.ceilSf), 0.3), L('Mask, wet-scrape texture & haul', 'sf', Math.round(c.ceilSf), 1.95), L('Skim-coat & sand ceiling', 'sf', Math.round(c.ceilSf), 1.25)] },
  { key: 'outlets', trade: 'Electrical', name: 'Outlets & switches', icon: 'bolt', keywords: ['outlet', 'outlets', 'receptacle', 'receptacles', 'switch', 'switches', 'plugs'],
    options: [num('outlets', 'Outlets', null, 'Default: 1 per 12 lf of wall'), num('switches', 'Switches', null, 'Default: 1 per door')],
    items: (c) => { const o = c.n('outlets', Math.max(2, Math.ceil(c.perimLf / 12))); const s = c.n('switches', Math.max(1, c.doors)); return [M('Receptacle, box, plate & wire', 'ea', o, 28), M('Switch, box, plate & wire', 'ea', s, 24), L('Install receptacle (new circuit run)', 'ea', o, 85), L('Install switch', 'ea', s, 75)]; } },
  { key: 'recessed', trade: 'Electrical', name: 'Recessed LED lights', icon: 'bolt', keywords: ['recessed', 'can light', 'can lights', 'pot light', 'downlight', 'recessed lighting', 'led lights'],
    options: [num('count', 'Fixtures', null, 'Default: 1 per 40 sf'), bool('dimmer', 'Add dimmer', true)],
    items: (c) => { const n = c.n('count', Math.max(2, Math.ceil(c.sf / 40))); const out = [M('6" LED wafer/can light', 'ea', n, 38), M('Wire, connectors, boxes', 'ea', n, 12), L('Cut in, wire & install recessed light', 'ea', n, 120)]; if (c.opt('dimmer')) { out.push(M('Dimmer switch', 'ea', 1, 35)); out.push(L('Install dimmer', 'ea', 1, 65)); } return out; } },
  { key: 'ceiling_fan', trade: 'Electrical', name: 'Ceiling fan / fixture', icon: 'bolt', keywords: ['ceiling fan', 'fan', 'light fixture', 'chandelier', 'pendant'],
    options: [num('count', 'Fixtures', 1)],
    items: (c) => { const n = c.n('count', 1); return [M('Ceiling fan w/ light (mid-grade)', 'ea', n, 180), M('Fan-rated box & wire', 'ea', n, 22), L('Install fan-rated box & fixture', 'ea', n, 175)]; } },
  { key: 'framing', trade: 'General', name: 'Frame new partition wall', icon: 'ruler', keywords: ['frame', 'framing', 'new wall', 'partition', 'build a wall', 'stud wall'],
    options: [num('lf', 'Wall length (lf)', 10)],
    items: (c) => { const lf = c.n('lf', 10); return [M('2×4 studs, plates, blocking, fasteners', 'lf', lf, 14), L('Layout & frame wall', 'lf', lf, 28)]; } },
  { key: 'demo_general', trade: 'General', name: 'General demolition', icon: 'trash', keywords: ['demo', 'demolition', 'tear out', 'remove everything', 'gut the room'],
    options: [num('hours', 'Labor hours', null, 'Default: 1 hr per 50 sf')],
    items: (c) => { const hrs = c.n('hours', Math.max(2, Math.ceil(c.sf / 50))); return [L('Demolition labor', 'hr', hrs, 55), M('Bags, plastic, PPE', 'ls', 1, 45)]; } },
  { key: 'dumpster', trade: 'General', name: 'Dumpster / debris disposal', icon: 'trash', scope: 'project', keywords: ['dumpster', 'haul', 'debris', 'disposal', 'junk'],
    options: [sel('size', 'Size', [{ v: 325, label: 'Trailer / bagster — $325' }, { v: 450, label: '10-yard — $450' }, { v: 575, label: '20-yard — $575' }], 450)],
    items: (c) => [F('Dumpster rental incl. disposal', 'ea', 1, +c.opt('size'))] },
  { key: 'protection', trade: 'General', name: 'Site protection & furniture moving', icon: 'layers', keywords: ['protect', 'protection', 'move furniture', 'furniture', 'cover', 'floor protection'],
    items: (c) => [M('Floor protection, plastic, zip walls', 'sf', Math.round(c.sf), 0.25), L('Move furniture & protect finishes', 'hr', Math.max(2, Math.ceil(c.sf / 120)), 48)] },
  { key: 'cleanup', trade: 'General', name: 'Final cleanup', icon: 'check', scope: 'project', keywords: ['cleanup', 'clean up', 'cleaning', 'final clean'],
    items: (c) => [L('Final construction cleanup', 'hr', Math.max(2, Math.ceil(c.sf / 150)), 45)] },
  { key: 'permit', trade: 'General', name: 'Permit & inspections', icon: 'doc', scope: 'project', keywords: ['permit', 'permits', 'inspection'],
    options: [num('fee', 'Permit fee', 350)],
    items: (c) => [F('Building permit (pass-through)', 'ea', 1, c.n('fee', 350)), L('Permit filing & inspection time', 'hr', 2, 65)] },
];

export const products = [
  { key: 'water_heater', name: 'Water heater (tank)', group: 'Plumbing', where: 'interior', cls: 'plumbing', unit: 'ea', icon: 'bolt', vendors: 'Ferguson, Home Depot, Lowe\'s',
    attrs: [psel('fuel', 'Fuel', [['gas', 'Natural gas / LP'], ['electric', 'Electric']], 'gas'), psel('cap', 'Capacity', [['40', '40 gal'], ['50', '50 gal']], '50'), TIER, pbool('pan', 'Install in a living space (needs drain pan)', true)],
    price: (a) => Math.round((a.fuel === 'gas' ? { 40: 750, 50: 900 } : { 40: 600, 50: 720 })[a.cap] * T(a, 0.85, 1, 1.45)),
    build: ({ qty: q, a }) => { const gas = a.fuel === 'gas'; const parts = [P('Thermal expansion tank (2 gal)', 'ea', q, 55, 'plumbing', 'Commonly required on closed systems with a PRV or check valve; check your local rules.'), P('Water heater connectors 3/4" (pair)', 'ea', q, 28, 'plumbing', 'New flexible connectors; old ones are often corroded.'), P('3/4" full-port ball valve (cold inlet)', 'ea', q, 18, 'plumbing', 'A working shutoff is required for service.'), P('T&P discharge pipe & fittings', 'ls', q, 18, 'plumbing', 'Relief line must run to within 6" of the floor or a drain.')];
      if (gas) parts.push(P('Flexible gas connector + sediment trap', 'ea', q, 37, 'plumbing', 'A drip leg is commonly required and old connectors should not be reused; check your local rules.'), P('Vent connector & fittings', 'ls', q, 45, 'plumbing', 'New tanks often need a new draft hood connection.'));
      else parts.push(P('Wire connectors / whip as needed', 'ls', q, 12, 'electrical', 'Verify the breaker and wire gauge match the new element rating.'));
      if (a.pan) parts.push(P('Drain pan with fitting', 'ea', q, 30, 'plumbing', 'Required where a leak would damage finished space.'));
      parts.push(P('Seismic straps', 'ea', q, 25, 'plumbing', 'Required in CA, OR, WA and other seismic zones.', 'optional'));
      return { parts, labor: [LAB('Drain, disconnect & remove old heater', 1.5 * q, 'plumber'), LAB(`Set & connect new ${gas ? 'gas' : 'electric'} heater`, (gas ? 3 : 2.5) * q, 'plumber'), LAB('Fill, purge, light/energize & test', 0.75 * q, 'plumber')], fees: [FEE('Old water heater haul-away', 'ea', q, 45, 'Scrap/disposal fee.'), FEE('Plumbing permit', 'ea', 1, 85, 'Most jurisdictions require a permit for water heater replacement.')], notes: ['Two-person lift for 50 gal.', 'Confirm venting is compatible (atmospheric vs power vent) before ordering.'] }; } },
  { key: 'tankless', name: 'Tankless water heater (gas)', group: 'Plumbing', where: 'interior', cls: 'plumbing', unit: 'ea', icon: 'bolt', vendors: 'Ferguson',
    attrs: [TIER, pbool('gasUpsize', 'Gas line needs upsizing', true), pbool('condensing', 'Condensing unit (PVC vent)', true)], price: (a) => T(a, 1100, 1500, 1900),
    build: ({ qty: q, a }) => { const parts = [P(a.condensing ? 'PVC concentric vent kit' : 'Stainless Category III vent kit', 'ea', q, a.condensing ? 180 : 320, 'plumbing', 'Tankless units cannot reuse a B-vent.'), P('Isolation (service) valve kit', 'ea', q, 95, 'plumbing', 'Needed to descale the heat exchanger every year.'), P('120V outlet & cord', 'ls', q, 25, 'electrical', 'Tankless units need power for controls.')]; const labor = [LAB('Remove old tank', 1.5 * q, 'plumber'), LAB('Mount unit, repipe & vent', 6 * q, 'plumber'), LAB('Commission & test', 1 * q, 'plumber')];
      if (a.condensing) parts.push(P('Condensate neutralizer', 'ea', q, 45, 'plumbing', 'Acidic condensate must be neutralized before the drain.'));
      if (a.gasUpsize) { parts.push(P('Gas line upsizing (3/4" pipe & fittings)', 'ls', q, 180, 'plumbing', 'Tankless units need ~199,000 BTU; most 1/2" lines are too small.')); labor.push(LAB('Upsize gas line', 3 * q, 'plumber')); }
      return { parts, labor, fees: [FEE('Old heater haul-away', 'ea', q, 45, 'Disposal fee.'), FEE('Plumbing + mechanical permit', 'ea', 1, 120, 'Venting and gas work require permits.')], notes: ['Verify gas meter capacity with the utility.', 'Recommend an annual descaling service agreement.'] }; } },
  { key: 'ceiling_fan', name: 'Ceiling fan', group: 'Electrical', where: 'interior', cls: 'electrical', unit: 'ea', icon: 'bolt', vendors: 'Home Depot, Lowe\'s',
    attrs: [TIER, pbool('boxSwap', 'Replacing a light (needs fan-rated box)', true), pbool('vaulted', 'Vaulted / high ceiling (downrod)', false)], price: (a) => T(a, 120, 220, 420),
    build: ({ qty: q, a }) => { const parts = [P('Wire connectors & ground screw', 'ls', q, 4, 'electrical', 'Fresh connectors for the new fixture.')]; const labor = [LAB('Assemble, hang & wire fan', 1.5 * q, 'electrician')];
      if (a.boxSwap) { parts.push(P('Fan-rated ceiling box / brace', 'ea', q, 22, 'electrical', 'Light boxes are not rated for fan weight and vibration.')); labor.push(LAB('Swap to fan-rated box', 0.75 * q, 'electrician')); }
      if (a.vaulted) parts.push(P('Extended downrod', 'ea', q, 30, 'electrical', 'Keeps blades 7–9 ft off the floor on high ceilings.'));
      parts.push(P('Wall control / remote', 'ea', q, 45, 'electrical', 'Separate fan and light control.', 'optional'));
      return { parts, labor, fees: [], notes: ['Confirm joist or blocking above for the brace.'] }; } },
  { key: 'light_fixture', name: 'Light fixture', group: 'Electrical', where: 'interior', cls: 'electrical', unit: 'ea', icon: 'bolt', vendors: 'Home Depot, Lowe\'s, lighting showrooms',
    attrs: [TIER, pnum('bulbs', 'Bulbs per fixture', 2)], price: (a) => T(a, 60, 150, 400),
    build: ({ qty: q, a }) => ({ parts: [P('LED bulbs', 'ea', q * (Number(a.bulbs) || 0), 5, 'electrical', 'Most fixtures ship without bulbs.'), P('Wire connectors & mounting screws', 'ls', q, 4, 'electrical', 'Fresh hardware for the new crossbar.'), P('Dimmer switch (LED compatible)', 'ea', 1, 30, 'electrical', 'Old dimmers flicker with LED loads.', 'recommended')], labor: [LAB('Remove old & install fixture', 1 * q, 'electrician'), LAB('Install dimmer', 0.5, 'electrician')], fees: [], notes: ['Heavy fixtures (over 50 lb) need independent support.'] }) },
  { key: 'recessed', name: 'Recessed LED lights', group: 'Electrical', where: 'interior', cls: 'electrical', unit: 'ea', icon: 'bolt', vendors: 'Home Depot, Lowe\'s, electrical supply',
    attrs: [TIER], price: (a) => T(a, 18, 30, 55),
    build: ({ qty: q }) => ({ parts: [P('NM cable 14/2 (~15 ft per light)', 'ft', q * 15, 0.75, 'electrical', 'Daisy-chains the new lights.'), P('Wire connectors', 'ls', 1, 8, 'electrical', 'For splices in junction boxes.'), P('Dimmer switch (LED rated)', 'ea', Math.max(1, ceil(q / 6)), 35, 'electrical', 'One per zone of up to ~6 lights.'), P('Drywall patch allowance', 'ls', 1, 25, 'building', 'Fishing wire usually needs a few access holes.', 'recommended')], labor: [LAB('Layout, cut in, wire & install lights', 0.9 * q, 'electrician'), LAB('Install dimmer(s)', 0.5 * Math.max(1, ceil(q / 6)), 'electrician'), LAB('Patch access holes', 0.5 + 0.1 * q, 'drywall')], fees: [], notes: ['Use IC-rated fixtures where insulation is present.', 'Check joist direction before laying out the grid.'] }) },
  { key: 'mini_split', name: 'Ductless mini-split (1 zone)', group: 'HVAC', where: 'interior', cls: 'hvac', unit: 'ea', icon: 'bolt', vendors: 'Ferguson, HVAC distributors',
    attrs: [psel('btu', 'Capacity', [['9', '9,000 BTU'], ['12', '12,000 BTU'], ['18', '18,000 BTU']], '12'), TIER, pnum('lineSet', 'Line-set length (ft)', 25)],
    price: (a) => Math.round({ 9: 950, 12: 1100, 18: 1500 }[a.btu] * T(a, 0.9, 1, 1.6)),
    build: ({ qty: q, a }) => { const ls = Number(a.lineSet) || 25; return { parts: [P(`Line set ${ls} ft (insulated)`, 'ea', q, 120 + ls * 2.4, 'hvac', 'Copper refrigerant lines + communication wire.'), P('Wall bracket or condenser pad', 'ea', q, 65, 'hvac', 'Keeps the outdoor unit level and off the ground.'), P('Line-hide cover kit', 'ea', q, 85, 'hvac', 'Protects and hides the lines outside.', 'recommended'), P('Disconnect box + whip', 'ea', q, 45, 'electrical', 'Required within sight of the outdoor unit.'), P('240V circuit: wire & breaker', 'ls', q, 110, 'electrical', 'Dedicated circuit to the panel.'), P('Condensate pump', 'ea', q, 95, 'hvac', 'Needed when gravity drainage is not possible.', 'optional')], labor: [LAB('Mount heads & condenser, run lines', 6 * q, 'hvac'), LAB('Evacuate, charge check & commission', 1.5 * q, 'hvac'), LAB('Run 240V circuit & disconnect', 3 * q, 'electrician')], fees: [FEE('Mechanical + electrical permit', 'ea', 1, 120, 'Most jurisdictions require both.')], notes: ['Refrigerant work requires EPA 608 certification.', 'Confirm panel capacity for the new 240V circuit.'] }; } },
  { key: 'exterior_light', name: 'Exterior light fixture', group: 'Outdoor', where: 'exterior', cls: 'electrical', unit: 'ea', icon: 'bolt', vendors: 'Home Depot, Lowe\'s, lighting showrooms',
    attrs: [TIER, pbool('motion', 'Motion / dusk-to-dawn', false)], price: (a) => T(a, 45, 110, 280),
    build: ({ qty: q, a }) => ({ parts: [P('Weatherproof gasket / mounting block', 'ea', q, 11, 'electrical', 'Seals the box against water.'), P('Exterior silicone', 'tube', 1, 8, 'paint', 'Seal the top and sides; leave the bottom open to drain.'), P('LED bulbs', 'ea', q, 6, 'electrical', 'Often not included.')].concat(a.motion ? [P('Motion / photocell sensor', 'ea', q, 25, 'electrical', 'Add-on if the fixture lacks one.')] : []), labor: [LAB('Remove old & install fixture', 1 * q, 'electrician')], fees: [], notes: ['Outdoor fixtures must be wet-location rated where exposed.'] }) },
];

// regional cost indexes (national average = 1.00). Material vs labor indexes differ:
// labor varies far more by market than materials. Values are approximate 2025–26 construction cost
// index composites and are meant to be tuned by the user in Settings.
export const STATES = {
  US: { name: 'National average', material: 1.00, labor: 1.00 },
  AL: { name: 'Alabama', material: 0.96, labor: 0.78 }, AK: { name: 'Alaska', material: 1.22, labor: 1.18 }, AZ: { name: 'Arizona', material: 1.00, labor: 0.92 },
  AR: { name: 'Arkansas', material: 0.95, labor: 0.74 }, CA: { name: 'California', material: 1.08, labor: 1.32 }, CO: { name: 'Colorado', material: 1.01, labor: 0.98 },
  CT: { name: 'Connecticut', material: 1.04, labor: 1.18 }, DE: { name: 'Delaware', material: 1.02, labor: 1.08 }, DC: { name: 'District of Columbia', material: 1.05, labor: 1.15 },
  FL: { name: 'Florida', material: 0.99, labor: 0.86 }, GA: { name: 'Georgia', material: 0.97, labor: 0.84 }, HI: { name: 'Hawaii', material: 1.28, labor: 1.25 },
  ID: { name: 'Idaho', material: 0.98, labor: 0.88 }, IL: { name: 'Illinois', material: 1.01, labor: 1.22 }, IN: { name: 'Indiana', material: 0.97, labor: 0.92 },
  IA: { name: 'Iowa', material: 0.97, labor: 0.90 }, KS: { name: 'Kansas', material: 0.97, labor: 0.86 }, KY: { name: 'Kentucky', material: 0.96, labor: 0.86 },
  LA: { name: 'Louisiana', material: 0.98, labor: 0.82 }, ME: { name: 'Maine', material: 1.00, labor: 0.94 }, MD: { name: 'Maryland', material: 1.02, labor: 1.02 },
  MA: { name: 'Massachusetts', material: 1.05, labor: 1.30 }, MI: { name: 'Michigan', material: 0.98, labor: 0.98 }, MN: { name: 'Minnesota', material: 1.00, labor: 1.10 },
  MS: { name: 'Mississippi', material: 0.96, labor: 0.74 }, MO: { name: 'Missouri', material: 0.97, labor: 0.98 }, MT: { name: 'Montana', material: 0.99, labor: 0.88 },
  NE: { name: 'Nebraska', material: 0.97, labor: 0.86 }, NV: { name: 'Nevada', material: 1.02, labor: 1.04 }, NH: { name: 'New Hampshire', material: 1.01, labor: 0.98 },
  NJ: { name: 'New Jersey', material: 1.05, labor: 1.30 }, NM: { name: 'New Mexico', material: 0.98, labor: 0.82 }, NY: { name: 'New York', material: 1.07, labor: 1.38 },
  NC: { name: 'North Carolina', material: 0.97, labor: 0.80 }, ND: { name: 'North Dakota', material: 0.99, labor: 0.88 }, OH: { name: 'Ohio', material: 0.98, labor: 0.96 },
  OK: { name: 'Oklahoma', material: 0.96, labor: 0.80 }, OR: { name: 'Oregon', material: 1.03, labor: 1.08 }, PA: { name: 'Pennsylvania', material: 1.01, labor: 1.10 },
  RI: { name: 'Rhode Island', material: 1.04, labor: 1.14 }, SC: { name: 'South Carolina', material: 0.97, labor: 0.80 }, SD: { name: 'South Dakota', material: 0.98, labor: 0.82 },
  TN: { name: 'Tennessee', material: 0.96, labor: 0.82 }, TX: { name: 'Texas', material: 0.98, labor: 0.86 }, UT: { name: 'Utah', material: 0.99, labor: 0.90 },
  VT: { name: 'Vermont', material: 1.01, labor: 0.96 }, VA: { name: 'Virginia', material: 0.99, labor: 0.92 }, WA: { name: 'Washington', material: 1.04, labor: 1.12 },
  WV: { name: 'West Virginia', material: 0.97, labor: 0.92 }, WI: { name: 'Wisconsin', material: 0.99, labor: 1.04 }, WY: { name: 'Wyoming', material: 0.99, labor: 0.84 },
};

// Metro premiums layered on top of the state index (3-digit ZIP prefixes).
const METRO = [
  { prefixes: ['100', '101', '102', '103', '104', '110', '111', '112', '113', '114', '116'], name: 'New York City', material: 1.04, labor: 1.12 },
  { prefixes: ['940', '941', '943', '944', '945', '946', '947', '948', '949', '950', '951'], name: 'SF Bay Area', material: 1.05, labor: 1.15 },
  { prefixes: ['900', '901', '902', '903', '904', '905', '906', '907', '908', '910', '911', '912', '913', '914', '915', '916', '917', '918'], name: 'Los Angeles', material: 1.02, labor: 1.04 },
  { prefixes: ['980', '981', '982', '983', '984'], name: 'Seattle', material: 1.02, labor: 1.08 },
  { prefixes: ['021', '022', '023', '024'], name: 'Boston', material: 1.02, labor: 1.06 },
  { prefixes: ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223'], name: 'Washington DC metro', material: 1.02, labor: 1.06 },
  { prefixes: ['606', '607', '608'], name: 'Chicago', material: 1.01, labor: 1.06 },
  { prefixes: ['331', '332', '333'], name: 'Miami', material: 1.02, labor: 1.08 },
  { prefixes: ['802', '803', '804'], name: 'Denver', material: 1.01, labor: 1.05 },
  { prefixes: ['787'], name: 'Austin', material: 1.01, labor: 1.08 },
  { prefixes: ['750', '751', '752', '753', '760', '761', '762'], name: 'Dallas–Fort Worth', material: 1.00, labor: 1.04 },
  { prefixes: ['300', '301', '302', '303', '311'], name: 'Atlanta', material: 1.00, labor: 1.06 },
  { prefixes: ['850', '851', '852', '853'], name: 'Phoenix', material: 1.00, labor: 1.04 },
  { prefixes: ['891', '890'], name: 'Las Vegas', material: 1.01, labor: 1.04 },
];

const ZIP_RANGES = [
  ['005', '005', 'NY'], ['006', '009', 'PR'], ['010', '027', 'MA'], ['028', '029', 'RI'], ['030', '038', 'NH'], ['039', '049', 'ME'], ['050', '059', 'VT'], ['055', '055', 'MA'],
  ['060', '069', 'CT'], ['070', '089', 'NJ'], ['100', '149', 'NY'], ['150', '196', 'PA'], ['197', '199', 'DE'], ['200', '205', 'DC'], ['206', '219', 'MD'], ['220', '246', 'VA'],
  ['247', '268', 'WV'], ['270', '289', 'NC'], ['290', '299', 'SC'], ['300', '319', 'GA'], ['320', '349', 'FL'], ['350', '369', 'AL'], ['370', '385', 'TN'], ['386', '397', 'MS'],
  ['398', '399', 'GA'], ['400', '427', 'KY'], ['430', '459', 'OH'], ['460', '479', 'IN'], ['480', '499', 'MI'], ['500', '528', 'IA'], ['530', '549', 'WI'], ['550', '567', 'MN'],
  ['570', '577', 'SD'], ['580', '588', 'ND'], ['590', '599', 'MT'], ['600', '629', 'IL'], ['630', '658', 'MO'], ['660', '679', 'KS'], ['680', '693', 'NE'], ['700', '714', 'LA'],
  ['716', '729', 'AR'], ['730', '749', 'OK'], ['750', '799', 'TX'], ['800', '816', 'CO'], ['820', '831', 'WY'], ['832', '838', 'ID'], ['840', '847', 'UT'], ['850', '865', 'AZ'],
  ['870', '884', 'NM'], ['885', '885', 'TX'], ['889', '898', 'NV'], ['900', '961', 'CA'], ['967', '968', 'HI'], ['970', '979', 'OR'], ['980', '994', 'WA'], ['995', '999', 'AK'],
];

export function stateFromZip(zip) {
  const p = String(zip || '').replace(/\D/g, '').slice(0, 3);
  if (p.length < 3) return null;
  for (const [lo, hi, st] of ZIP_RANGES) if (p >= lo && p <= hi) return st;
  return null;
}

/** Returns { state, metro, material, labor, label } for a ZIP or state code. */
export function regionIndex({ zip, state } = {}) {
  const st = (zip && stateFromZip(zip)) || (state && STATES[state] ? state : 'US');
  const base = STATES[st] || STATES.US;
  let material = base.material, labor = base.labor, metro = null;
  if (zip) { const p = String(zip).replace(/\D/g, '').slice(0, 3); const m = METRO.find((x) => x.prefixes.includes(p)); if (m) { metro = m.name; material *= m.material; labor *= m.labor; } }
  return { state: st, metro, material: Math.round(material * 1000) / 1000, labor: Math.round(labor * 1000) / 1000, label: metro ? `${metro}, ${st}` : base.name };
}

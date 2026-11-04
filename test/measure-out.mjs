// Measurements back to the Studio (direction doc section 5): derivation from measured areas, the packet, the bath m= param.
import { readFileSync } from 'node:fs';
import { DEFAULTS } from '../js/store.js';
import { importCvsPackage, addMeasurement } from '../js/cvs/import.js';
import { deriveMeasurements, fillFromAreas, outgoingMeasurements, measurementPacket, bathMeasureParam, designLinkWithMeasurements, PACKET_SCHEMA } from '../js/cvs/measure-out.js';
import { makeArea, makeRect } from '../js/geometry.js';
import { DEFAULT_SUPPLIERS } from '../js/pricing/suppliers.js';

let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', m, x); } };
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const FT = 0.3048;
const fx = (f) => JSON.parse(readFileSync(new URL(`./fixtures/cvs/${f}`, import.meta.url), 'utf8'));
const st = () => { const s = structuredClone(DEFAULTS); s.settings.suppliers = structuredClone(DEFAULT_SUPPLIERS); return s; };
const imp = (pkg) => { const s = st(); const plan = importCvsPackage(structuredClone(pkg), s); if (!plan.ok) throw new Error(plan.error); return { s, p: plan.apply(s).project }; };

// roof derivation: a 40 × 30 ft gable at 6/12 with no overhang
{ const roof = makeArea({ kind: 'roof', name: 'Main roof', corners: makeRect(40 * FT, 30 * FT), source: 'manual', roof: { pitch: 6, overhang: 0, style: 'gable' } });
  const d = Object.fromEntries(deriveMeasurements({ rooms: [roof] }).map((m) => [m.kind, m]));
  ok(near(d.roof_area.value, 1200 * Math.sqrt(1 + 0.25)), 'roof area is the sloped area', d.roof_area.value);
  ok(d.roof_pitch.value === 6 && d.eaves.value === 80 && near(d.rakes.value, 2 * 30 * Math.sqrt(1.25)) && d.ridges.value === 40, 'pitch, eaves, rakes, ridge', JSON.stringify(d));
  ok(d.roof_area.source === 'measured' && d.roof_area.unit === 'sq ft', 'manual areas send as measured, in sq ft');
  const demo = makeArea({ kind: 'roof', corners: makeRect(10, 10), source: 'demo' }); ok(!deriveMeasurements({ rooms: [demo] }).length, 'demo shapes are never sent'); }

// bath room derivation and the m= parameter the Studio reads
{ const { s, p } = imp(fx('cvs-shower-neenan-hall.json'));
  p.rooms = [makeArea({ kind: 'room', name: 'Hall bath', corners: makeRect(8 * FT, 5 * FT), ceilingHeight: 8 * FT, source: 'webxr' })];
  const d = Object.fromEntries(deriveMeasurements(p).map((m) => [m.kind, m]));
  ok(d['bath.roomL'].value === 8 && d['bath.roomW'].value === 5 && d['bath.ceilingIn'].value === 96, 'bath room length, width (ft) and ceiling (in)', JSON.stringify(d));
  ok(fillFromAreas(p) > 0 && p.measurements.find((m) => m.kind === 'bath.roomL').source === 'measured', 'measured areas fill the job, ranked');
  ok(fillFromAreas(p) === 0, 'filling twice changes nothing');
  addMeasurement(p, { kind: 'bath.showerW', value: 59.5, unit: 'in', source: 'measured' }, s.settings);
  const out = outgoingMeasurements(p); ok(out.some((m) => m.kind === 'bath.showerW' && m.value === 59.5) && out.every((m) => m.source !== 'typical'), 'outgoing: new and better numbers, never the design echoed back', JSON.stringify(out.map((m) => m.kind)));
  const pk = measurementPacket(p); ok(pk.schema === PACKET_SCHEMA && pk.version === 1 && pk.designId === p.cvs.designId && pk.from.app === 'fullbid', 'packet shape');
  const m = JSON.parse(Buffer.from(bathMeasureParam(pk.measurements), 'base64url').toString('utf8'));
  ok(m.roomL === 8 && m.showerW === 59.5 && m.source.showerW === 'measured', 'bath m= carries numbers with source measured', JSON.stringify(m));
  p.cvs.design.url = 'https://rrg-studio.vercel.app/visualizer/selections?d=abc&m=old';
  const link = await designLinkWithMeasurements(p); const u = new URL(link.href);
  ok(u.searchParams.get('d') === 'abc' && u.searchParams.get('m') !== 'old' && u.hash.startsWith('#cvs-measure=d:'), 'link keeps the design query, replaces m=, adds #cvs-measure=d:', link.href.slice(0, 120));
  p.cvs.design.url = null; ok((await designLinkWithMeasurements(p)) === null, 'no design link → file only'); }

// a report-sourced roof package: echoing the report back sends nothing; a measured pitch goes
{ const { s, p } = imp(fx('cvs-roof-timbercrest.json'));
  ok(outgoingMeasurements(p).length === 0, 'nothing to send right after import');
  addMeasurement(p, { kind: 'roof_pitch', value: 7, unit: 'x/12', source: 'measured' }, s.settings);
  const out = outgoingMeasurements(p); ok(out.length === 1 && out[0].kind === 'roof_pitch', 'a measured pitch is sent', JSON.stringify(out)); }

console.log(`measurement packet tests: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);

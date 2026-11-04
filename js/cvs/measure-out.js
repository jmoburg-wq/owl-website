// Measurements back to Contractor Visual Studio (direction doc section 5): what Fullbid measured on site goes back to
// the design, so the designer can re-fit it and the quantities stop being "typical". Pure functions (no DOM).
import { MEASURE_KINDS, rankOf, mergeMeasurement } from '../shared/vocab.js';
import { areaMetrics, kindOf, toSF, toFT } from '../geometry.js';
import { encodeCvsPackage } from './import.js';

export const PACKET_SCHEMA = 'cvs.measurements';
const r1 = (v) => Math.round(v * 10) / 10;
const r0 = (v) => Math.round(v);
/** How an area was captured → the source its numbers carry. Demo shapes are never sent. */
const AREA_SOURCE = { camera: 'measured', webxr: 'measured', manual: 'measured', lidar: 'measured', report: 'report', satellite: 'satellite', photo: 'photo', typed: 'typed' };
export const areaSource = (a) => (a && a.source === 'demo' ? null : AREA_SOURCE[(a && a.source) || 'manual'] || 'typed');

/** Which flat-area kind a flat shape is, by its use (deck, driveway, otherwise patio). */
const flatKind = (use) => (/deck|porch/.test(use) ? 'deck_area' : /drive|parking|road/.test(use) ? 'driveway_area' : 'patio_area');

/**
 * Shared measurement kinds (vocab.js MEASURE_KINDS) worked out from the job's measured areas, in their imperial units.
 * Roof: roof_area, roof_pitch, eaves, rakes, ridges (ridges and hips), valleys. Exterior walls: siding_area, windows,
 * entry_doors. Flat: deck/patio/driveway area. Linear: fence_length or gutters. A room: floor_area, wall_area, and for a
 * bath design the room's length, width and ceiling height (bath.roomL/roomW in ft, bath.ceilingIn in in).
 * Totals add up across areas of the same kind; pitch is the steepest roof's.
 */
export function deriveMeasurements(project, { bath = !!(project && project.cvs && /bath|shower|tub/.test(project.cvs.pack || project.cvs.module || '')) } = {}) {
  const sums = new Map(); const set = (kind, value, source, note) => {
    if (!(value > 0) || !MEASURE_KINDS[kind]) return; const cur = sums.get(kind);
    if (!cur) sums.set(kind, { kind, value, unit: MEASURE_KINDS[kind], source, note: note ? [note] : [] });
    else if (kind === 'roof_pitch' || kind.startsWith('bath.')) { if (value > cur.value) cur.value = value; }
    else { cur.value += value; if (note) cur.note.push(note); if (rankOf(source) < rankOf(cur.source)) cur.source = source; }
  };
  for (const a of (project && project.rooms) || []) {
    const src = areaSource(a); if (!src) continue; const m = areaMetrics(a); const k = kindOf(a); const nm = a.name || '';
    if (k === 'roof') {
      set('roof_area', toSF(m.roofArea), src, nm); set('roof_pitch', m.pitch, src); set('eaves', toFT(m.eave), src, nm); set('rakes', toFT(m.rake), src, nm);
      set('ridges', toFT(m.ridge + m.hip), src, nm); set('valleys', toFT(m.valley), src, nm);
    } else if (k === 'exterior') {
      set('siding_area', toSF(m.wallAreaNet), src, nm);
      const win = (a.openings || []).filter((o) => o.type === 'window').length; const door = (a.openings || []).filter((o) => o.type === 'door').length;
      set('windows', win, src, nm); set('entry_doors', door, src, nm);
    } else if (k === 'flat') set(flatKind(m.use), toSF(m.area), src, nm);
    else if (k === 'linear') set(/gutter/.test(m.use) ? 'gutters' : 'fence_length', toFT(m.length), src, nm);
    else {
      set('floor_area', toSF(m.floorArea), src, nm); set('wall_area', toSF(m.wallAreaNet), src, nm);
      if (bath) { const b = m.bounds || boundsOf(a.corners || []); set('bath.roomL', toFT(Math.max(b.w, b.d)), src); set('bath.roomW', toFT(Math.min(b.w, b.d)), src); set('bath.ceilingIn', toFT(m.H) * 12, src); }
    }
  }
  return [...sums.values()].map((x) => ({ kind: x.kind, value: x.unit === 'ea' || x.kind === 'bath.ceilingIn' ? r0(x.value) : r1(x.value), unit: x.unit, source: x.source, note: x.note.filter(Boolean).join(', ') }));
}
function boundsOf(c) { if (!c.length) return { w: 0, d: 0 }; const xs = c.map((p) => p.x), zs = c.map((p) => p.z); return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) }; }

/** Put derived numbers on the job (ranked merge: never silently over a better number). Returns how many changed. */
export function fillFromAreas(project) {
  project.measurements = project.measurements || []; let n = 0;
  for (const m of deriveMeasurements(project)) { const r = mergeMeasurement(project.measurements, { ...m, takenAt: new Date().toISOString(), from: 'fullbid' }); if (r.action === 'added' || r.action === 'replaced') n++; }
  return n;
}

/**
 * What goes back: every job measurement that came from Fullbid (not echoed from the package), or that outranks the
 * package's own number for the same kind.
 */
export function outgoingMeasurements(project) {
  const pkgM = new Map((((project.cvs && project.cvs.pkg) || {}).measurements || []).map((m) => [m.kind, m]));
  return (project.measurements || []).filter((m) => {
    if (m.from === 'cvs') return false; const theirs = pkgM.get(m.kind);
    return !theirs || rankOf(m.source) > rankOf(theirs.source) || Number(theirs.value) !== Number(m.value);
  }).map((m) => ({ kind: m.kind, value: Number(m.value), unit: m.unit || MEASURE_KINDS[m.kind] || '', source: m.source || 'measured', takenAt: m.takenAt || null, note: m.note || '' }));
}

export function measurementPacket(project) {
  return { schema: PACKET_SCHEMA, version: 1, designId: project.cvs ? project.cvs.designId : null, from: { app: 'fullbid', job: project.name || '' }, measurements: outgoingMeasurements(project) };
}

/** The bath tool's `m=` parameter (CVS encodeMeasure): plain base64url JSON of the room's numbers and their sources. */
export function bathMeasureParam(measurements) {
  const keys = { 'bath.roomL': 'roomL', 'bath.roomW': 'roomW', 'bath.ceilingIn': 'ceilingIn', 'bath.showerW': 'showerW', 'bath.showerD': 'showerD', 'bath.wallH': 'wallH', 'bath.vanityWallIn': 'vanityWallIn' };
  const out = {}; const source = {};
  for (const m of measurements) { const k = keys[m.kind]; if (!k) continue; out[k] = Number(m.value); source[k] = m.source === 'measured' || m.source === 'report' ? 'measured' : m.source === 'photo' ? 'photo' : m.source === 'typical' ? 'typical' : 'typed'; }
  if (!Object.keys(out).length) return '';
  out.source = source; const bytes = new TextEncoder().encode(JSON.stringify(out)); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The link back to the design: the bath tool reads `?m=`; every design also gets `#cvs-measure=d:<packet>` so the
 * Studio can take each number with its source. Null when the job has no design link or nothing to send.
 */
export async function designLinkWithMeasurements(project) {
  const url = project.cvs && project.cvs.design && project.cvs.design.url; const packet = measurementPacket(project);
  if (!url || !packet.measurements.length) return null;
  let u; try { u = new URL(url); } catch { return null; }
  const m = bathMeasureParam(packet.measurements); if (m) u.searchParams.set('m', m);
  u.hash = `cvs-measure=${await encodeCvsPackage(packet)}`;
  return { href: u.toString(), packet };
}

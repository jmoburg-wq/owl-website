// room geometry (all internal units are meters; x = east/right, z = south/down in plan view)
export const FT = 0.3048, IN = 0.0254, SQFT = 0.09290304;

export const signedArea = (c) => { let s = 0; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; s += a.x * b.z - b.x * a.z; } return s / 2; };
export const area = (c) => Math.abs(signedArea(c));
export const isCCW = (c) => signedArea(c) > 0;
export const ensureCCW = (c) => (isCCW(c) ? c.slice() : c.slice().reverse());
export const perimeter = (c) => { let p = 0; for (let i = 0; i < c.length; i++) p += dist(c[i], c[(i + 1) % c.length]); return p; };
export const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
export const centroid = (c) => { let x = 0, z = 0; for (const p of c) { x += p.x; z += p.z; } return { x: x / c.length, z: z / c.length }; };
export const bounds = (c) => { const xs = c.map((p) => p.x), zs = c.map((p) => p.z); const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }; b.w = b.maxX - b.minX; b.d = b.maxZ - b.minZ; return b; };

export function dedupe(corners, tol = 0.05) {
  const out = [];
  for (const p of corners) if (!out.length || dist(out[out.length - 1], p) > tol) out.push({ x: p.x, z: p.z });
  if (out.length > 2 && dist(out[0], out[out.length - 1]) <= tol) out.pop();
  return out;
}

export function translate(corners, dx, dz) { return corners.map((p) => ({ x: p.x + dx, z: p.z + dz })); }
export function normalizeOrigin(corners) { const b = bounds(corners); return translate(corners, -b.minX, -b.minZ); }

/** Snap a noisy polygon to orthogonal walls (relative to its longest wall). */
export function squareUp(corners, iterations = 6, maxDeviationDeg = 20) {
  if (corners.length < 3) return corners.slice();
  let best = 0, bestLen = -1;
  for (let i = 0; i < corners.length; i++) { const L = dist(corners[i], corners[(i + 1) % corners.length]); if (L > bestLen) { bestLen = L; best = i; } }
  const a = corners[best], b = corners[(best + 1) % corners.length];
  const theta = Math.atan2(b.z - a.z, b.x - a.x);
  const cos = Math.cos(-theta), sin = Math.sin(-theta);
  let pts = corners.map((p) => ({ x: p.x * cos - p.z * sin, z: p.x * sin + p.z * cos }));
  const n = pts.length;
  const axisOf = (p, q) => { const ang = Math.abs(Math.atan2(q.z - p.z, q.x - p.x)) * 180 / Math.PI; const d = Math.min(ang, 180 - ang); if (d <= maxDeviationDeg) return 'h'; if (Math.abs(90 - ang) <= maxDeviationDeg) return 'v'; return null; };
  const axes = pts.map((p, i) => axisOf(p, pts[(i + 1) % n]));
  if (axes.some((x) => x === null)) return corners.slice(); // not an orthogonal-ish room; leave it
  for (let it = 0; it < iterations; it++) {
    const next = pts.map((p) => ({ ...p }));
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      if (axes[i] === 'h') { const z = (p.z + q.z) / 2; next[i].z = (next[i].z + z) / 2; next[(i + 1) % n].z = (next[(i + 1) % n].z + z) / 2; }
      else { const x = (p.x + q.x) / 2; next[i].x = (next[i].x + x) / 2; next[(i + 1) % n].x = (next[(i + 1) % n].x + x) / 2; }
    }
    pts = next;
  }
  // hard snap
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; if (axes[i] === 'h') { const z = (p.z + q.z) / 2; p.z = z; q.z = z; } else { const x = (p.x + q.x) / 2; p.x = x; q.x = x; } }
  const c2 = Math.cos(theta), s2 = Math.sin(theta);
  return pts.map((p) => ({ x: p.x * c2 - p.z * s2, z: p.x * s2 + p.z * c2 }));
}

export function walls(room) {
  const c = room.corners, n = c.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = c[i], b = c[(i + 1) % n];
    const length = dist(a, b);
    const w = { index: i, a, b, length, angle: Math.atan2(b.z - a.z, b.x - a.x), openings: (room.openings || []).filter((o) => o.wall === i).sort((p, q) => p.offset - q.offset) };
    out.push(w);
  }
  return out;
}

export function clampOpening(room, op) {
  const w = walls(room)[op.wall]; if (!w) return op;
  op.width = Math.max(0.3, Math.min(op.width, w.length - 0.05));
  op.offset = Math.max(0, Math.min(op.offset, w.length - op.width));
  op.height = Math.max(0.3, Math.min(op.height, room.ceilingHeight - (op.sill || 0) - 0.02));
  return op;
}

export function metrics(room) {
  const c = room.corners || [];
  const H = room.ceilingHeight || 2.4384;
  const floorArea = area(c), per = perimeter(c);
  const ws = walls(room);
  const openings = room.openings || [];
  const doors = openings.filter((o) => o.type === 'door'), windows = openings.filter((o) => o.type === 'window');
  const openingArea = openings.reduce((s, o) => s + o.width * o.height, 0);
  const doorWidth = doors.reduce((s, o) => s + o.width, 0);
  const wallAreaGross = per * H;
  return {
    H, floorArea, ceilingArea: floorArea, perimeter: per, wallAreaGross, openingArea, wallAreaNet: Math.max(0, wallAreaGross - openingArea),
    doorCount: doors.length, windowCount: windows.length, doorWidth,
    baseboardLF: Math.max(0, per - doorWidth), crownLF: per,
    doorCasingLF: doors.reduce((s, o) => s + 2 * o.height + o.width, 0),
    windowTrimLF: windows.reduce((s, o) => s + 2 * (o.width + o.height), 0),
    windowArea: windows.reduce((s, o) => s + o.width * o.height, 0),
    volume: floorArea * H, wallCount: ws.length, longestWall: Math.max(0, ...ws.map((w) => w.length)), bounds: c.length ? bounds(c) : { w: 0, d: 0 }, walls: ws,
  };
}

// ---- shapes (w = width along x, d = depth along z)
export const makeRect = (w, d) => [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }];
export const makeL = (w, d, cw, cd) => [{ x: 0, z: 0 }, { x: w - cw, z: 0 }, { x: w - cw, z: cd }, { x: w, z: cd }, { x: w, z: d }, { x: 0, z: d }];
export const makeU = (w, d, cw, cd) => { const l = (w - cw) / 2; return [{ x: 0, z: 0 }, { x: l, z: 0 }, { x: l, z: cd }, { x: l + cw, z: cd }, { x: l + cw, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }]; };
export const makeT = (w, d, stemW, topD) => { const l = (w - stemW) / 2; return [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: topD }, { x: l + stemW, z: topD }, { x: l + stemW, z: d }, { x: l, z: d }, { x: l, z: topD }, { x: 0, z: topD }]; };

// ---- units
export const toSF = (m2) => m2 / SQFT;
export const toFT = (m) => m / FT;
export const toUnits = (m, units) => (units === 'metric' ? m : m / FT);
export const fromUnits = (v, units) => (units === 'metric' ? v : v * FT);
export const unitLabel = (units) => (units === 'metric' ? 'm' : 'ft');
export const areaLabel = (units) => (units === 'metric' ? 'm²' : 'sf');

export function fmtLen(m, units = 'imperial', { precise = false } = {}) {
  if (!Number.isFinite(m)) return '—';
  if (units === 'metric') return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
  const totalIn = Math.round((m / IN) * (precise ? 8 : 2)) / (precise ? 8 : 2);
  let ft = Math.floor(totalIn / 12); let inch = totalIn - ft * 12;
  if (inch >= 12) { ft += 1; inch -= 12; }
  const inStr = Number.isInteger(inch) ? `${inch}` : inch.toFixed(precise ? 3 : 1).replace(/\.?0+$/, '');
  return ft ? `${ft}′ ${inStr}″` : `${inStr}″`;
}
export function fmtArea(m2, units = 'imperial', digits = 0) {
  if (!Number.isFinite(m2)) return '—';
  return units === 'metric' ? `${m2.toFixed(digits || 1)} m²` : `${toSF(m2).toLocaleString(undefined, { maximumFractionDigits: digits })} sf`;
}
export function fmtLF(m, units = 'imperial') { return units === 'metric' ? `${m.toFixed(1)} m` : `${toFT(m).toFixed(1)} lf`; }

/** Parse "12' 6\"", "12ft 6in", "12.5", "150\"", "3.8m", "380cm" → meters. */
export function parseLen(str, units = 'imperial') {
  if (typeof str === 'number') return fromUnits(str, units);
  let s = String(str || '').trim().toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'");
  if (!s) return NaN;
  let m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(m|meters?)$/))) return parseFloat(m[1]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(cm|centimeters?)$/))) return parseFloat(m[1]) / 100;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(mm)$/))) return parseFloat(m[1]) / 1000;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*[- ]?\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch|inches)?$/))) return parseFloat(m[1]) * FT + (m[2] ? parseFloat(m[2]) * IN : 0);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/))) return parseFloat(m[1]) * IN;
  if ((m = s.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)$/))) return parseInt(m[1], 10) * FT + parseFloat(m[2]) * IN;
  if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) return fromUnits(parseFloat(m[1]), units);
  return NaN;
}

/** Build a canonical room object. */
export function makeRoom({ name = 'Room', corners, ceilingHeight = 2.4384, wallThickness = 0.1143, openings = [], source = 'manual', photos = [], notes = '' }) {
  return { id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4), name, source, corners: normalizeOrigin(ensureCCW(dedupe(corners))), ceilingHeight, wallThickness, openings: openings.map((o, i) => ({ id: o.id || `o${i}${Date.now().toString(36)}`, type: o.type || 'door', wall: o.wall || 0, offset: o.offset || 0, width: o.width || 0.9144, height: o.height || 2.032, sill: o.sill || 0 })), photos, notes, cloudCount: 0, createdAt: new Date().toISOString() };
}

/** Standard openings in meters */
export const STD = { doorW: 0.9144, doorH: 2.032, windowW: 0.9144, windowH: 1.2192, windowSill: 0.9144, doubleDoorW: 1.8288, sliderW: 1.8288 };

// ---- spatial helpers
export function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > pt.z) !== (b.z > pt.z) && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
/** Unit normal of wall i pointing away from the room interior. */
export function outwardNormal(corners, i) {
  const a = corners[i], b = corners[(i + 1) % corners.length];
  const L = dist(a, b) || 1; let nx = (b.z - a.z) / L, nz = -(b.x - a.x) / L;
  const mid = { x: (a.x + b.x) / 2 + nx * 0.02, z: (a.z + b.z) / 2 + nz * 0.02 };
  if (pointInPolygon(mid, corners)) { nx = -nx; nz = -nz; }
  return { x: nx, z: nz };
}

// ======================================================================================================
// Measurement kinds. A project "area" is one of:
//   room      — interior room (floor polygon, ceiling height, openings)            → metrics()
//   exterior  — building footprint for siding/paint (polygon, wall height, openings) → metrics()
//   roof      — building footprint + pitch, overhang, style, stories, tear-off layers → roofMetrics()
//   flat      — horizontal area: deck, patio, driveway, slab (polygon + thickness/height) → flatMetrics()
//   linear    — fence, gutter or edging run (length, turns, gates, height)        → linearMetrics()
// ======================================================================================================
export const KINDS = {
  room: { label: 'Interior room', short: 'Room', icon: 'cube' },
  roof: { label: 'Roof', short: 'Roof', icon: 'home' },
  exterior: { label: 'Exterior walls', short: 'Exterior', icon: 'grid' },
  flat: { label: 'Flat area', short: 'Flat area', icon: 'layers', hint: 'Deck, patio, driveway, slab' },
  linear: { label: 'Linear run', short: 'Linear', icon: 'ruler', hint: 'Fence, gutters, edging' },
};
export const kindOf = (a) => (a && a.kind) || 'room';
export const pitchFactor = (pitch) => Math.sqrt(1 + ((Number(pitch) || 0) / 12) ** 2);

/** Count reflex (inward) corners of a CCW polygon — each one usually means a roof valley. */
export function reflexCorners(corners) {
  const c = ensureCCW(corners); let n = 0;
  for (let i = 0; i < c.length; i++) { const a = c[(i - 1 + c.length) % c.length], b = c[i], d = c[(i + 1) % c.length]; const cross = (b.x - a.x) * (d.z - b.z) - (b.z - a.z) * (d.x - b.x); if (cross < -1e-9) n++; }
  return n;
}

/** Roof takeoff from a footprint. Lengths in meters, areas in m². Bounding-rectangle approximations for
 *  ridge/hip/rake on irregular plans; any value can be overridden by a measured number. */
export function roofMetrics(r) {
  const c = r.corners || []; const R = r.roof || {};
  const pitch = Number(R.pitch ?? 6), o = Number(R.overhang ?? 0.3048), style = R.style || 'gable';
  const stories = Math.max(1, Number(R.stories || 1)), layers = Math.max(0, Number(R.layers ?? 1));
  const A = area(c), P = perimeter(c), b = c.length ? bounds(c) : { w: 0, d: 0 };
  const pf = pitchFactor(pitch);
  const planArea = A + P * o + 4 * o * o;
  const L = Math.max(b.w, b.d) + 2 * o, W = Math.min(b.w, b.d) + 2 * o;
  const halfW = W / 2, rise = halfW * pitch / 12;
  const hipEach = Math.sqrt(2 * halfW * halfW + rise * rise);
  let ridge, eave, rake, hip;
  if (style === 'hip') { ridge = Math.max(L - W, 0); eave = 2 * (L + W); rake = 0; hip = 4 * hipEach; }
  else { ridge = L; eave = 2 * L; rake = 2 * W * pf; hip = 0; }
  const valley = reflexCorners(c) * hipEach;
  const ov = R.overrides || {}; const pick = (k, v) => (Number(ov[k]) > 0 ? Number(ov[k]) : v);
  const roofArea = Number(ov.roofArea) > 0 ? Number(ov.roofArea) : planArea * pf;
  return { kind: 'roof', pitch, pitchFactor: pf, style, stories, layers, overhang: o, footprintArea: A, planArea, roofArea, squares: roofArea / SQFT / 100, perimeter: P,
    ridge: pick('ridge', ridge), eave: pick('eave', eave), rake: pick('rake', rake), hip: pick('hip', hip), valley: pick('valley', valley), wallHeight: 2.7 * stories, bounds: b };
}
export function flatMetrics(r) {
  const c = r.corners || []; const F = r.flat || {};
  const A = area(c), P = perimeter(c), b = c.length ? bounds(c) : { w: 0, d: 0 };
  return { kind: 'flat', use: F.use || 'patio', area: A, perimeter: P, thicknessIn: Number(F.thicknessIn ?? 4), heightFt: Number(F.heightFt ?? 2), attachedLf: Number(F.attachedLf ?? 0), bounds: b };
}
export function linearMetrics(r) {
  const L = r.linear || {};
  return { kind: 'linear', use: L.use || 'fence', length: Number(L.length || 0), turns: Math.max(0, Number(L.turns || 0)), gates: Math.max(0, Number(L.gates || 0)), heightFt: Number(L.heightFt ?? 6) };
}
export function areaMetrics(a) {
  const k = kindOf(a);
  if (k === 'roof') return roofMetrics(a);
  if (k === 'flat') return flatMetrics(a);
  if (k === 'linear') return linearMetrics(a);
  return { kind: k, ...metrics(a) };
}
/** One-line human summary for lists. */
export function areaSummary(a, units = 'imperial') {
  const m = areaMetrics(a);
  if (m.kind === 'roof') return `${m.squares.toFixed(1)} squares · ${m.pitch}/12 ${m.style} · ${m.stories} stor${m.stories === 1 ? 'y' : 'ies'}`;
  if (m.kind === 'flat') return `${fmtArea(m.area, units)} · ${m.use}`;
  if (m.kind === 'linear') return `${fmtLF(m.length, units)} ${m.use}${m.gates ? ` · ${m.gates} gate${m.gates === 1 ? '' : 's'}` : ''}`;
  if (m.kind === 'exterior') return `${fmtArea(m.wallAreaNet, units)} net wall · ${fmtLen(m.H, units)} high · ${m.doorCount + m.windowCount} openings`;
  return `${fmtArea(m.floorArea, units)} · ${fmtLen(m.H, units)} ceiling · ${m.doorCount} door${m.doorCount === 1 ? '' : 's'}, ${m.windowCount} window${m.windowCount === 1 ? '' : 's'}`;
}
/** Build any kind of area. Extra kind data rides along untouched. */
export function makeArea({ kind = 'room', ...rest }) {
  if (kind === 'linear') return { id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4), kind, name: rest.name || 'Fence run', source: rest.source || 'manual', corners: [], ceilingHeight: 0, wallThickness: 0, openings: [], linear: { use: 'fence', length: 0, turns: 0, gates: 0, heightFt: 6, ...(rest.linear || {}) }, photos: [], notes: rest.notes || '', cloudCount: 0, createdAt: new Date().toISOString() };
  const room = makeRoom({ ...rest, ceilingHeight: rest.ceilingHeight ?? (kind === 'exterior' ? 2.7432 : 2.4384) });
  room.kind = kind;
  if (kind === 'roof') room.roof = { pitch: 6, overhang: 0.3048, style: 'gable', stories: 1, layers: 1, overrides: {}, ...(rest.roof || {}) };
  if (kind === 'flat') room.flat = { use: 'patio', thicknessIn: 4, heightFt: 2, attachedLf: 0, ...(rest.flat || {}) };
  return room;
}

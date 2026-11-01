// Scan tab controller: mode selection, room review sheet, demo room, room list
import { store } from '../store.js';
import { makeRoom, makeL, makeRect, makeArea, metrics, fmtLen, fmtArea, fmtLF, parseLen, squareUp, walls, clampOpening, STD, normalizeOrigin, ensureCCW, kindOf, KINDS, areaSummary, roofMetrics, flatMetrics, FT } from '../geometry.js';
import { el, h, $, $$, toast, sheet, icons, confirmDialog, segEl, switchEl, esc, readFileAsDataURL, bind } from '../ui.js';
import { quickShapeSheet, drawEditor, asKind } from './manual.js';
import { startCameraScan, requestMotionPermission } from './gyro.js';
import { isARSupported, startARScan } from './webxr-ar.js';
import { startQuickMeasure, measurePitch } from '../measure.js';
import { idb } from '../store.js';

let arSupported = null;

export function demoRoom() {
  const FT = 0.3048;
  const room = makeRoom({ name: 'Primary bedroom (demo)', corners: makeL(16 * FT, 13 * FT, 5 * FT, 4 * FT), ceilingHeight: 9 * FT, source: 'demo', openings: [
    { type: 'door', wall: 0, offset: 2 * FT, width: STD.doorW, height: STD.doorH, sill: 0 },
    { type: 'door', wall: 5, offset: 8 * FT, width: 1.524, height: STD.doorH, sill: 0 },
    { type: 'window', wall: 4, offset: 4 * FT, width: 1.524, height: 1.372, sill: 0.76 },
    { type: 'window', wall: 3, offset: 1.5 * FT, width: STD.windowW, height: STD.windowH, sill: STD.windowSill },
  ] });
  return room;
}

/** Shared review/edit sheet for any captured room. Resolves with the (possibly edited) room or null. */
export function reviewRoom(room, { units = 'imperial', title = 'Review room' } = {}) {
  const ext = kindOf(room) === 'exterior'; const HL = ext ? 'Wall height' : 'Ceiling height';
  return new Promise((resolve) => {
    let r = structuredClone(room); let squared = false;
    const body = h('div');
    const render = () => {
      const m = metrics(r); body.innerHTML = '';
      body.append(el(`<div class="field"><label>${ext ? 'Name' : 'Room name'}</label><input type="text" data-f="name" value="${esc(r.name)}" /></div>`));
      body.append(el(`<div class="inline-fields"><div class="field"><label>${HL}</label><div class="unit-input"><input type="text" data-f="ceil" value="${esc(units === 'metric' ? r.ceilingHeight.toFixed(2) : fmtLen(r.ceilingHeight, 'imperial'))}" /><span>${units === 'metric' ? 'm' : 'ft-in'}</span></div></div><div class="field"><label>Wall thickness</label><div class="unit-input"><input type="text" data-f="thick" value="${esc(units === 'metric' ? Math.round(r.wallThickness * 100) + ' cm' : fmtLen(r.wallThickness, 'imperial'))}" /><span>${units === 'metric' ? 'cm' : 'in'}</span></div></div></div>`));
      const stats = el(`<div class="stat-grid mt12"><div class="stat"><div class="v">${fmtArea(m.floorArea, units)}</div><div class="k">${ext ? 'footprint' : 'floor'}</div></div><div class="stat"><div class="v">${fmtLF(m.perimeter, units)}</div><div class="k">perimeter</div></div><div class="stat"><div class="v">${fmtArea(m.wallAreaNet, units)}</div><div class="k">wall (net)</div></div></div>`);
      body.append(stats);
      if (r.source === 'camera' || r.source === 'webxr') { const row = h('div', { class: 'row between mt12' }, el(`<div><b>Square up walls</b><div class="dim small">Snap to 90° corners (recommended for sensor scans)</div></div>`)); row.append(switchEl(squared, (v) => { if (v) { const sq = squareUp(room.corners); if (sq === room.corners || sq.length !== room.corners.length) { toast('Room is not close to rectangular — left as scanned'); } r.corners = normalizeOrigin(ensureCCW(sq)); squared = true; } else { r.corners = structuredClone(room.corners); squared = false; } render(); })); body.append(row); }
      const wl = h('div', { class: 'card flat tight mt12' }, el(`<div class="card-title"><h3>Walls</h3><button class="btn xs secondary" data-act="edit-outline">${icons.pencil} Edit outline</button></div>`));
      const list = h('div', { class: 'list' }); walls(r).forEach((w, i) => list.append(el(`<div class="item" style="padding:7px 0"><div class="lead" style="width:30px;height:30px;border-radius:8px;font-size:12px;font-weight:700">W${i + 1}</div><div class="grow">${fmtLen(w.length, units)}</div><div class="dim small">${w.openings.length ? w.openings.map((o) => (o.type === 'door' ? 'D' : 'W')).join(' ') : ''}</div></div>`))); wl.append(list); body.append(wl);
      const ol = h('div', { class: 'card flat tight mt12' }, el(`<div class="card-title"><h3>Doors & windows</h3><div class="row" style="gap:6px"><button class="btn xs secondary" data-act="add-door">+ Door</button><button class="btn xs secondary" data-act="add-window">+ Window</button></div></div>`));
      if (!r.openings.length) ol.append(el(`<p class="dim small">None yet. Openings are subtracted from wall area and baseboard, and drive door/window line items.</p>`));
      const olist = h('div', { class: 'list' });
      r.openings.forEach((o, i) => olist.append(el(`<div class="item" style="padding:8px 0" data-idx="${i}"><div class="lead" style="width:32px;height:32px;border-radius:8px">${o.type === 'door' ? icons.door : icons.window}</div><div class="grow"><div><b>${o.type === 'door' ? 'Door' : 'Window'}</b> on W${o.wall + 1}</div><div class="dim small">${fmtLen(o.width, units)} × ${fmtLen(o.height, units)}${o.sill ? ` · sill ${fmtLen(o.sill, units)}` : ''} · ${fmtLen(o.offset, units)} from corner</div></div><button class="btn xs neutral" data-act="edit-open" data-idx="${i}">Edit</button><button class="btn xs danger" data-act="del-open" data-idx="${i}">${icons.trash}</button></div>`)));
      ol.append(olist); body.append(ol);
      body.append(el(`<div class="field"><label>Notes</label><textarea data-f="notes" placeholder="Existing conditions, access, client preferences…">${esc(r.notes || '')}</textarea></div>`));
    };
    const openingSheet = (o, isNew) => new Promise((done) => {
      const ws = walls(r); const b = h('div');
      b.append(el(`<div class="field"><label>Type</label></div>`)); let type = o.type; b.lastChild.append(segEl([{ value: 'door', label: 'Door' }, { value: 'window', label: 'Window' }], type, (v) => { type = v; if (v === 'window' && !o.sill) { $('[data-f="sill"]', b).value = units === 'metric' ? STD.windowSill.toFixed(2) : fmtLen(STD.windowSill, 'imperial'); $('[data-f="h"]', b).value = units === 'metric' ? STD.windowH.toFixed(2) : fmtLen(STD.windowH, 'imperial'); } if (v === 'door') { $('[data-f="sill"]', b).value = '0'; $('[data-f="h"]', b).value = units === 'metric' ? STD.doorH.toFixed(2) : fmtLen(STD.doorH, 'imperial'); } }));
      b.append(el(`<div class="field"><label>Wall</label><select data-f="wall">${ws.map((w, i) => `<option value="${i}" ${i === o.wall ? 'selected' : ''}>W${i + 1} — ${fmtLen(w.length, units)}</option>`).join('')}</select></div>`));
      const L = (v) => esc(units === 'metric' ? v.toFixed(2) : fmtLen(v, 'imperial'));
      b.append(el(`<div class="inline-fields"><div class="field"><label>Width</label><input type="text" data-f="w" value="${L(o.width)}"></div><div class="field"><label>Height</label><input type="text" data-f="h" value="${L(o.height)}"></div></div><div class="inline-fields"><div class="field"><label>Offset from wall start</label><input type="text" data-f="off" value="${L(o.offset)}"></div><div class="field"><label>Sill height</label><input type="text" data-f="sill" value="${o.sill ? L(o.sill) : '0'}"></div></div><div class="chips mt8"><button class="chip" data-q="36">36" door</button><button class="chip" data-q="32">32" door</button><button class="chip" data-q="60">60" double</button><button class="chip" data-q="72">72" slider</button><button class="chip" data-q="center">Center on wall</button></div>`));
      b.addEventListener('click', (e) => { const q = e.target.closest('[data-q]')?.dataset.q; if (!q) return; if (q === 'center') { const w = ws[+$('[data-f="wall"]', b).value]; const wd = parseLen($('[data-f="w"]', b).value, units) || 0.9; $('[data-f="off"]', b).value = L(Math.max(0, (w.length - wd) / 2)); } else { $('[data-f="w"]', b).value = L(+q * 0.0254); if (type !== 'door') { type = 'door'; } } });
      const sh = sheet({ title: isNew ? 'Add opening' : 'Edit opening', body: b, onClose: (res) => done(res === undefined ? null : res), actions: [{ label: 'Save', keepOpen: true, onClick: () => { const g = (f) => parseLen($(`[data-f="${f}"]`, b).value, units); const out = { ...o, type, wall: +$('[data-f="wall"]', b).value, width: g('w'), height: g('h'), offset: g('off') || 0, sill: type === 'door' ? 0 : g('sill') || 0 }; if (!(out.width > 0.2) || !(out.height > 0.2)) return toast('Check width and height'); clampOpening(r, out); sh.close(out); } }, { label: 'Cancel', cls: 'neutral', onClick: () => null }] });
    });
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return; const act = btn.dataset.act;
      if (act === 'add-door' || act === 'add-window') { const isDoor = act === 'add-door'; const w0 = walls(r).reduce((a, w) => (w.length > a.length ? w : a)); const o = { id: Math.random().toString(36).slice(2, 8), type: isDoor ? 'door' : 'window', wall: w0.index, offset: Math.max(0, (w0.length - (isDoor ? STD.doorW : STD.windowW)) / 2), width: isDoor ? STD.doorW : STD.windowW, height: isDoor ? STD.doorH : STD.windowH, sill: isDoor ? 0 : STD.windowSill }; const res = await openingSheet(o, true); if (res) { r.openings.push(res); render(); } }
      if (act === 'edit-open') { const i = +btn.dataset.idx; const res = await openingSheet(r.openings[i], false); if (res) { r.openings[i] = res; render(); } }
      if (act === 'del-open') { r.openings.splice(+btn.dataset.idx, 1); render(); }
      if (act === 'edit-outline') { commitFields(); const edited = await drawEditor({ units, room: r }); if (edited) { r = { ...edited, corners: normalizeOrigin(ensureCCW(edited.corners)) }; r.openings = r.openings.filter((o) => o.wall < r.corners.length).map((o) => clampOpening(r, o)); render(); } }
    });
    const commitFields = () => { r.name = $('[data-f="name"]', body).value.trim() || 'Room'; const c = parseLen($('[data-f="ceil"]', body).value, units); if (c > 1.5 && c < 8) { if (Math.abs(c - r.ceilingHeight) > 0.001) r.ceilingAssumed = false; r.ceilingHeight = c; } const tv = $('[data-f="thick"]', body).value; const t = units === 'metric' ? (parseFloat(tv) > 2 ? parseFloat(tv) / 100 : parseLen(tv, units)) : (/["']|ft|in/.test(tv) ? parseLen(tv, units) : parseFloat(tv) * 0.0254); if (t > 0.02 && t < 0.6) r.wallThickness = t; r.notes = $('[data-f="notes"]', body).value; r.openings = r.openings.map((o) => clampOpening(r, o)); };
    render();
    sheet({ title, subtitle: `${r.source === 'camera' ? 'Captured with camera + motion sensors' : r.source === 'webxr' ? 'Captured with AR' : r.source === 'demo' ? 'Demo room' : 'Entered manually'} · ${r.corners.length} corners`, body, onClose: (res) => resolve(res === undefined ? null : res), actions: [
      { label: 'Save room', keepOpen: true, onClick: (_, close) => { commitFields(); close(r); } },
      { label: 'Discard', cls: 'neutral', onClick: () => null },
    ] });
  });
}

// ---------------------------------------------------------------- demo areas for every kind
export function demoArea(kind) {
  if (kind === 'roof') return makeArea({ kind: 'roof', name: 'Main roof (demo)', corners: makeRect(40 * FT, 30 * FT), source: 'demo', roof: { pitch: 6, overhang: FT, style: 'gable', stories: 1, layers: 1 } });
  if (kind === 'exterior') return makeArea({ kind: 'exterior', name: 'House exterior (demo)', corners: makeL(44 * FT, 32 * FT, 12 * FT, 10 * FT), ceilingHeight: 9 * FT, source: 'demo', openings: [{ type: 'door', wall: 0, offset: 6 * FT, width: STD.doorW, height: STD.doorH }, { type: 'window', wall: 0, offset: 14 * FT, width: STD.windowW, height: STD.windowH, sill: STD.windowSill }, { type: 'window', wall: 5, offset: 8 * FT, width: STD.windowW, height: STD.windowH, sill: STD.windowSill }, { type: 'window', wall: 5, offset: 24 * FT, width: STD.windowW, height: STD.windowH, sill: STD.windowSill }, { type: 'window', wall: 4, offset: 10 * FT, width: STD.windowW, height: STD.windowH, sill: STD.windowSill }, { type: 'door', wall: 3, offset: 4 * FT, width: STD.sliderW, height: STD.doorH }] });
  if (kind === 'flat') return makeArea({ kind: 'flat', name: 'Back deck (demo)', corners: makeRect(16 * FT, 12 * FT), source: 'demo', flat: { use: 'deck', heightFt: 3, thicknessIn: 4, attachedLf: 16 } });
  if (kind === 'linear') return makeArea({ kind: 'linear', name: 'Backyard fence (demo)', source: 'demo', linear: { use: 'fence', length: 150 * FT, turns: 3, gates: 2, heightFt: 6 } });
  return demoRoom();
}

const L = (v, units) => (units === 'metric' ? (Number(v) || 0).toFixed(2) : fmtLen(Number(v) || 0, 'imperial'));
/** Detail sheet for roofs, flat areas and linear runs (rooms and exterior walls use reviewRoom). */
export function reviewArea(area, { units = 'imperial', title } = {}) {
  const k = kindOf(area); if (k === 'room' || k === 'exterior') return reviewRoom(area, { units, title: title || (k === 'exterior' ? 'Review exterior walls' : 'Review room') });
  return new Promise((resolve) => {
    const a = structuredClone(area); const body = h('div'); const live = el(`<div class="calc-out"></div>`);
    body.append(el(`<div class="field"><label>Name</label><input type="text" data-f="name" value="${esc(a.name)}"></div>`));
    if (k === 'roof') { const R = a.roof;
      body.append(el(`<div class="inline-fields"><div class="field"><label>Pitch (rise per 12)</label><select data-r="pitch">${[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((p) => `<option ${Number(R.pitch) === p ? 'selected' : ''} value="${p}">${p}/12</option>`).join('')}${[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].includes(Number(R.pitch)) ? '' : `<option selected value="${R.pitch}">${R.pitch}/12</option>`}</select></div><div class="field"><label>Style</label><select data-r="style"><option value="gable" ${R.style === 'gable' ? 'selected' : ''}>Gable</option><option value="hip" ${R.style === 'hip' ? 'selected' : ''}>Hip</option></select></div></div>`));
      body.append(el(`<button class="btn sm secondary" data-a="gauge">${icons.ruler} Measure pitch with the phone</button>`));
      body.append(el(`<div class="inline-fields three"><div class="field"><label>Overhang</label><input type="text" data-r="overhang" value="${esc(L(R.overhang, units))}"></div><div class="field"><label>Stories</label><select data-r="stories">${[1, 2, 3].map((n) => `<option ${Number(R.stories) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="field"><label>Layers to tear off</label><select data-r="layers">${[0, 1, 2, 3].map((n) => `<option ${Number(R.layers) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>`));
      body.append(el(`<details class="mt8"><summary class="small muted">Measured lengths (optional overrides)</summary><div class="inline-fields three">${['ridge', 'hip', 'valley', 'eave', 'rake'].map((x) => `<div class="field"><label>${x[0].toUpperCase() + x.slice(1)}</label><input type="text" data-o="${x}" value="${R.overrides && R.overrides[x] ? esc(L(R.overrides[x], units)) : ''}" placeholder="auto"></div>`).join('')}</div></details>`)); }
    if (k === 'flat') { const F = a.flat;
      body.append(el(`<div class="field"><label>Use</label><select data-fl="use">${['deck', 'patio', 'driveway', 'slab', 'walkway', 'parking lot'].map((u) => `<option ${F.use === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>`));
      body.append(el(`<div class="inline-fields three"><div class="field"><label>Thickness (in)</label><input type="number" data-fl="thicknessIn" value="${F.thicknessIn}"></div><div class="field"><label>Deck height (ft)</label><input type="number" step="0.5" data-fl="heightFt" value="${F.heightFt}"></div><div class="field"><label>Against house (ft)</label><input type="number" data-fl="attachedLf" value="${F.attachedLf || 0}"></div></div>`)); }
    if (k === 'linear') { const Li = a.linear;
      body.append(el(`<div class="field"><label>Use</label><select data-li="use">${['fence', 'gutter', 'edging', 'railing', 'retaining wall'].map((u) => `<option ${Li.use === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>`));
      body.append(el(`<div class="field"><label>Total length</label><input type="text" data-li="length" value="${esc(L(Li.length, units))}" placeholder="e.g. 150' or 45.7 m"></div>`));
      body.append(el(`<div class="inline-fields three"><div class="field"><label>Corners / turns</label><input type="number" data-li="turns" value="${Li.turns}"></div><div class="field"><label>Gates</label><input type="number" data-li="gates" value="${Li.gates}"></div><div class="field"><label>Height (ft)</label><input type="number" step="0.5" data-li="heightFt" value="${Li.heightFt}"></div></div>`)); }
    body.append(live, el(`<div class="field"><label>Notes</label><textarea data-f="notes" placeholder="Access, existing conditions, HOA rules…">${esc(a.notes || '')}</textarea></div>`));
    const read = () => { a.name = $('[data-f="name"]', body).value.trim() || a.name; a.notes = $('[data-f="notes"]', body).value;
      if (k === 'roof') { const R = a.roof; R.pitch = Number($('[data-r="pitch"]', body).value); R.style = $('[data-r="style"]', body).value; const o = parseLen($('[data-r="overhang"]', body).value, units); if (o >= 0) R.overhang = o; R.stories = Number($('[data-r="stories"]', body).value); R.layers = Number($('[data-r="layers"]', body).value); R.overrides = {}; for (const inp of $$('[data-o]', body)) { const v = parseLen(inp.value, units); if (v > 0) R.overrides[inp.dataset.o] = v; } }
      if (k === 'flat') { const F = a.flat; F.use = $('[data-fl="use"]', body).value; F.thicknessIn = Number($('[data-fl="thicknessIn"]', body).value) || 4; F.heightFt = Number($('[data-fl="heightFt"]', body).value) || 0; F.attachedLf = Number($('[data-fl="attachedLf"]', body).value) || 0; }
      if (k === 'linear') { const Li = a.linear; Li.use = $('[data-li="use"]', body).value; const len = parseLen($('[data-li="length"]', body).value, units); Li.length = len > 0 ? len : 0; Li.turns = Number($('[data-li="turns"]', body).value) || 0; Li.gates = Number($('[data-li="gates"]', body).value) || 0; Li.heightFt = Number($('[data-li="heightFt"]', body).value) || 0; } };
    const show = () => { try { read(); } catch {} live.innerHTML = k === 'roof' ? (() => { const m = roofMetrics(a); return `<b>${m.squares.toFixed(1)} squares</b> (${Math.round(m.roofArea / 0.09290304)} sf of roof) · pitch factor ${m.pitchFactor.toFixed(3)}<br>Eaves ${fmtLF(m.eave, units)} · rakes ${fmtLF(m.rake, units)} · ridge ${fmtLF(m.ridge, units)}${m.hip ? ` · hips ${fmtLF(m.hip, units)}` : ''}${m.valley ? ` · valleys ${fmtLF(m.valley, units)}` : ''}`; })() : k === 'flat' ? (() => { const m = flatMetrics(a); const cy = (m.area / 0.09290304) * (m.thicknessIn / 12) / 27; return `<b>${fmtArea(m.area, units)}</b> · perimeter ${fmtLF(m.perimeter, units)}${m.use !== 'deck' ? ` · ${cy.toFixed(1)} cy at ${m.thicknessIn}"` : ''}`; })() : `<b>${areaSummary(a, units)}</b> · about ${Math.ceil((a.linear.length / FT) / 8) + 1 + (a.linear.turns || 0)} posts at 8 ft`; };
    body.addEventListener('input', show); body.addEventListener('change', show);
    body.addEventListener('click', async (e) => { if (e.target.closest('[data-a="gauge"]')) { const p = await measurePitch(); if (p) { const sel = $('[data-r="pitch"]', body); if (![...sel.options].some((o) => Number(o.value) === p)) sel.append(el(`<option value="${p}">${p}/12</option>`)); sel.value = String(p); show(); toast(`Pitch set to ${p}/12`); } } });
    show();
    sheet({ title: title || `Review ${KINDS[k].label.toLowerCase()}`, subtitle: k === 'linear' ? '' : `${a.corners.length} corners · ${a.source === 'camera' ? 'camera scan' : a.source === 'demo' ? 'demo' : 'entered manually'}`, body, onClose: (res) => resolve(res === undefined ? null : res), actions: [
      { label: 'Save', keepOpen: true, onClick: (_, close) => { read(); if (k === 'linear' && !(a.linear.length > 0)) return toast('Enter the total length'); close(a); } },
      ...(k !== 'linear' ? [{ label: 'Edit outline', cls: 'neutral', keepOpen: true, onClick: async (_, close) => { read(); const ed = await drawEditor({ units, room: a }); if (ed) { a.corners = normalizeOrigin(ensureCCW(ed.corners)); close(a); } } }] : []),
      { label: 'Discard', cls: 'neutral', onClick: () => null }] });
  });
}

let measureKind = 'room';
const MODES = {
  room: [['ar', 'ar', 'AR scan (LiDAR-style)', 'Android Chrome with ARCore. Floor reticle places corners; optional depth point cloud.'], ['camera', 'camera', 'Camera scan', 'Any phone, including iPhone. Camera + motion sensors — no LiDAR needed.'], ['manual', 'pencil', 'Enter dimensions', 'Rectangle, L, U or T — or draw the outline with your finger.'], ['measure', 'ruler', 'Quick measure', 'Floor distances, point-to-point and heights.'], ['demo', 'play', 'Load demo room', 'Try the flow with a sample bedroom.']],
  roof: [['manual', 'pencil', 'Enter the footprint', 'Outside wall dimensions — rectangle, L, U, T or draw it. Pitch and overhang next.'], ['camera', 'camera', 'Scan corners from the ground', 'Stand back and aim at each outside corner of the house where it meets the ground.'], ['pitch', 'ruler', 'Measure pitch', 'Lay the phone on the roof or along a rafter for the pitch.'], ['demo', 'play', 'Load demo roof', '40 × 30 ft gable, 6/12, 1 ft overhang.']],
  exterior: [['manual', 'pencil', 'Enter the footprint', 'Outside wall lengths and wall height; then doors and windows.'], ['camera', 'camera', 'Scan corners from outside', 'Aim at each outside corner where the wall meets the ground.'], ['demo', 'play', 'Load demo house', 'L-shaped ranch with doors and windows.']],
  flat: [['camera', 'camera', 'Scan the corners', 'Stand inside the area and aim at each corner on the ground.'], ['manual', 'pencil', 'Enter dimensions', 'Rectangle, L, U, T or draw it.'], ['demo', 'play', 'Load demo deck', '16 × 12 ft deck, 3 ft high.']],
  linear: [['manual', 'pencil', 'Enter the run', 'Total length, corners, gates and height.'], ['measure', 'ruler', 'Quick measure', 'Measure stretches with the phone sensors and add them up.'], ['demo', 'play', 'Load demo fence', '150 ft privacy fence with 2 gates.']],
};

export function renderScan(root, { navigate }) {
  const s = store.settings; const units = s.units; const project = store.activeProject();
  root.innerHTML = '';
  root.append(el(`<div class="hero"><h2>Measure</h2><p>Rooms, roofs, siding, decks, driveways and fences. Every measurement feeds the takeoff, the 3D model and the bid.</p></div>`));
  const seg = h('div', { class: 'kind-seg mt12' }); for (const [k, v] of Object.entries(KINDS)) seg.append(el(`<button class="chip ${k === measureKind ? 'on' : ''}" data-kind="${k}">${icons[v.icon] || ''} ${esc(v.label)}</button>`)); root.append(seg);
  const card = h('div', { class: 'card' }, el(`<div class="card-title"><h3>${esc(KINDS[measureKind].label)}</h3>${KINDS[measureKind].hint ? `<span class="dim small">${esc(KINDS[measureKind].hint)}</span>` : ''}</div>`));
  const list = h('div', { class: 'list' });
  for (const [act, ic, title, desc] of MODES[measureKind]) list.append(el(`<button class="item" data-act="${act}" style="text-align:left;width:100%"><div class="lead">${icons[ic]}</div><div class="grow"><div class="row between"><b>${esc(title)}</b>${act === 'ar' ? '<span class="pill draft" data-role="ar-badge">checking…</span>' : ''}</div><div class="dim small">${esc(desc)}</div></div><span class="chev">${icons.chevron}</span></button>`));
  card.append(list); root.append(card);
  root.append(el(`<div class="flag info mt12">${icons.info}<div><b>Accuracy</b> — sensor scans are typically within 2–4% once squared up: right for bids, not for cutting. Confirm critical dimensions with a tape or laser.</div></div>`));
  if (project && project.rooms.length) {
    const rc = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Measured on ${esc(project.name)}</h3><span class="dim small">${project.rooms.length}</span></div>`)); const rl = h('div', { class: 'list' });
    for (const r of project.rooms) { const k = kindOf(r); rl.append(el(`<div class="item"><div class="lead">${icons[KINDS[k].icon] || icons.cube}</div><div class="grow"><b>${esc(r.name)}</b><div class="dim small">${esc(KINDS[k].short)} · ${esc(areaSummary(r, units))}${r.cloudCount ? ` · ${r.cloudCount.toLocaleString()} pts` : ''}</div></div>${k !== 'linear' ? `<button class="btn xs secondary" data-room="${r.id}" data-act="view">3D</button>` : ''}<button class="btn xs neutral" data-room="${r.id}" data-act="edit-room">Edit</button><button class="btn xs danger" data-room="${r.id}" data-act="del-room">${icons.trash}</button></div>`)); }
    rc.append(rl); root.append(rc);
    root.append(el(`<div class="btn-grid mt12"><button class="btn secondary" data-act="go-build">${icons.cube} Configure products</button><button class="btn" data-act="go-bid">${icons.doc} Build the bid</button></div>`));
  }
  if (measureKind === 'room') (async () => { if (arSupported === null) arSupported = await isARSupported(); const b = $('[data-role="ar-badge"]', root); if (b) { b.textContent = arSupported ? 'available' : 'not on this device'; b.className = `pill ${arSupported ? 'signed' : 'draft'}`; } })();

  const afterCapture = async (area, cloud) => {
    const reviewed = await reviewArea(area, { units }); if (!reviewed) return;
    store.addRoom(reviewed); if (cloud) { try { await idb.put(reviewed.id, cloud.positions, cloud.colors); } catch (e) { console.warn(e); } }
    toast(`${reviewed.name} saved`); if (kindOf(reviewed) === 'linear') renderScan(root, { navigate }); else navigate('model');
  };
  bind(root, 'click', async (e) => {
    const kb = e.target.closest('[data-kind]'); if (kb) { measureKind = kb.dataset.kind; return renderScan(root, { navigate }); }
    const btn = e.target.closest('[data-act]'); if (!btn) return; const act = btn.dataset.act; const d = s.defaults; const k = measureKind;
    if (act === 'ar') { if (arSupported === false) return toast('WebXR AR is not available here. Use Camera scan.'); const res = await startARScan({ units, defaults: d }); if (res) afterCapture(res.room, res.cloud); }
    if (act === 'camera') { await requestMotionPermission(); const room = await startCameraScan({ units, cameraHeight: d.cameraHeight, defaults: d, cornersOnly: k !== 'room' }); if (room) afterCapture(asKind(room, k, { name: { roof: 'Main roof', exterior: 'House exterior', flat: 'Patio' }[k] })); }
    if (act === 'manual') { if (k === 'linear') return afterCapture(makeArea({ kind: 'linear', name: 'Fence run' })); const area = await quickShapeSheet({ units, defaults: d, kind: k }); if (area) afterCapture(area); }
    if (act === 'measure') startQuickMeasure({ units, cameraHeight: d.cameraHeight });
    if (act === 'pitch') { const p = await measurePitch(); if (p) toast(`Pitch ${p}/12 — enter the footprint next to apply it`, 3500); }
    if (act === 'demo') afterCapture(demoArea(k));
    if (act === 'go-build') navigate('build'); if (act === 'go-bid') navigate('estimate');
    if (act === 'view') { store.setActiveRoom(btn.dataset.room); navigate('model'); }
    if (act === 'edit-room') { const r = project.rooms.find((x) => x.id === btn.dataset.room); const edited = await reviewArea(r, { units, title: `Edit ${r.name}` }); if (edited) { store.updateRoom(r.id, (room) => Object.assign(room, edited, { id: r.id })); toast('Saved'); renderScan(root, { navigate }); } }
    if (act === 'del-room') { if (await confirmDialog('Delete this measurement?', { okLabel: 'Delete', danger: true })) { store.removeRoom(btn.dataset.room); renderScan(root, { navigate }); } }
  });
}

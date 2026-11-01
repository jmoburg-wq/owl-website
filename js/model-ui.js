// Model tab: 3D viewer, finishes preview, floor plan, exports
import { store, idb } from './store.js';
import { RoomViewer, FLOOR_MATERIALS, WALL_COLORS } from './model3d.js';
import { floorPlanSVG, svgToPngBlob } from './floorplan.js';
import { metrics, fmtArea, fmtLen, fmtLF, toSF, kindOf, roofMetrics, flatMetrics, areaSummary, KINDS } from './geometry.js';
import { el, h, $, $$, toast, icons, esc, download, fmtNum, bind } from './ui.js';
import { reviewArea } from './scanner/scan.js';

let viewer = null;
export function disposeViewer() { if (viewer) { viewer.dispose(); viewer = null; } }

export async function renderModel(root, { navigate }) {
  const s = store.settings; const units = s.units; const project = store.activeProject(); const room = store.activeRoom();
  disposeViewer(); root.innerHTML = '';
  if (!project || !room) { root.append(el(`<div class="empty">${icons.cube}<h3>No room to model</h3><p class="mt8">Scan a room, enter its dimensions, or load the demo to see the 3D model and floor plan.</p><div class="row mt16" style="justify-content:center;gap:8px"><button class="btn" data-act="scan">${icons.scan} Scan a room</button></div></div>`)); bind(root, 'click', (e) => { if (e.target.closest('[data-act="scan"]')) navigate('scan'); }); return; }
  room.preview = room.preview || { floor: 'existing', wall: '#f4f1ea' };
  if (project.rooms.length > 1) { const ch = h('div', { class: 'chips mt8' }); for (const r of project.rooms) { const c = el(`<button class="chip ${r.id === room.id ? 'on' : ''}">${esc(r.name)}</button>`); c.addEventListener('click', () => { store.setActiveRoom(r.id); renderModel(root, { navigate }); }); ch.append(c); } root.append(ch); }
  const kind = kindOf(room);
  if (kind === 'linear') { root.append(el(`<div class="card"><div class="card-title"><h3>${esc(room.name)}</h3><span class="dim small">${esc(KINDS.linear.label)}</span></div><p>${esc(areaSummary(room, units))}</p><div class="plan-wrap">${floorPlanSVG(room, { units })}</div><div class="btn-grid mt12"><button class="btn secondary" data-act="edit">${icons.pencil} Edit</button><button class="btn" data-act="estimate">${icons.doc} Build the bid</button></div></div>`)); bind(root, 'click', async (e) => { const act = e.target.closest('[data-act]')?.dataset.act; if (act === 'estimate') navigate('estimate'); if (act === 'edit') { const ed = await reviewArea(room, { units, title: `Edit ${room.name}` }); if (ed) { store.updateRoom(room.id, (r) => Object.assign(r, ed, { id: room.id })); renderModel(root, { navigate }); } } }); return; }
  const vwrap = el(`<div class="viewer"><div class="overlay"><div class="row" style="gap:6px"><button class="btn sm glass" data-act="fit" style="background:rgba(0,0,0,.45);color:#fff">${icons.rotate} Orbit</button><button class="btn sm" data-act="top" style="background:rgba(0,0,0,.45);color:#fff">${icons.grid} Plan</button><button class="btn sm" data-act="inside" style="background:rgba(0,0,0,.45);color:#fff">${icons.eye} Inside</button></div><button class="btn icon" data-act="snap" style="background:rgba(0,0,0,.45);color:#fff" title="Save snapshot for the estimate">${icons.photo}</button></div><div class="legend">Drag to orbit · pinch to zoom · two fingers to pan</div></div>`);
  root.append(vwrap);
  const cloud = room.cloudCount ? await idb.get(room.id) : null;
  viewer = new RoomViewer(vwrap, { units }); window.__viewer = viewer; viewer.setOptions({ floorMaterial: room.preview.floor, wallColor: room.preview.wall, cloud: !!cloud }); viewer.setRoom(room, cloud);
  const tb = el(`<div class="toolbar"><button class="btn sm neutral" data-opt="ceiling">Ceiling</button><button class="btn sm neutral" data-opt="transparentWalls">X-ray walls</button><button class="btn sm secondary" data-opt="labels">Labels</button><button class="btn sm secondary" data-opt="grid">Grid</button>${cloud ? `<button class="btn sm secondary" data-opt="cloud">Point cloud (${room.cloudCount.toLocaleString()})</button>` : ''}<button class="btn sm neutral" data-act="edit">${icons.pencil} Edit room</button></div>`);
  root.append(tb);
  tb.addEventListener('click', (e) => { const b = e.target.closest('[data-opt]'); if (!b) return; const k = b.dataset.opt; viewer.opts[k] = !viewer.opts[k]; b.className = `btn sm ${viewer.opts[k] ? 'secondary' : 'neutral'}`; viewer.setOptions({}); });
  const m = metrics(room);
  if (kind === 'roof') { const r = roofMetrics(room); root.append(el(`<div class="stat-grid mt12"><div class="stat"><div class="v">${r.squares.toFixed(1)}</div><div class="k">squares</div></div><div class="stat"><div class="v">${r.pitch}/12</div><div class="k">${r.style} pitch</div></div><div class="stat"><div class="v">${fmtLF(r.eave, units)}</div><div class="k">eaves</div></div><div class="stat"><div class="v">${fmtLF(r.ridge + r.hip, units)}</div><div class="k">ridge + hips</div></div><div class="stat"><div class="v">${fmtLF(r.rake, units)}</div><div class="k">rakes</div></div><div class="stat"><div class="v">${fmtLF(r.valley, units)}</div><div class="k">valleys</div></div></div>`)); }
  else if (kind === 'flat') { const f = flatMetrics(room); root.append(el(`<div class="stat-grid mt12"><div class="stat"><div class="v">${fmtArea(f.area, units)}</div><div class="k">${esc(f.use)}</div></div><div class="stat"><div class="v">${fmtLF(f.perimeter, units)}</div><div class="k">perimeter</div></div><div class="stat"><div class="v">${f.use === 'deck' ? f.heightFt + ' ft' : ((toSF(f.area) * f.thicknessIn / 12) / 27).toFixed(1) + ' cy'}</div><div class="k">${f.use === 'deck' ? 'height' : `at ${f.thicknessIn}"`}</div></div></div>`)); }
  else
  root.append(el(`<div class="stat-grid mt12"><div class="stat"><div class="v">${fmtArea(m.floorArea, units)}</div><div class="k">floor</div></div><div class="stat"><div class="v">${fmtArea(m.wallAreaNet, units)}</div><div class="k">wall net</div></div><div class="stat"><div class="v">${fmtLF(m.perimeter, units)}</div><div class="k">perimeter</div></div><div class="stat"><div class="v">${fmtLen(m.H, units)}</div><div class="k">ceiling</div></div><div class="stat"><div class="v">${m.doorCount} / ${m.windowCount}</div><div class="k">doors / win</div></div><div class="stat"><div class="v">${units === 'metric' ? m.volume.toFixed(1) + ' m³' : fmtNum(m.volume / 0.0283168, 0) + ' cf'}</div><div class="k">volume</div></div></div>`));
  // finishes preview (interior rooms only)
  const fin = h('div', { class: `card ${kind === 'room' ? '' : 'hidden'}` }, el(`<div class="card-title"><h3>Preview finishes</h3><span class="dim small">before / after</span></div>`));
  const fch = h('div', { class: 'chips' }); for (const [k, v] of Object.entries(FLOOR_MATERIALS)) { const c = el(`<button class="chip ${room.preview.floor === k ? 'on' : ''}" data-floor="${k}">${v.label}</button>`); fch.append(c); } fin.append(fch);
  const sw = h('div', { class: 'swatches mt12' }); for (const col of WALL_COLORS) sw.append(el(`<button class="swatch ${room.preview.wall === col ? 'on' : ''}" data-wall="${col}" style="background:${col}"></button>`)); const custom = el(`<input type="color" value="${room.preview.wall}" style="width:34px;height:34px;border:0;border-radius:50%;padding:0;background:none">`); sw.append(custom); fin.append(sw);
  root.append(fin);
  fin.addEventListener('click', (e) => { const f = e.target.closest('[data-floor]'); const w = e.target.closest('[data-wall]'); if (f) { room.preview.floor = f.dataset.floor; $$('[data-floor]', fin).forEach((x) => x.classList.toggle('on', x === f)); viewer.setOptions({ floorMaterial: room.preview.floor }); store.update(() => {}, 'preview'); } if (w) { room.preview.wall = w.dataset.wall; $$('[data-wall]', fin).forEach((x) => x.classList.toggle('on', x === w)); viewer.setOptions({ wallColor: room.preview.wall }); store.update(() => {}, 'preview'); } });
  custom.addEventListener('input', () => { room.preview.wall = custom.value; viewer.setOptions({ wallColor: custom.value }); store.update(() => {}, 'preview'); });
  // floor plan
  const plan = h('div', { class: 'card' }, el(`<div class="card-title"><h3>Floor plan</h3><div class="row" style="gap:6px"><button class="btn xs secondary" data-act="svg">SVG</button><button class="btn xs secondary" data-act="png">PNG</button></div></div>`));
  const svg = floorPlanSVG(room, { units }); plan.append(el(`<div class="plan-wrap">${svg}</div>`)); root.append(plan);
  // exports
  root.append(el(`<div class="card"><div class="card-title"><h3>Export 3D model</h3><span class="dim small">meters</span></div><div class="btn-grid"><button class="btn secondary" data-act="glb">${icons.download} GLB</button><button class="btn secondary" data-act="obj">${icons.download} OBJ</button><button class="btn secondary" data-act="stl">${icons.download} STL</button><button class="btn secondary" data-act="ply" ${cloud ? '' : 'disabled'}>${icons.download} PLY cloud</button></div><button class="btn neutral block mt12" data-act="json">${icons.download} Room data (JSON)</button><p class="dim tiny mt8">GLB opens in Windows 3D Viewer, macOS Preview (via converter), Blender, SketchUp and most CAD. OBJ/STL for CNC and slicers.</p></div>`));
  root.append(el(`<button class="btn block mt12" data-act="estimate">${icons.doc} Continue to estimate ${icons.chevron}</button>`));
  // auto snapshot for the document
  setTimeout(() => { try { saveSnapshot(room, false); } catch {} }, 900);
  const slug = (room.name || 'room').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  bind(root, 'click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act || !viewer) return;
    if (act === 'fit') viewer.fitCamera(); if (act === 'top') viewer.topView(); if (act === 'inside') viewer.insideView();
    if (act === 'snap') { saveSnapshot(room, true); }
    if (act === 'edit') { const edited = await reviewArea(room, { units, title: `Edit ${room.name}` }); if (edited) { store.updateRoom(room.id, (r) => Object.assign(r, edited, { id: room.id })); renderModel(root, { navigate }); } }
    if (act === 'svg') download(`${slug}-floorplan.svg`, svg, 'image/svg+xml');
    if (act === 'png') { try { download(`${slug}-floorplan.png`, await svgToPngBlob(svg, 2)); } catch { toast('PNG export failed'); } }
    if (act === 'glb') { try { download(`${slug}.glb`, new Blob([await viewer.exportGLB()], { type: 'model/gltf-binary' })); } catch (err) { toast('GLB export failed: ' + err.message); } }
    if (act === 'obj') download(`${slug}.obj`, viewer.exportOBJ(), 'text/plain');
    if (act === 'stl') download(`${slug}.stl`, new Blob([viewer.exportSTL()], { type: 'model/stl' }));
    if (act === 'ply') { const p = viewer.exportPLY(); if (p) download(`${slug}-cloud.ply`, new Blob([p], { type: 'application/octet-stream' })); }
    if (act === 'json') download(`${slug}.json`, JSON.stringify({ ...room, metrics: { floorSf: toSF(m.floorArea), wallNetSf: toSF(m.wallAreaNet), perimeterFt: m.perimeter / 0.3048, ceilingFt: m.H / 0.3048 } }, null, 2), 'application/json');
    if (act === 'estimate') navigate('estimate');
  });
}

function saveSnapshot(room, announce) {
  if (!viewer) return; const src = viewer.snapshot(); const img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); const sc = Math.min(1, 720 / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); store.updateRoom(room.id, (r) => { r.snapshot = c.toDataURL('image/jpeg', 0.78); }); if (announce) toast('Snapshot saved to the estimate'); };
  img.src = src;
}

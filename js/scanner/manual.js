// manual room entry: quick shapes + touch drawing editor
import { makeRect, makeL, makeU, makeT, makeRoom, makeArea, parseLen, fmtLen, toUnits, fromUnits, unitLabel, dist, squareUp, dedupe } from '../geometry.js';
import { sheet, el, h, $, $$, toast, segEl, icons, esc } from '../ui.js';
import { kindOf } from '../geometry.js';

const SHAPES = [
  { key: 'rect', label: 'Rectangle', dims: [['w', 'Width'], ['d', 'Depth']], build: (v) => makeRect(v.w, v.d) },
  { key: 'l', label: 'L-shape', dims: [['w', 'Overall width'], ['d', 'Overall depth'], ['cw', 'Cut-out width'], ['cd', 'Cut-out depth']], build: (v) => makeL(v.w, v.d, v.cw, v.cd) },
  { key: 'u', label: 'U-shape', dims: [['w', 'Overall width'], ['d', 'Overall depth'], ['cw', 'Notch width'], ['cd', 'Notch depth']], build: (v) => makeU(v.w, v.d, v.cw, v.cd) },
  { key: 't', label: 'T-shape', dims: [['w', 'Top width'], ['d', 'Overall depth'], ['cw', 'Stem width'], ['cd', 'Top depth']], build: (v) => makeT(v.w, v.d, v.cw, v.cd) },
];
const DEF = { imperial: { w: '14', d: '12', cw: '5', cd: '4' }, metric: { w: '4.2', d: '3.6', cw: '1.5', cd: '1.2' } };

const KIND_TEXT = { room: { title: 'Enter room dimensions', name: 'Room', nameLabel: 'Room name', height: 'Ceiling height' }, exterior: { title: 'House footprint (outside walls)', name: 'House exterior', nameLabel: 'Name', height: 'Wall height (per story)' }, roof: { title: 'Building footprint for the roof', name: 'Main roof', nameLabel: 'Name', height: null }, flat: { title: 'Area dimensions', name: 'Patio', nameLabel: 'Name', height: null } };
/** Convert whatever the draw editor produced into an area of the requested kind. */
export function asKind(room, kind, extra = {}) { if (!room || kind === 'room' || kindOf(room) === kind) return room; const a = makeArea({ kind, name: extra.name || room.name, corners: room.corners, ceilingHeight: extra.ceilingHeight ?? room.ceilingHeight, source: room.source }); return a; }
export function quickShapeSheet({ units = 'imperial', defaults = {}, kind = 'room' } = {}) {
  const KT = KIND_TEXT[kind] || KIND_TEXT.room;
  return new Promise((resolve) => {
    let shape = SHAPES[0];
    const body = h('div');
    const nameF = el(`<div class="field"><label>${KT.nameLabel}</label><input type="text" value="${KT.name}" /></div>`);
    const segWrap = h('div', { class: 'field' }, el('<label>Shape</label>'));
    const dimsWrap = h('div', { class: 'inline-fields' });
    const defH = kind === 'exterior' ? 2.7432 : (defaults.ceilingHeight || 2.4384);
    const ceilF = el(`<div class="field ${KT.height ? '' : 'hidden'}"><label>${KT.height || ''}</label><div class="unit-input"><input type="text" value="${esc(units === 'metric' ? defH.toFixed(2) : fmtLen(defH, 'imperial'))}" /><span>${units === 'metric' ? 'm' : 'ft-in'}</span></div></div>`);
    const hint = el(`<p class="dim small mt8">Enter lengths like <b>12' 6"</b>, <b>12.5</b> (${unitLabel(units)}), or <b>3.8 m</b>. ${kind === 'room' || kind === 'exterior' ? 'Doors and windows are added on the next screen.' : kind === 'roof' ? 'Measure the outside of the walls; pitch and overhang come next.' : 'Thickness, height and use come next.'}</p>`);
    const drawBtn = h('button', { class: 'btn secondary block mt12', onClick: () => { sh.close(); drawEditor({ units, defaults }).then((r) => resolve(asKind(r, kind, { name: KT.name }))); } }, el(icons.pencil), 'Draw a custom outline instead');
    const renderDims = () => { dimsWrap.innerHTML = ''; for (const [k, label] of shape.dims) dimsWrap.append(el(`<div class="field"><label>${label}</label><div class="unit-input"><input type="text" data-k="${k}" value="${DEF[units][k]}" inputmode="decimal" /><span>${units === 'metric' ? 'm' : 'ft-in'}</span></div></div>`)); };
    segWrap.append(segEl(SHAPES.map((s) => ({ value: s.key, label: s.label })), shape.key, (v) => { shape = SHAPES.find((s) => s.key === v); renderDims(); }));
    renderDims();
    body.append(nameF, segWrap, dimsWrap, ceilF, hint, drawBtn);
    const sh = sheet({ title: KT.title, body, onClose: (r) => { if (r !== undefined) resolve(r || null); }, actions: [
      { label: 'Continue', keepOpen: true, onClick: () => {
        const vals = {}; for (const inp of $$('input[data-k]', dimsWrap)) { const m = parseLen(inp.value, units); if (!(m > 0.2)) { toast(`Check ${inp.closest('.field').querySelector('label').textContent.toLowerCase()}`); return; } vals[inp.dataset.k] = m; }
        if (shape.key !== 'rect' && (vals.cw >= vals.w || vals.cd >= vals.d)) { toast('Cut-out must be smaller than the room'); return; }
        const ch = KT.height ? parseLen($('input', ceilF).value, units) : defH; if (KT.height && !(ch > 1.5)) { toast(`Check ${KT.height.toLowerCase()}`); return; }
        const name = $('input', nameF).value.trim() || KT.name;
        const room = kind === 'room' ? makeRoom({ name, corners: shape.build(vals), ceilingHeight: ch, wallThickness: defaults.wallThickness, source: 'manual' }) : makeArea({ kind, name, corners: shape.build(vals), ceilingHeight: ch, wallThickness: defaults.wallThickness, source: 'manual' });
        sh.close(room);
      } },
      { label: 'Cancel', cls: 'neutral', onClick: () => null },
    ] });
  });
}

/** Touch drawing editor. Tap to place corners on a grid; drag to move; corners snap orthogonal. */
export function drawEditor({ units = 'imperial', defaults = {}, room = null } = {}) {
  return new Promise((resolve) => {
    const app = $('#app');
    const unitM = units === 'metric' ? 0.5 : 0.3048; // grid cell
    let corners = room ? room.corners.map((p) => ({ ...p })) : [];
    let closed = !!room; let ppm = 0; let originX = 0, originZ = 0; let dragging = -1; let snapOrtho = true;
    const view = el(`<div class="fullscreen" style="background:var(--bg);color:var(--fg)">
      <div class="appbar"><button class="btn ghost" data-act="cancel">${icons.back} Back</button><div class="title">Draw outline</div><button class="btn ghost" data-act="done">Done</button></div>
      <div style="padding:0 16px"><p class="muted small">Tap to add corners in order around the room. Drag a corner to adjust. Grid = 1 ${units === 'metric' ? '× 0.5 m' : 'ft'}. Lengths show live.</p></div>
      <div class="plan-editor grow" style="margin:10px 16px"><canvas></canvas></div>
      <div class="row" style="padding:8px 16px calc(var(--sa-b) + 12px);gap:8px;flex-wrap:wrap">
        <button class="btn sm neutral" data-act="undo">Undo</button><button class="btn sm neutral" data-act="clear">Clear</button>
        <button class="btn sm neutral" data-act="zoomout">−</button><button class="btn sm neutral" data-act="zoomin">+</button>
        <button class="btn sm secondary" data-act="ortho">Snap 90°: on</button>
        <button class="btn sm success" data-act="close">Close room</button>
      </div></div>`);
    app.append(view);
    const wrap = $('.plan-editor', view), canvas = $('canvas', view), g = canvas.getContext('2d');
    const fit = () => { const r = wrap.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; canvas.width = Math.floor(r.width * dpr); canvas.height = Math.floor(r.height * dpr); canvas.style.height = r.height + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); if (!ppm) { ppm = r.width / (units === 'metric' ? 9 : 24 * 0.3048); if (corners.length) { const xs = corners.map((p) => p.x), zs = corners.map((p) => p.z); const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs); ppm = Math.min((r.width - 80) / Math.max(w, 0.5), (r.height - 80) / Math.max(d, 0.5)); originX = 40 - Math.min(...xs) * ppm; originZ = 40 - Math.min(...zs) * ppm; } else { originX = 40; originZ = 40; } } draw(); };
    const toPx = (p) => ({ x: originX + p.x * ppm, y: originZ + p.z * ppm });
    const toM = (px, py) => ({ x: (px - originX) / ppm, z: (py - originZ) / ppm });
    const snap = (p, prev) => { let x = Math.round(p.x / unitM) * unitM, z = Math.round(p.z / unitM) * unitM; if (snapOrtho && prev) { if (Math.abs(x - prev.x) < Math.abs(z - prev.z)) x = prev.x; else z = prev.z; } return { x, z }; };
    const draw = () => {
      const W = canvas.width / (window.devicePixelRatio || 1), H = canvas.height / (window.devicePixelRatio || 1);
      g.clearRect(0, 0, W, H); g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-elev') || '#fff'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,130,150,0.18)'; g.lineWidth = 1; const step = unitM * ppm;
      for (let x = originX % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = originZ % step; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      if (!corners.length) { g.fillStyle = '#8e8e99'; g.font = '14px -apple-system, Inter, sans-serif'; g.textAlign = 'center'; g.fillText('Tap to place the first corner', W / 2, H / 2); return; }
      const pts = corners.map(toPx);
      if (pts.length > 2) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (closed) g.closePath(); g.fillStyle = 'rgba(31,111,235,0.10)'; g.fill(); }
      g.strokeStyle = '#1f6feb'; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (closed) g.closePath(); g.stroke();
      if (!closed && pts.length > 1) { g.setLineDash([6, 6]); g.strokeStyle = 'rgba(31,111,235,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y); g.lineTo(pts[0].x, pts[0].y); g.stroke(); g.setLineDash([]); }
      const n = corners.length; const segs = closed ? n : n - 1;
      g.font = 'bold 12px -apple-system, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < segs; i++) { const a = corners[i], b = corners[(i + 1) % n]; const L = dist(a, b); if (L < 0.01) continue; const pa = toPx(a), pb = toPx(b); const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2; const txt = fmtLen(L, units); const w = g.measureText(txt).width + 12; g.fillStyle = 'rgba(17,17,20,0.85)'; g.beginPath(); g.roundRect(mx - w / 2, my - 10, w, 20, 6); g.fill(); g.fillStyle = '#fff'; g.fillText(txt, mx, my); }
      pts.forEach((p, i) => { g.beginPath(); g.arc(p.x, p.y, i === dragging ? 12 : 9, 0, Math.PI * 2); g.fillStyle = i === 0 ? '#30b15a' : '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1f6feb'; g.stroke(); });
    };
    const pos = (e) => { const r = canvas.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    let downAt = null, moved = false;
    canvas.addEventListener('pointerdown', (e) => { const p = pos(e); downAt = p; moved = false; dragging = corners.findIndex((c) => { const q = toPx(c); return Math.hypot(q.x - p.x, q.y - p.y) < 22; }); canvas.setPointerCapture(e.pointerId); draw(); });
    canvas.addEventListener('pointermove', (e) => { if (!downAt) return; const p = pos(e); if (Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) moved = true; if (dragging >= 0 && moved) { const prev = corners[(dragging - 1 + corners.length) % corners.length]; const m = toM(p.x, p.y); corners[dragging] = snap(m, corners.length > 1 ? prev : null); draw(); } });
    canvas.addEventListener('pointerup', (e) => { if (!downAt) return; const p = pos(e); if (dragging < 0 && !moved && !closed) { const m = toM(p.x, p.y); const prev = corners[corners.length - 1]; const np = snap(m, prev); if (corners.length >= 3 && dist(np, corners[0]) < unitM * 0.75) { closed = true; } else if (!prev || dist(np, prev) > 0.05) corners.push(np); } downAt = null; dragging = -1; draw(); });
    view.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'cancel') { view.remove(); resolve(null); }
      if (act === 'undo') { if (closed) closed = false; else corners.pop(); draw(); }
      if (act === 'clear') { corners = []; closed = false; draw(); }
      if (act === 'zoomin') { ppm *= 1.25; draw(); } if (act === 'zoomout') { ppm /= 1.25; draw(); }
      if (act === 'ortho') { snapOrtho = !snapOrtho; e.target.textContent = `Snap 90°: ${snapOrtho ? 'on' : 'off'}`; }
      if (act === 'close') { if (corners.length < 3) return toast('Need at least 3 corners'); closed = true; draw(); }
      if (act === 'done') {
        if (corners.length < 3) return toast('Need at least 3 corners');
        const c = dedupe(corners); if (c.length < 3) return toast('Corners are too close together');
        const out = room ? { ...room, corners: c } : makeRoom({ name: 'Room', corners: c, ceilingHeight: defaults.ceilingHeight || 2.4384, wallThickness: defaults.wallThickness, source: 'manual' });
        view.remove(); resolve(out);
      }
    });
    new ResizeObserver(fit).observe(wrap); setTimeout(fit, 30);
  });
}

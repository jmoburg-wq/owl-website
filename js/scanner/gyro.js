// camera + motion-sensor room scanner (works on iPhone and Android; no LiDAR required)
// Principle: the phone is held at a known height h. Aiming the crosshair at a point on the floor gives a
// depression angle θ below the horizon → horizontal distance d = h / tan θ. The compass/yaw gives the
// bearing. Each tap places a floor corner relative to where you stand. Aim at the wall/ceiling junction
// above a captured corner to get ceiling height = h + d·tan(elevation).
import { makeRoom, fmtLen, dist, STD, walls } from '../geometry.js';
import { el, $, $$, toast, icons, promptDialog, sheet } from '../ui.js';

const D2R = Math.PI / 180;
/** Rear-camera direction in world (E = east, N = north, U = up) from W3C device orientation angles. */
export function cameraDir(alpha, beta, gamma) {
  const a = (alpha || 0) * D2R, b = (beta || 0) * D2R, g = (gamma || 0) * D2R;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  return { E: -(sG * cA + cG * sB * sA), N: -(sG * sA - cG * sB * cA), U: -(cG * cB) };
}
/** Floor intersection of the camera ray given camera height h (m). Returns null if aiming above the floor. */
export function floorPoint(dir, h) {
  const horiz = Math.hypot(dir.E, dir.N); if (horiz < 1e-6) return null;
  const theta = Math.atan2(-dir.U, horiz); if (theta < 4 * D2R) return null; // < 4° below horizon → too far/unstable
  const d = h / Math.tan(theta);
  return { d, theta, x: (dir.E / horiz) * d, z: -(dir.N / horiz) * d, bearing: Math.atan2(dir.E, dir.N) };
}

export async function requestMotionPermission() {
  try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { const r = await DeviceOrientationEvent.requestPermission(); return r === 'granted'; } } catch { return false; }
  return 'DeviceOrientationEvent' in window;
}

export class SensorRig {
  constructor() { this.samples = []; this.last = null; this.hasData = false; this.onUpdate = null; this._h = (e) => this._handle(e); this.stream = null; }
  async start(videoEl) {
    window.addEventListener('deviceorientationabsolute', this._h, true); window.addEventListener('deviceorientation', this._h, true);
    if (videoEl && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); videoEl.srcObject = this.stream; videoEl.setAttribute('playsinline', ''); videoEl.muted = true; await videoEl.play().catch(() => {}); } catch (e) { console.warn('camera unavailable', e); }
    }
    return true;
  }
  _handle(e) {
    if (e.type === 'deviceorientation' && this._absSeen) return; if (e.type === 'deviceorientationabsolute') this._absSeen = true;
    if (e.alpha == null && e.beta == null) return;
    // Relative geometry only needs a consistent frame, so use alpha as reported. iOS's webkitCompassHeading is
    // magnetometer-based, noisy indoors, and changes meaning when the phone is held upright — never mix it in.
    const dir = cameraDir(e.alpha, e.beta, e.gamma);
    this.samples.push(dir); if (this.samples.length > 10) this.samples.shift();
    const n = this.samples.length; const avg = { E: 0, N: 0, U: 0 }; for (const s of this.samples) { avg.E += s.E / n; avg.N += s.N / n; avg.U += s.U / n; }
    const len = Math.hypot(avg.E, avg.N, avg.U) || 1; avg.E /= len; avg.N /= len; avg.U /= len;
    const spread = this.samples.reduce((m, s) => Math.max(m, Math.acos(Math.min(1, s.E * avg.E + s.N * avg.N + s.U * avg.U))), 0);
    this.last = { ...avg, steady: spread < 1.5 * D2R, raw: { alpha: e.alpha, beta: e.beta, gamma: e.gamma } }; this.hasData = true;
    this.onUpdate && this.onUpdate(this.last);
  }
  stop() { window.removeEventListener('deviceorientationabsolute', this._h, true); window.removeEventListener('deviceorientation', this._h, true); if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; } }
}

function minimap(canvas, corners, ghost, scale) {
  const g = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; g.clearRect(0, 0, W, H);
  const pts = [...corners, ...(ghost ? [ghost] : [])]; const maxR = Math.max(1.5, ...pts.map((p) => Math.hypot(p.x, p.z)));
  const s = (W / 2 - 10) / maxR; const X = (x) => W / 2 + x * s, Y = (z) => H / 2 + z * s;
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(W / 2, H / 2, (W / 2 - 10) * 0.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 10, 0, Math.PI * 2); g.stroke();
  if (corners.length) { g.beginPath(); corners.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z)))); if (corners.length > 2) g.closePath(); g.fillStyle = 'rgba(31,111,235,0.25)'; g.fill(); g.strokeStyle = '#4da3ff'; g.lineWidth = 2; g.stroke(); corners.forEach((p, i) => { g.beginPath(); g.arc(X(p.x), Y(p.z), 4, 0, Math.PI * 2); g.fillStyle = i === 0 ? '#30b15a' : '#fff'; g.fill(); }); }
  g.beginPath(); g.arc(W / 2, H / 2, 4, 0, Math.PI * 2); g.fillStyle = '#ff9f0a'; g.fill();
  if (ghost) { g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(X(ghost.x), Y(ghost.z)); g.strokeStyle = 'rgba(255,159,10,0.8)'; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(X(ghost.x), Y(ghost.z), 5, 0, Math.PI * 2); g.strokeStyle = '#ff9f0a'; g.lineWidth = 2; g.stroke(); }
}

/** Full-screen camera scan. Resolves with a room or null. */
export function startCameraScan({ units = 'imperial', cameraHeight = 1.45, defaults = {}, cornersOnly = false } = {}) {
  return new Promise(async (resolve) => {
    const app = $('#app'); let h = cameraHeight;
    const view = el(`<div class="fullscreen">
      <video autoplay muted playsinline></video>
      <div class="crosshair"><div class="ring"></div></div>
      <div class="hud">
        <div class="hud-top">
          <div class="hud-card" data-role="instr"><b>Step 1 · Corners</b><br>Stand in one spot (center of the room is best). Aim the crosshair at a floor corner and tap <b>Capture</b>. Go around the room in order.</div>
          <div class="col" style="align-items:flex-end;gap:8px"><button class="btn icon glass" data-act="exit">${icons.x}</button><canvas class="minimap" width="240" height="240"></canvas></div>
        </div>
        <div class="hud-bottom">
          <div class="steps"><i class="on"></i><i></i><i></i></div>
          <div class="hud-readout"><div class="r"><b data-role="dist">—</b><span>distance</span></div><div class="r"><b data-role="angle">—</b><span>tilt</span></div><div class="r"><b data-role="count">0</b><span>corners</span></div></div>
          <div class="hud-actions">
            <button class="btn glass sm" data-act="height">${icons.ruler} Cam ${fmtLen(h, units)}</button>
            <button class="shutter" data-act="capture">TAP</button>
            <button class="btn glass sm" data-act="next" disabled>Close room ${icons.chevron}</button>
          </div>
          <div class="row" style="gap:8px"><button class="btn glass xs" data-act="undo">Undo</button><button class="btn glass xs hidden" data-act="skip">Skip</button><button class="btn glass xs hidden" data-act="door">+ Door</button><button class="btn glass xs hidden" data-act="window">+ Window</button><button class="btn glass xs hidden" data-act="finish">Finish</button></div>
        </div>
      </div></div>`);
    app.append(view);
    const video = $('video', view), cross = $('.crosshair', view), mm = $('.minimap', view);
    const R = (role) => $(`[data-role="${role}"]`, view), A = (act) => $(`[data-act="${act}"]`, view);
    const rig = new SensorRig(); await rig.start(video);
    if (!video.srcObject) { view.style.background = 'linear-gradient(180deg,#1b2233,#0b0d12)'; toast('Camera unavailable — sensors still work. Aim the top edge of the phone.', 3500); }
    let stage = 'corners'; const corners = []; const dists = []; const openings = []; let pending = []; let ceiling = null; let oType = 'door';
    let current = null; let noData = setTimeout(() => { if (!rig.hasData) R('instr').innerHTML = '<b>No motion data</b><br>Your browser blocked motion sensors. On iPhone: Settings → Safari → Motion & Orientation Access, then reload. You can still enter dimensions manually.'; }, 2500);
    rig.onUpdate = (dir) => {
      const fp = floorPoint(dir, h); current = fp; const tilt = Math.asin(Math.max(-1, Math.min(1, dir.U))) / D2R;
      R('angle').textContent = `${tilt > 0 ? '+' : ''}${tilt.toFixed(0)}°`;
      if (stage === 'ceiling') { const d1 = dists[0] || 2; const hh = tilt > 2 ? h + d1 * Math.tan(tilt * D2R) : null; R('dist').textContent = hh ? fmtLen(hh, units) : '—'; cross.classList.toggle('locked', !!hh && dir.steady); }
      else { R('dist').textContent = fp ? fmtLen(fp.d, units) : '—'; cross.classList.toggle('locked', !!fp && dir.steady); }
      minimap(mm, corners, stage === 'corners' || stage === 'openings' ? fp : null);
    };
    const setStage = (s) => {
      stage = s; const steps = $$('.steps i', view); steps.forEach((i) => (i.className = '')); const idx = { corners: 0, ceiling: 1, openings: 2 }[s]; steps.forEach((i, k) => (i.className = k < idx ? 'done' : k === idx ? 'on' : ''));
      A('next').classList.toggle('hidden', s !== 'corners'); A('skip').classList.toggle('hidden', s !== 'ceiling'); A('door').classList.toggle('hidden', s !== 'openings'); A('window').classList.toggle('hidden', s !== 'openings'); A('finish').classList.toggle('hidden', s !== 'openings'); A('undo').classList.toggle('hidden', s === 'ceiling');
      if (s === 'ceiling') { R('instr').innerHTML = `<b>Step 2 · Ceiling height</b><br>Without moving, aim at the <b>top</b> of the wall directly above your <b>first corner</b> (green dot) and tap. Reading shows live.`; A('capture').textContent = 'TAP'; }
      if (s === 'openings') { R('instr').innerHTML = `<b>Step 3 · Doors & windows (optional)</b><br>Tap <b>+ Door</b> or <b>+ Window</b>, then aim at the floor under the <b>left edge</b> and tap, then the <b>right edge</b> and tap. Finish when done.`; A('capture').textContent = 'TAP'; }
    };
    const finish = () => {
      rig.stop(); clearTimeout(noData); view.remove();
      if (corners.length < 3) return resolve(null);
      const room = makeRoom({ name: 'Scanned room', corners, ceilingHeight: ceiling || defaults.ceilingHeight || 2.4384, wallThickness: defaults.wallThickness, source: 'camera' });
      if (!ceiling) room.ceilingAssumed = true;
      // map openings (captured relative to the standing point) into the normalized room frame
      const dx = -Math.min(...corners.map((p) => p.x)), dz = -Math.min(...corners.map((p) => p.z));
      const ws = walls(room);
      for (const o of openings) {
        const p1 = { x: o.p1.x + dx, z: o.p1.z + dz }, p2 = { x: o.p2.x + dx, z: o.p2.z + dz }; const mid = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
        let best = null, bd = Infinity; ws.forEach((w) => { const ux = (w.b.x - w.a.x) / w.length, uz = (w.b.z - w.a.z) / w.length; const t = Math.max(0, Math.min(w.length, (mid.x - w.a.x) * ux + (mid.z - w.a.z) * uz)); const px = w.a.x + ux * t, pz = w.a.z + uz * t; const d = Math.hypot(mid.x - px, mid.z - pz); if (d < bd) { bd = d; best = { w, ux, uz }; } });
        if (!best || bd > 0.9) continue;
        const t1 = (p1.x - best.w.a.x) * best.ux + (p1.z - best.w.a.z) * best.uz, t2 = (p2.x - best.w.a.x) * best.ux + (p2.z - best.w.a.z) * best.uz;
        const width = Math.max(0.4, Math.abs(t2 - t1)); const offset = Math.max(0, Math.min(best.w.length - width, Math.min(t1, t2)));
        room.openings.push(o.type === 'door' ? { id: Math.random().toString(36).slice(2, 8), type: 'door', wall: best.w.index, offset, width, height: Math.min(STD.doorH, room.ceilingHeight - 0.1), sill: 0 } : { id: Math.random().toString(36).slice(2, 8), type: 'window', wall: best.w.index, offset, width, height: STD.windowH, sill: STD.windowSill });
      }
      resolve(room);
    };
    view.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'exit') { rig.stop(); clearTimeout(noData); view.remove(); resolve(null); }
      if (act === 'height') { const v = await promptDialog('Camera height', { label: `Height of the phone camera above the floor (${units === 'metric' ? 'm' : 'ft-in'})`, value: units === 'metric' ? h.toFixed(2) : fmtLen(h, 'imperial'), hint: 'Hold the phone at the same height for every tap. Eye level ≈ 4\' 9" for a 5\' 9" person.' }); if (v) { const { parseLen } = await import('../geometry.js'); const m = parseLen(v, units); if (m > 0.5 && m < 2.5) { h = m; A('height').innerHTML = `${icons.ruler} Cam ${fmtLen(h, units)}`; } else toast('Enter a height between 0.5 m and 2.5 m'); } }
      if (act === 'capture') {
        if (!rig.hasData) return toast('Waiting for motion sensors…');
        if (stage === 'corners') { if (!current) return toast('Aim lower — the crosshair must be on the floor'); corners.push({ x: current.x, z: current.z }); dists.push(current.d); R('count').textContent = corners.length; A('next').disabled = corners.length < 3; if (navigator.vibrate) navigator.vibrate(15); }
        else if (stage === 'ceiling') { const tilt = Math.asin(rig.last.U); if (tilt <= 2 * D2R) return toast('Aim up at the ceiling line'); ceiling = h + (dists[0] || 2) * Math.tan(tilt); toast(`Ceiling ≈ ${fmtLen(ceiling, units)}`); setStage('openings'); }
        else if (stage === 'openings') { if (!pending.length && !pending.type) return toast('Tap + Door or + Window first'); if (!current) return toast('Aim at the floor under the opening edge'); pending.push({ x: current.x, z: current.z }); if (pending.length === 2) { openings.push({ type: oType, p1: pending[0], p2: pending[1] }); toast(`${oType === 'door' ? 'Door' : 'Window'} ${fmtLen(dist(pending[0], pending[1]), units)} added`); pending = []; R('instr').innerHTML = `<b>Step 3 · Doors & windows</b><br>${openings.length} added. Add another or tap <b>Finish</b>.`; } else R('instr').innerHTML = `<b>${oType === 'door' ? 'Door' : 'Window'} · right edge</b><br>Now aim at the floor under the <b>right edge</b> and tap.`; }
      }
      if (act === 'undo') { if (stage === 'corners') { corners.pop(); dists.pop(); R('count').textContent = corners.length; A('next').disabled = corners.length < 3; } else if (stage === 'openings') { if (pending.length) pending = []; else openings.pop(); } minimap(mm, corners, current); }
      if (act === 'next') { if (corners.length < 3) return; if (cornersOnly) return finish(); setStage('ceiling'); }
      if (act === 'skip') { ceiling = null; setStage('openings'); }
      if (act === 'door' || act === 'window') { oType = act; pending = []; pending.type = act; R('instr').innerHTML = `<b>${act === 'door' ? 'Door' : 'Window'} · left edge</b><br>Aim at the floor directly under the <b>left edge</b> and tap.`; }
      if (act === 'finish') finish();
    });
  });
}

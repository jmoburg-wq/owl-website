// quick measure tool (floor distance, point-to-point, vertical height) using the sensor rig
import { SensorRig, floorPoint, requestMotionPermission } from './scanner/gyro.js';
import { fmtLen, dist, parseLen } from './geometry.js';
import { el, $, toast, icons, promptDialog } from './ui.js';

export async function startQuickMeasure({ units = 'imperial', cameraHeight = 1.45 } = {}) {
  await requestMotionPermission();
  const app = $('#app'); let h = cameraHeight; let A = null; const log = [];
  const view = el(`<div class="fullscreen">
    <video autoplay muted playsinline></video><div class="crosshair"><div class="ring"></div></div>
    <div class="hud"><div class="hud-top"><div class="hud-card"><b>Quick measure</b><br>Aim at a floor point for distance. Tap <b>Mark A</b>, then aim at a second point to read A→B. Aim up above A for height.</div><button class="btn icon glass" data-act="exit">${icons.x}</button></div>
    <div class="hud-bottom"><div class="hud-readout"><div class="r"><b data-role="dist">—</b><span>to floor point</span></div><div class="r"><b data-role="ab">—</b><span>A → B</span></div><div class="r"><b data-role="height">—</b><span>height over A</span></div></div>
    <div class="hud-actions"><button class="btn glass sm" data-act="height">${icons.ruler} Cam ${fmtLen(h, units)}</button><button class="shutter" data-act="mark">MARK A</button><button class="btn glass sm" data-act="save">Log</button></div>
    <div class="hud-card" data-role="log" style="max-width:100%;width:100%;font-size:12px;opacity:.9">No measurements logged yet.</div></div></div></div>`);
  app.append(view);
  const rig = new SensorRig(); await rig.start($('video', view)); const D2R = Math.PI / 180; let cur = null, ab = null, hgt = null;
  rig.onUpdate = (dir) => {
    const fp = floorPoint(dir, h); cur = fp; $('[data-role="dist"]', view).textContent = fp ? fmtLen(fp.d, units) : '—'; $('.crosshair', view).classList.toggle('locked', !!fp && dir.steady);
    if (A) { if (fp) { ab = dist(A, fp); $('[data-role="ab"]', view).textContent = fmtLen(ab, units); } const tilt = Math.asin(Math.max(-1, Math.min(1, dir.U))); if (tilt > 1 * D2R) { hgt = h + A.d * Math.tan(tilt); $('[data-role="height"]', view).textContent = fmtLen(hgt, units); } }
  };
  view.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'exit') { rig.stop(); view.remove(); }
    if (act === 'mark') { if (!cur) return toast('Aim at the floor first'); A = { ...cur }; $('[data-act="mark"]', view).textContent = 'RE-MARK'; toast(`A marked at ${fmtLen(A.d, units)}`); }
    if (act === 'height') { const v = await promptDialog('Camera height', { label: 'Phone camera height above floor', value: units === 'metric' ? h.toFixed(2) : fmtLen(h, 'imperial') }); if (v) { const m = parseLen(v, units); if (m > 0.5 && m < 2.5) { h = m; $('[data-act="height"]', view).innerHTML = `${icons.ruler} Cam ${fmtLen(h, units)}`; } } }
    if (act === 'save') { const parts = []; if (cur) parts.push(`floor ${fmtLen(cur.d, units)}`); if (ab) parts.push(`A→B ${fmtLen(ab, units)}`); if (hgt) parts.push(`height ${fmtLen(hgt, units)}`); if (!parts.length) return; log.unshift(parts.join(' · ')); $('[data-role="log"]', view).innerHTML = log.slice(0, 5).map((l) => `• ${l}`).join('<br>'); try { await navigator.clipboard.writeText(log.join('\n')); } catch {} }
  });
}

/** Roof pitch gauge: lay the phone on the roof surface (or its long edge along a rafter) and read the slope.
 *  Tilt from vertical: cos θ = cos β · cos γ → pitch = 12 · tan θ. Resolves the pitch rounded to 0.5/12, or null. */
export function measurePitch() {
  return new Promise(async (resolve) => {
    await requestMotionPermission();
    const app = $('#app'); const samples = []; let cur = null;
    const view = el(`<div class="fullscreen" style="background:linear-gradient(180deg,#14213d,#0b0d12)"><div class="hud" style="position:relative;inset:auto;flex:1">
      <div class="hud-top"><div class="hud-card"><b>Roof pitch</b><br>Lay the phone flat on the roof surface — or hold its long edge along a rafter — and keep it still for a second.</div><button class="btn icon glass" data-a="x">${icons.x}</button></div>
      <div class="center" style="margin:auto"><div style="font-size:64px;font-weight:800;font-variant-numeric:tabular-nums" data-r="pitch">—</div><div class="dim" data-r="deg">waiting for sensors…</div>
        <svg viewBox="0 0 200 120" style="width:220px;margin-top:18px"><line x1="10" y1="110" x2="190" y2="110" stroke="rgba(255,255,255,.3)" stroke-width="2"/><line data-r="line" x1="10" y1="110" x2="190" y2="110" stroke="#4da3ff" stroke-width="6" stroke-linecap="round"/></svg></div>
      <div class="hud-bottom"><div class="row" style="gap:8px">${[4, 5, 6, 7, 8, 9, 10, 12].map((p) => `<button class="btn glass xs" data-p="${p}">${p}/12</button>`).join('')}</div><button class="btn block" data-a="use" disabled>Use this pitch</button></div></div></div>`);
    app.append(view);
    const onOri = (e) => { if (e.beta == null) return; const b = (e.beta * Math.PI) / 180, g = ((e.gamma || 0) * Math.PI) / 180; const tilt = Math.acos(Math.max(-1, Math.min(1, Math.abs(Math.cos(b) * Math.cos(g))))); samples.push(tilt); if (samples.length > 15) samples.shift(); const avg = samples.reduce((a, x) => a + x, 0) / samples.length; const spread = Math.max(...samples) - Math.min(...samples); const pitch = Math.tan(avg) * 12; cur = Math.round(pitch * 2) / 2;
      $('[data-r="pitch"]', view).textContent = `${cur}/12`; $('[data-r="deg"]', view).textContent = `${((avg * 180) / Math.PI).toFixed(1)}° · ${spread < 0.01 ? 'steady' : 'hold still…'}`; const ln = $('[data-r="line"]', view); ln.setAttribute('x2', String(10 + 180 * Math.cos(avg))); ln.setAttribute('y2', String(110 - 180 * Math.sin(avg))); $('[data-a="use"]', view).disabled = !(cur > 0 && cur < 24); };
    window.addEventListener('deviceorientation', onOri, true);
    const done = (v) => { window.removeEventListener('deviceorientation', onOri, true); view.remove(); resolve(v); };
    setTimeout(() => { if (!samples.length) $('[data-r="deg"]', view).textContent = 'No motion sensors here — pick the pitch below.'; }, 2000);
    view.addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (p) return done(Number(p.dataset.p)); const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'x') done(null); if (a === 'use' && cur) done(cur); });
  });
}

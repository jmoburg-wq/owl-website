// WebXR AR scanner (Android Chrome / ARCore): hit-test corner placement + depth-sensing point cloud.
// This is the closest browser analogue to a LiDAR room scan. iOS Safari does not expose WebXR AR; the
// gyro scanner (gyro.js) is used there instead.
import * as THREE from 'three';
import { makeRoom, STD, walls, fmtLen, dist } from '../geometry.js';
import { el, $, $$, toast, icons } from '../ui.js';

export async function isARSupported() {
  try { return !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))); } catch { return false; }
}

export function startARScan({ units = 'imperial', defaults = {} } = {}) {
  return new Promise(async (resolve) => {
    const root = el(`<div class="hud" style="position:fixed;inset:0;z-index:50;color:#fff">
      <div class="hud-top">
        <div class="hud-card" data-role="instr"><b>AR scan · Corners</b><br>Move the phone slowly until the ring sits on the floor. Tap the screen (or TAP) at each floor corner, in order.</div>
        <button class="btn icon glass" data-act="exit">${icons.x}</button>
      </div>
      <div class="hud-bottom">
        <div class="hud-readout"><div class="r"><b data-role="count">0</b><span>corners</span></div><div class="r"><b data-role="pts">0</b><span>3D points</span></div><div class="r"><b data-role="ceil">—</b><span>ceiling</span></div></div>
        <div class="hud-actions"><button class="btn glass sm" data-act="depth">${icons.layers} 3D capture: off</button><button class="shutter" data-act="capture">TAP</button><button class="btn glass sm" data-act="next" disabled>Close room ${icons.chevron}</button></div>
        <div class="row" style="gap:8px"><button class="btn glass xs" data-act="undo">Undo</button><button class="btn glass xs hidden" data-act="ceiling">Capture ceiling</button><button class="btn glass xs hidden" data-act="skip">Skip ceiling</button><button class="btn glass xs hidden" data-act="door">+ Door</button><button class="btn glass xs hidden" data-act="window">+ Window</button><button class="btn glass xs hidden" data-act="finish">Finish</button></div>
      </div></div>`);
    document.body.append(root);
    const R = (r) => $(`[data-role="${r}"]`, root), A = (a) => $(`[data-act="${a}"]`, root);
    // prevent taps on the HUD from firing XR select
    root.addEventListener('beforexrselect', (e) => { if (e.target.closest('button, .hud-card, .hud-readout')) e.preventDefault(); });

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(window.devicePixelRatio); renderer.xr.enabled = true; renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:45'; document.body.append(renderer.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.2));
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4da3ff, side: THREE.DoubleSide })); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })); reticle.add(dot);
    const markers = new THREE.Group(); scene.add(markers);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4da3ff, linewidth: 2 }); let line = null;
    const cloudGeo = new THREE.BufferGeometry(); const MAX = 160000; const cloudPos = new Float32Array(MAX * 3); const cloudCol = new Uint8Array(MAX * 3); let cloudN = 0; const voxels = new Set();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3)); cloudGeo.setAttribute('color', new THREE.BufferAttribute(cloudCol, 3, true)); cloudGeo.setDrawRange(0, 0);
    const cloud = new THREE.Points(cloudGeo, new THREE.PointsMaterial({ size: 0.02, vertexColors: true, sizeAttenuation: true })); scene.add(cloud);

    let session; try {
      session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'depth-sensing', 'light-estimation'], domOverlay: { root }, depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] } });
    } catch (e) { console.warn(e); cleanup(); toast('Could not start AR session: ' + (e.message || e)); return resolve(null); }
    const hasOverlay = !!session.domOverlayState; const depthSupported = !!(session.enabledFeatures && session.enabledFeatures.includes('depth-sensing'));
    if (!depthSupported) { A('depth').disabled = true; A('depth').textContent = '3D capture: unsupported'; }
    if (!hasOverlay) toast('No DOM overlay: tap = corner, long-press = close/finish', 4000);
    renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session);
    const viewerSpace = await session.requestReferenceSpace('viewer'); const hitSource = await session.requestHitTestSource({ space: viewerSpace });

    let stage = 'corners'; const corners = []; let floorY = null; let ceiling = null; let depthOn = false; const openings = []; let pending = []; let oType = 'door'; let reticlePos = null; let selectStart = 0;
    const addMarker = (p, color = 0x30b15a) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), new THREE.MeshBasicMaterial({ color })); m.position.copy(p); markers.add(m); };
    const redrawLine = () => { if (line) { scene.remove(line); line.geometry.dispose(); line = null; } if (corners.length > 1) { const pts = corners.map((c) => new THREE.Vector3(c.x, floorY + 0.005, c.z)); if (corners.length > 2) pts.push(pts[0].clone()); line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat); scene.add(line); } };
    const setStage = (s) => { stage = s; A('next').classList.toggle('hidden', s !== 'corners'); A('ceiling').classList.toggle('hidden', s !== 'ceiling'); A('skip').classList.toggle('hidden', s !== 'ceiling'); ['door', 'window', 'finish'].forEach((k) => A(k).classList.toggle('hidden', s !== 'openings'));
      if (s === 'ceiling') R('instr').innerHTML = '<b>Ceiling height</b><br>Point the ring at the <b>ceiling</b> until it snaps there, then tap <b>Capture ceiling</b>. Or skip to use the default.';
      if (s === 'openings') R('instr').innerHTML = '<b>Doors & windows (optional)</b><br>Tap <b>+ Door</b> / <b>+ Window</b>, then place the ring on the floor at the left edge and tap, then the right edge. Finish when done.'; };
    const capture = () => {
      if (!reticlePos) return toast('Move the phone until the ring finds the floor');
      if (stage === 'corners') { if (floorY === null) floorY = reticlePos.y; if (Math.abs(reticlePos.y - floorY) > 0.35) return toast('That is not on the floor plane'); corners.push({ x: reticlePos.x, z: reticlePos.z }); addMarker(new THREE.Vector3(reticlePos.x, floorY, reticlePos.z), corners.length === 1 ? 0x30b15a : 0xffffff); redrawLine(); R('count').textContent = corners.length; A('next').disabled = corners.length < 3; if (navigator.vibrate) navigator.vibrate(15); }
      else if (stage === 'ceiling') { if (reticlePos.y - floorY < 1.6) return toast('Aim at the ceiling surface'); ceiling = reticlePos.y - floorY; R('ceil').textContent = fmtLen(ceiling, units); toast(`Ceiling ${fmtLen(ceiling, units)}`); setStage('openings'); }
      else if (stage === 'openings') { if (!pending.type) return toast('Tap + Door or + Window first'); pending.push({ x: reticlePos.x, z: reticlePos.z }); addMarker(new THREE.Vector3(reticlePos.x, floorY, reticlePos.z), 0xff9f0a); if (pending.length === 2) { openings.push({ type: oType, p1: pending[0], p2: pending[1] }); toast(`${oType} ${fmtLen(dist(pending[0], pending[1]), units)} added`); pending = []; } }
    };
    const finish = async () => {
      await cleanup(); if (corners.length < 3) return resolve(null);
      const room = makeRoom({ name: 'AR scanned room', corners, ceilingHeight: ceiling || defaults.ceilingHeight || 2.4384, wallThickness: defaults.wallThickness, source: 'webxr' }); if (!ceiling) room.ceilingAssumed = true;
      const dx = -Math.min(...corners.map((p) => p.x)), dz = -Math.min(...corners.map((p) => p.z)); const ws = walls(room);
      for (const o of openings) { const p1 = { x: o.p1.x + dx, z: o.p1.z + dz }, p2 = { x: o.p2.x + dx, z: o.p2.z + dz }; const mid = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 }; let best = null, bd = Infinity; ws.forEach((w) => { const ux = (w.b.x - w.a.x) / w.length, uz = (w.b.z - w.a.z) / w.length; const t = Math.max(0, Math.min(w.length, (mid.x - w.a.x) * ux + (mid.z - w.a.z) * uz)); const d = Math.hypot(mid.x - (w.a.x + ux * t), mid.z - (w.a.z + uz * t)); if (d < bd) { bd = d; best = { w, ux, uz }; } }); if (!best || bd > 0.9) continue; const t1 = (p1.x - best.w.a.x) * best.ux + (p1.z - best.w.a.z) * best.uz, t2 = (p2.x - best.w.a.x) * best.ux + (p2.z - best.w.a.z) * best.uz; const width = Math.max(0.4, Math.abs(t2 - t1)); const offset = Math.max(0, Math.min(best.w.length - width, Math.min(t1, t2))); room.openings.push(o.type === 'door' ? { id: Math.random().toString(36).slice(2, 8), type: 'door', wall: best.w.index, offset, width, height: Math.min(STD.doorH, room.ceilingHeight - 0.1), sill: 0 } : { id: Math.random().toString(36).slice(2, 8), type: 'window', wall: best.w.index, offset, width, height: STD.windowH, sill: STD.windowSill }); }
      let cloudOut = null; if (cloudN > 0) { const pos = new Float32Array(cloudN * 3), col = new Uint8Array(cloudN * 3); for (let i = 0; i < cloudN; i++) { pos[i * 3] = cloudPos[i * 3] + dx; pos[i * 3 + 1] = cloudPos[i * 3 + 1] - floorY; pos[i * 3 + 2] = cloudPos[i * 3 + 2] + dz; col[i * 3] = cloudCol[i * 3]; col[i * 3 + 1] = cloudCol[i * 3 + 1]; col[i * 3 + 2] = cloudCol[i * 3 + 2]; } cloudOut = { positions: pos, colors: col }; room.cloudCount = cloudN; }
      resolve({ room, cloud: cloudOut });
    };
    async function cleanup() { try { renderer.setAnimationLoop(null); if (session && !session.ended) await session.end().catch(() => {}); } catch {} renderer.dispose(); renderer.domElement.remove(); root.remove(); }
    session.addEventListener('end', () => { root.remove(); renderer.domElement.remove(); });
    session.addEventListener('selectstart', () => { selectStart = performance.now(); });
    session.addEventListener('selectend', () => { const held = performance.now() - selectStart; if (!hasOverlay && held > 1200) { if (stage === 'corners' && corners.length >= 3) setStage('ceiling'); else if (stage === 'ceiling') setStage('openings'); else finish(); return; } capture(); });

    // depth sampling
    const projInv = new THREE.Matrix4(), viewToWorld = new THREE.Matrix4(), v4 = new THREE.Vector4(), v3 = new THREE.Vector3();
    const sampleDepth = (depth, view) => {
      projInv.fromArray(view.projectionMatrix).invert(); viewToWorld.fromArray(view.transform.matrix); const NX = 20, NY = 28; let added = 0;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const u = (i + 0.5) / NX, vv = (j + 0.5) / NY; let d; try { d = depth.getDepthInMeters(u, vv); } catch { return; } if (!(d > 0.25 && d < 7)) continue;
        v4.set(2 * u - 1, 1 - 2 * vv, 0.5, 1).applyMatrix4(projInv); v3.set(v4.x / v4.w, v4.y / v4.w, v4.z / v4.w).normalize(); if (v3.z >= -1e-4) continue; v3.multiplyScalar(d / -v3.z); v3.applyMatrix4(viewToWorld);
        const key = `${Math.round(v3.x / 0.03)},${Math.round(v3.y / 0.03)},${Math.round(v3.z / 0.03)}`; if (voxels.has(key) || cloudN >= MAX) continue; voxels.add(key);
        const fy = floorY === null ? v3.y : floorY; const t = Math.max(0, Math.min(1, (v3.y - fy) / 2.6)); cloudPos[cloudN * 3] = v3.x; cloudPos[cloudN * 3 + 1] = v3.y; cloudPos[cloudN * 3 + 2] = v3.z; cloudCol[cloudN * 3] = Math.round(70 + 185 * t); cloudCol[cloudN * 3 + 1] = Math.round(130 + 50 * t); cloudCol[cloudN * 3 + 2] = Math.round(255 - 175 * t); cloudN++; added++;
      }
      if (added) { cloudGeo.attributes.position.needsUpdate = true; cloudGeo.attributes.color.needsUpdate = true; cloudGeo.setDrawRange(0, cloudN); R('pts').textContent = cloudN.toLocaleString(); }
    };
    renderer.setAnimationLoop((t, frame) => {
      if (frame) {
        const ref = renderer.xr.getReferenceSpace(); const hits = frame.getHitTestResults(hitSource);
        if (hits.length) { const pose = hits[0].getPose(ref); reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix); reticlePos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix); reticle.material.color.set(stage === 'ceiling' ? 0xff9f0a : 0x4da3ff); } else { reticle.visible = false; reticlePos = null; }
        if (depthOn && depthSupported) { const pose = frame.getViewerPose(ref); if (pose) for (const view of pose.views) { let info = null; try { info = frame.getDepthInformation(view); } catch {} if (info) sampleDepth(info, view); } }
      }
      renderer.render(scene, camera);
    });
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'exit') { cleanup().then(() => resolve(null)); }
      if (act === 'capture') capture();
      if (act === 'undo') { if (stage === 'corners' && corners.length) { corners.pop(); markers.remove(markers.children[markers.children.length - 1]); redrawLine(); R('count').textContent = corners.length; A('next').disabled = corners.length < 3; } else if (stage === 'openings') { if (pending.length) { pending.forEach(() => markers.remove(markers.children[markers.children.length - 1])); pending = []; } else openings.pop(); } }
      if (act === 'depth') { depthOn = !depthOn; A('depth').innerHTML = `${icons.layers} 3D capture: ${depthOn ? 'on' : 'off'}`; if (depthOn) toast('Sweep the phone slowly over walls, floor and ceiling'); }
      if (act === 'next') { if (corners.length >= 3) setStage('ceiling'); }
      if (act === 'ceiling') capture();
      if (act === 'skip') { ceiling = null; setStage('openings'); }
      if (act === 'door' || act === 'window') { oType = act; pending = []; pending.type = act; R('instr').innerHTML = `<b>${act === 'door' ? 'Door' : 'Window'}</b><br>Place the ring on the floor at the <b>left edge</b>, tap; then the <b>right edge</b>, tap.`; }
      if (act === 'finish') finish();
    });
  });
}

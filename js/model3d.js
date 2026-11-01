// Three.js room model: floor, walls with openings, ceiling, labels, point cloud, exports
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import { walls, bounds, centroid, outwardNormal, fmtLen, metrics, roofMetrics, flatMetrics, kindOf } from './geometry.js';

export const FLOOR_MATERIALS = {
  existing: { label: 'Existing', color: 0xb9b2a6, roughness: 0.95 },
  lvp: { label: 'LVP', color: 0x9b7853, roughness: 0.55, pattern: 'plank' },
  laminate: { label: 'Laminate', color: 0xb08c66, roughness: 0.5, pattern: 'plank' },
  hardwood: { label: 'Hardwood', color: 0x8a5a2b, roughness: 0.45, pattern: 'plank' },
  tile: { label: 'Tile', color: 0xd8d3cb, roughness: 0.35, pattern: 'tile' },
  carpet: { label: 'Carpet', color: 0x8f919c, roughness: 1.0 },
  concrete: { label: 'Concrete', color: 0x9a9a9a, roughness: 0.9 },
};
export const WALL_COLORS = ['#f4f1ea', '#e8e4d8', '#d9e4ec', '#cfd8c3', '#e9d5c3', '#bfc7d1', '#9fb3c8', '#7f8c8d', '#f1e0a8', '#d6c6e1'];

function patternTexture(kind, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
  if (kind === 'plank') { const h = 64; for (let y = 0; y < 512; y += h) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); const off = ((y / h) % 2) * 170; for (let x = off; x < 512; x += 340) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); } g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; g.fillRect(0, y, 512, h); } }
  else if (kind === 'tile') { const s = 128; g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 4; for (let i = 0; i <= 512; i += s) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

function labelSprite(text, { scale = 0.5, bg = 'rgba(20,22,30,0.82)' } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d'); const font = 'bold 44px -apple-system, Inter, Helvetica, Arial, sans-serif';
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 40; c.width = w; c.height = 72; g.font = font;
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, 72, 20); g.fill(); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, 36);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set((w / 72) * scale, scale, 1); sp.renderOrder = 10; return sp;
}

export class RoomViewer {
  constructor(container, { units = 'imperial' } = {}) {
    this.container = container; this.units = units;
    this.opts = { ceiling: false, transparentWalls: false, labels: true, floorMaterial: 'existing', wallColor: '#f4f1ea', cloud: true, grid: true };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x161b27, 1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x161b27, 30, 80);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200); this.camera.position.set(6, 5, 7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.maxPolarAngle = Math.PI * 0.95; this.controls.minDistance = 0.3; this.controls.maxDistance = 60;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404860, 1.1); this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(5, 10, 4); this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xbfd4ff, 0.5); dir2.position.set(-6, 6, -5); this.scene.add(dir2);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.room = null; this.cloud = null; this._raf = 0; this._alive = true;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
    const loop = () => { if (!this._alive) return; this._raf = requestAnimationFrame(loop); if (document.hidden || !container.isConnected) return; this.controls.update(); this.renderer.render(this.scene, this.camera); };
    loop();
  }
  resize() { const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setUnits(u) { this.units = u; if (this.room) this.setRoom(this.room, this.cloud); }
  setOptions(o) { Object.assign(this.opts, o); if (this.room) this.setRoom(this.room, this.cloud, { keepCamera: true }); }

  clear() { this.group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { const ms = Array.isArray(obj.material) ? obj.material : [obj.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); this.group.clear(); }

  setRoom(room, cloud = null, { keepCamera = false } = {}) {
    const kind = kindOf(room); this._topY = 0;
    if (kind === 'roof' && room.corners && room.corners.length > 2) return this._roof(room, keepCamera);
    if (kind === 'flat' && room.corners && room.corners.length > 2) return this._flat(room, keepCamera);
    this.room = room; this.cloud = cloud; this.clear();
    if (!room || !room.corners || room.corners.length < 3) return;
    const c = room.corners, H = room.ceilingHeight || 2.4384, t = room.wallThickness || 0.1143; const b = bounds(c); const cen = centroid(c);
    // floor
    const shape = new THREE.Shape(c.map((p) => new THREE.Vector2(p.x, p.z)));
    const fm = FLOOR_MATERIALS[this.opts.floorMaterial] || FLOOR_MATERIALS.existing;
    const floorMat = new THREE.MeshStandardMaterial({ color: fm.pattern ? 0xffffff : fm.color, roughness: fm.roughness, metalness: 0.02, side: THREE.DoubleSide });
    if (fm.pattern) { const tex = patternTexture(fm.pattern, fm.color); tex.repeat.set(1 / (fm.pattern === 'tile' ? 1.2 : 1.5), 1 / (fm.pattern === 'tile' ? 1.2 : 1.5)); floorMat.map = tex; }
    const floorGeo = new THREE.ShapeGeometry(shape); floorGeo.rotateX(Math.PI / 2);
    // fix UVs to meters so pattern repeats are physical
    const uv = floorGeo.attributes.uv; const pos = floorGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const floor = new THREE.Mesh(floorGeo, floorMat); floor.name = 'floor'; floor.position.y = 0.001; this.group.add(floor);
    // slab edge (thin dark skirt under the floor so plan view reads as a solid)
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.9 });
    const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), slabMat); slab.rotateX(Math.PI / 2); slab.position.y = 0; this.group.add(slab);
    // walls
    const wallColor = new THREE.Color(this.opts.wallColor || '#f4f1ea');
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, transparent: this.opts.transparentWalls, opacity: this.opts.transparentWalls ? 0.35 : 1, depthWrite: !this.opts.transparentWalls });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8b6a4a, roughness: 0.6, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
    const ws = walls(room);
    ws.forEach((w, i) => {
      const L = w.length; if (L < 0.02) return;
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, H); s.lineTo(0, H); s.closePath();
      for (const o of w.openings) { const x0 = Math.max(0.01, o.offset), x1 = Math.min(L - 0.01, o.offset + o.width), y0 = Math.max(0, o.sill || 0), y1 = Math.min(H - 0.01, (o.sill || 0) + o.height); if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue; const hole = new THREE.Path(); hole.moveTo(x0, y0); hole.lineTo(x1, y0); hole.lineTo(x1, y1); hole.lineTo(x0, y1); hole.closePath(); s.holes.push(hole); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
      const mesh = new THREE.Mesh(geo, wallMat); mesh.name = `wall-${i}`;
      const dx = (w.b.x - w.a.x) / L, dz = (w.b.z - w.a.z) / L; const phi = Math.atan2(-dz, dx);
      mesh.rotation.y = phi; // local +X → wall direction; local +Z → (-dz, dx)
      const nl = { x: -dz, z: dx }; const out = outwardNormal(c, i); const inwardExtrude = nl.x * out.x + nl.z * out.z < 0;
      mesh.position.set(w.a.x + (inwardExtrude ? -nl.x * t : 0), 0, w.a.z + (inwardExtrude ? -nl.z * t : 0));
      this.group.add(mesh);
      // door slabs / window glass + frames, centered in the wall thickness
      const ox = out.x, oz = out.z;
      for (const o of w.openings) {
        const cx = w.a.x + dx * (o.offset + o.width / 2), cz = w.a.z + dz * (o.offset + o.width / 2);
        const midx = cx + ox * (t / 2), midz = cz + oz * (t / 2);
        if (o.type === 'door') { const slab = new THREE.Mesh(new THREE.BoxGeometry(o.width - 0.04, o.height - 0.02, 0.04), doorMat); slab.position.set(midx, (o.height) / 2, midz); slab.rotation.y = phi; this.group.add(slab); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), frameMat); knob.position.set(midx + dx * (o.width / 2 - 0.08) + ox * 0.03, 1.0, midz + dz * (o.width / 2 - 0.08) + oz * 0.03); this.group.add(knob); }
        else { const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.width - 0.06, o.height - 0.06), glassMat); glass.position.set(midx, (o.sill || 0) + o.height / 2, midz); glass.rotation.y = phi; this.group.add(glass); const fr = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.04, t + 0.02), frameMat); fr.position.set(midx, (o.sill || 0) + 0.02, midz); fr.rotation.y = phi; this.group.add(fr); }
      }
      if (this.opts.labels) { const mx = (w.a.x + w.b.x) / 2 + out.x * 0.25, mz = (w.a.z + w.b.z) / 2 + out.z * 0.25; const sp = labelSprite(fmtLen(L, this.units), { scale: 0.32 }); sp.position.set(mx, H + 0.18, mz); this.group.add(sp); }
    });
    // ceiling
    if (this.opts.ceiling) { const cg = new THREE.ShapeGeometry(shape); cg.rotateX(Math.PI / 2); const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xf8f8f8, side: THREE.DoubleSide, transparent: true, opacity: 0.45, roughness: 1 })); cm.position.y = H; this.group.add(cm); }
    // area label
    if (this.opts.labels && !room._noAreaLabel) { const m = metrics(room); const sp = labelSprite(`${room.name || 'Room'} · ${this.units === 'metric' ? m.floorArea.toFixed(1) + ' m²' : Math.round(m.floorArea / 0.09290304) + ' sf'}`, { scale: 0.36, bg: 'rgba(31,111,235,0.9)' }); sp.position.set(cen.x, 0.35, cen.z); this.group.add(sp); }
    // grid
    if (this.opts.grid) { const size = Math.ceil(Math.max(b.w, b.d) * 2.5 + 4); const grid = new THREE.GridHelper(size, Math.round(size / (this.units === 'metric' ? 0.5 : 0.3048)), 0x3b4255, 0x272d3b); grid.position.set(cen.x, -0.08, cen.z); this.group.add(grid); }
    // point cloud
    if (cloud && cloud.positions && cloud.positions.length >= 3 && this.opts.cloud) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(cloud.positions, 3)); if (cloud.colors && cloud.colors.length === cloud.positions.length) g.setAttribute('color', new THREE.BufferAttribute(cloud.colors, 3, true)); const pm = new THREE.PointsMaterial({ size: 0.025, vertexColors: !!cloud.colors, color: cloud.colors ? 0xffffff : 0x7fd3ff, sizeAttenuation: true }); const pts = new THREE.Points(g, pm); pts.name = 'cloud'; this.group.add(pts); }
    if (!keepCamera) this.fitCamera();
  }
  _tri(pts, mat) { const g = new THREE.BufferGeometry(); const arr = []; for (const p of pts) arr.push(p.x, p.y, p.z); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); this.group.add(m); return m; }
  _roof(room, keepCamera) {
    const m = roofMetrics(room); const wallH = 2.6 * m.stories; const stories = { ...room, kind: 'exterior', ceilingHeight: wallH, openings: [], _noAreaLabel: true };
    this.setRoom(stories, null, { keepCamera: true }); this.room = room;
    const b = bounds(room.corners); const o = m.overhang; const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const alongX = b.w >= b.d; const x0 = b.minX - o, x1 = b.maxX + o, z0 = b.minZ - o, z1 = b.maxZ + o; const span = alongX ? b.d : b.w; const rise = (span / 2 + o) * m.pitch / 12; const R = wallH + rise; const eaveY = wallH - o * m.pitch / 12;
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: 0.9, side: THREE.DoubleSide }); const gmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.opts.wallColor || '#f4f1ea'), roughness: 0.85, side: THREE.DoubleSide });
    const tri = (a, b2, c) => this._tri([a, b2, c], mat); const quad = (a, b2, c, d) => { tri(a, b2, c); tri(a, c, d); };
    if (alongX) { const zc = (b.minZ + b.maxZ) / 2;
      if (m.style === 'hip') { const hx0 = x0 + (span / 2 + o), hx1 = Math.max(hx0, x1 - (span / 2 + o)); quad(V(x0, eaveY, z0), V(x1, eaveY, z0), V(hx1, R, zc), V(hx0, R, zc)); quad(V(x1, eaveY, z1), V(x0, eaveY, z1), V(hx0, R, zc), V(hx1, R, zc)); tri(V(x0, eaveY, z1), V(x0, eaveY, z0), V(hx0, R, zc)); tri(V(x1, eaveY, z0), V(x1, eaveY, z1), V(hx1, R, zc)); }
      else { quad(V(x0, eaveY, z0), V(x1, eaveY, z0), V(x1, R, zc), V(x0, R, zc)); quad(V(x1, eaveY, z1), V(x0, eaveY, z1), V(x0, R, zc), V(x1, R, zc)); for (const x of [b.minX, b.maxX]) this._tri([V(x, wallH, b.minZ), V(x, wallH, b.maxZ), V(x, wallH + span / 2 * m.pitch / 12, zc)], gmat); } }
    else { const xc = (b.minX + b.maxX) / 2;
      if (m.style === 'hip') { const hz0 = z0 + (span / 2 + o), hz1 = Math.max(hz0, z1 - (span / 2 + o)); quad(V(x0, eaveY, z1), V(x0, eaveY, z0), V(xc, R, hz0), V(xc, R, hz1)); quad(V(x1, eaveY, z0), V(x1, eaveY, z1), V(xc, R, hz1), V(xc, R, hz0)); tri(V(x0, eaveY, z0), V(x1, eaveY, z0), V(xc, R, hz0)); tri(V(x1, eaveY, z1), V(x0, eaveY, z1), V(xc, R, hz1)); }
      else { quad(V(x0, eaveY, z1), V(x0, eaveY, z0), V(xc, R, z0), V(xc, R, z1)); quad(V(x1, eaveY, z0), V(x1, eaveY, z1), V(xc, R, z1), V(xc, R, z0)); for (const z of [b.minZ, b.maxZ]) this._tri([V(b.minX, wallH, z), V(b.maxX, wallH, z), V(xc, wallH + span / 2 * m.pitch / 12, z)], gmat); } }
    this._topY = R;
    if (this.opts.labels) { const sp = labelSprite(`${room.name} · ${m.squares.toFixed(1)} sq · ${m.pitch}/12`, { scale: 0.42, bg: 'rgba(31,111,235,0.9)' }); const cen = centroid(room.corners); sp.position.set(cen.x, R + 0.8, cen.z); this.group.add(sp); }
    if (!keepCamera) this.fitCamera();
  }
  _flat(room, keepCamera) {
    this.room = room; this.cloud = null; this.clear(); const m = flatMetrics(room); const c = room.corners; const shape = new THREE.Shape(c.map((p) => new THREE.Vector2(p.x, p.z)));
    const deck = m.use === 'deck'; const elev = deck ? Math.max(0.15, m.heightFt * 0.3048) : 0.02; const thick = deck ? 0.04 : Math.max(0.05, (m.thicknessIn * 0.0254));
    const fm = deck ? FLOOR_MATERIALS.hardwood : m.use === 'patio' ? FLOOR_MATERIALS.tile : FLOOR_MATERIALS.concrete;
    const mat = new THREE.MeshStandardMaterial({ color: fm.pattern ? 0xffffff : (m.use === 'driveway' || m.use === 'parking lot' ? 0x2e3138 : fm.color), roughness: fm.roughness, side: THREE.DoubleSide }); if (fm.pattern) { const tex = patternTexture(fm.pattern, fm.color); tex.repeat.set(0.7, 0.7); mat.map = tex; }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const uv = geo.attributes.uv; const pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    const slab = new THREE.Mesh(geo, mat); slab.position.y = elev; this.group.add(slab);
    if (deck) { const pm = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 }); const b = bounds(c); const nx = Math.max(2, Math.ceil(b.w / 2.4) + 1), nz = Math.max(2, Math.ceil(b.d / 2.4) + 1); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const px = b.minX + (b.w * i) / (nx - 1), pz = b.minZ + (b.d * j) / (nz - 1); const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, elev, 0.14), pm); post.position.set(px, elev / 2, pz); this.group.add(post); }
      const rail = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6 }); for (let i = 0; i < c.length; i++) { const a = c[i], d = c[(i + 1) % c.length]; const L2 = Math.hypot(d.x - a.x, d.z - a.z); const r = new THREE.Mesh(new THREE.BoxGeometry(L2, 0.06, 0.06), rail); r.position.set((a.x + d.x) / 2, elev + 0.95, (a.z + d.z) / 2); r.rotation.y = -Math.atan2(d.z - a.z, d.x - a.x); this.group.add(r); } }
    this._topY = elev + 1;
    if (this.opts.labels) { const cen = centroid(c); const sp = labelSprite(`${room.name} · ${Math.round(m.area / 0.09290304)} sf`, { scale: 0.38, bg: 'rgba(31,111,235,0.9)' }); sp.position.set(cen.x, elev + 0.6, cen.z); this.group.add(sp); }
    if (this.opts.grid) { const b = bounds(c); const size = Math.ceil(Math.max(b.w, b.d) * 2.5 + 4); const grid = new THREE.GridHelper(size, Math.round(size / 0.3048), 0x3b4255, 0x272d3b); const cen = centroid(c); grid.position.set(cen.x, -0.01, cen.z); this.group.add(grid); }
    if (!keepCamera) this.fitCamera();
  }
  fitCamera() { const b = bounds(this.room.corners); const cen = centroid(this.room.corners); const H = Math.max(this.room.ceilingHeight || 2.4, this._topY || 0); const d = Math.max(b.w, b.d, H) * 1.45 + 1.5; this.controls.target.set(cen.x, H * 0.35, cen.z); this.camera.position.set(cen.x + d * 0.75, H + d * 0.7, cen.z + d * 0.8); this.controls.update(); }
  topView() { const b = bounds(this.room.corners); const cen = centroid(this.room.corners); const d = Math.max(b.w, b.d) * 1.25 + 1; this.controls.target.set(cen.x, 0, cen.z); this.camera.position.set(cen.x, d, cen.z + 0.001); this.controls.update(); }
  insideView() { const cen = centroid(this.room.corners); const b = bounds(this.room.corners); this.camera.position.set(cen.x - b.w * 0.3, 1.6, cen.z + b.d * 0.3); this.controls.target.set(cen.x + 0.3, 1.45, cen.z - 0.3); this.controls.update(); }
  snapshot() { this.controls.update(); this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/jpeg', 0.85); }
  exportable() { const g = new THREE.Group(); this.group.children.forEach((o) => { if (o.isMesh && o.name !== 'cloud' && !o.isSprite) g.add(o.clone()); }); return g; }
  async exportGLB() { const exp = new GLTFExporter(); return new Promise((res, rej) => exp.parse(this.exportable(), (r) => res(r), rej, { binary: true })); }
  exportOBJ() { return new OBJExporter().parse(this.exportable()); }
  exportSTL() { return new STLExporter().parse(this.exportable(), { binary: true }); }
  exportPLY() { const pts = this.group.getObjectByName('cloud'); if (!pts) return null; return new PLYExporter().parse(pts, null, { binary: true, excludeAttributes: ['normal', 'uv'] }); }
  dispose() { this._alive = false; cancelAnimationFrame(this._raf); this.ro.disconnect(); this.clear(); this.controls.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

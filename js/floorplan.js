// 2D floor plan (SVG) with dimensions, doors, windows, area block
import { walls, bounds, metrics, centroid, outwardNormal, fmtLen, fmtArea, fmtLF, kindOf, roofMetrics, flatMetrics, linearMetrics } from './geometry.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function floorPlanSVG(room, { units = 'imperial', width = 800, padding = 84, title = true, compact = false } = {}) {
  const kind = kindOf(room);
  if (kind === 'linear') { const m = linearMetrics(room); const posts = Math.ceil((m.length / 0.3048) / 8) + 1 + m.turns; const n = Math.min(posts, 40); const x0 = 60, x1 = width - 60, y = 90; let dots = ''; for (let i = 0; i < n; i++) dots += `<rect x="${(x0 + ((x1 - x0) * i) / Math.max(1, n - 1) - 4).toFixed(1)}" y="${y - 10}" width="8" height="20" fill="#1b1b1f"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 180" width="${width}" height="180"><rect width="${width}" height="180" fill="#fff"/><line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#1f6feb" stroke-width="6"/>${dots}<text x="${width / 2}" y="${y + 44}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="16" font-weight="700" text-anchor="middle">${esc(room.name)} · ${esc(fmtLF(m.length, units))}</text><text x="${width / 2}" y="${y + 66}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="12" fill="#4b5060" text-anchor="middle">${esc(m.use)} · ~${posts} posts at 8 ft · ${m.turns} corner${m.turns === 1 ? '' : 's'} · ${m.gates} gate${m.gates === 1 ? '' : 's'} · ${m.heightFt} ft high</text></svg>`; }
  const c = room.corners || []; if (c.length < 3) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 200"><text x="20" y="100" font-family="sans-serif" fill="#888">No room geometry</text></svg>`;
  const b = bounds(c); const m = metrics(room);
  const scale = (width - padding * 2) / Math.max(b.w, b.d, 0.1);
  const planH = b.d * scale; const blockH = title && !compact ? 74 : 0; const height = planH + padding * 2 + blockH;
  const X = (x) => padding + (x - b.minX) * scale, Y = (z) => padding + (z - b.minZ) * scale;
  const t = (room.wallThickness || 0.1143) * scale;
  const ws = walls(room); const cen = centroid(c);
  const parts = [];
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  // grid (1 ft or 0.5 m)
  const step = (units === 'metric' ? 0.5 : 0.3048) * scale;
  if (step > 8) { let g = ''; for (let x = X(b.minX); x <= X(b.maxX) + 0.1; x += step) g += `M${x.toFixed(1)} ${Y(b.minZ)}V${Y(b.maxZ)}`; for (let y = Y(b.minZ); y <= Y(b.maxZ) + 0.1; y += step) g += `M${X(b.minX)} ${y.toFixed(1)}H${X(b.maxX)}`; parts.push(`<path d="${g}" stroke="#eef0f4" stroke-width="1"/>`); }
  // floor fill
  const poly = c.map((p) => `${X(p.x).toFixed(1)},${Y(p.z).toFixed(1)}`).join(' ');
  parts.push(`<polygon points="${poly}" fill="#f7f8fb" stroke="#1b1b1f" stroke-width="${Math.max(3, t).toFixed(1)}" stroke-linejoin="miter"/>`);
  // openings + dimension lines
  let di = 1, wi = 1; const labels = [];
  ws.forEach((w, i) => {
    const ux = (w.b.x - w.a.x) / w.length, uz = (w.b.z - w.a.z) / w.length; const n = outwardNormal(c, i);
    for (const o of w.openings) {
      const sx = w.a.x + ux * o.offset, sz = w.a.z + uz * o.offset, ex = sx + ux * o.width, ez = sz + uz * o.width;
      const gapW = Math.max(3, t) + 1.5;
      parts.push(`<line x1="${X(sx)}" y1="${Y(sz)}" x2="${X(ex)}" y2="${Y(ez)}" stroke="#ffffff" stroke-width="${gapW.toFixed(1)}"/>`);
      if (o.type === 'door') {
        const r = o.width * scale; const ang = (Math.atan2(-n.z, -n.x) * 180) / Math.PI; // inward direction
        const inX = -n.x, inZ = -n.z; const px = X(sx), py = Y(sz);
        const ax = px + inX * r, ay = py + inZ * r; const bx = X(ex), by = Y(ez);
        parts.push(`<line x1="${px}" y1="${py}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="#1b1b1f" stroke-width="2"/>`);
        const sweep = ((ux * inZ - uz * inX) > 0) ? 0 : 1;
        parts.push(`<path d="M${ax.toFixed(1)} ${ay.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${bx.toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="#6b6f7a" stroke-width="1.2" stroke-dasharray="4 3"/>`);
        labels.push({ x: X((sx + ex) / 2) - n.x * 14, y: Y((sz + ez) / 2) - n.z * 14, text: `D${di++} ${fmtLen(o.width, units)}`, size: 10 });
      } else {
        const off = Math.max(3, t) / 2; const nxp = n.x * off, nzp = n.z * off;
        parts.push(`<line x1="${X(sx)}" y1="${Y(sz)}" x2="${X(ex)}" y2="${Y(ez)}" stroke="#1b1b1f" stroke-width="1.2"/>`);
        parts.push(`<line x1="${(X(sx) + nxp).toFixed(1)}" y1="${(Y(sz) + nzp).toFixed(1)}" x2="${(X(ex) + nxp).toFixed(1)}" y2="${(Y(ez) + nzp).toFixed(1)}" stroke="#1b1b1f" stroke-width="1.2"/>`);
        parts.push(`<line x1="${(X(sx) - nxp).toFixed(1)}" y1="${(Y(sz) - nzp).toFixed(1)}" x2="${(X(ex) - nxp).toFixed(1)}" y2="${(Y(ez) - nzp).toFixed(1)}" stroke="#1b1b1f" stroke-width="1.2"/>`);
        labels.push({ x: X((sx + ex) / 2) - n.x * 14, y: Y((sz + ez) / 2) - n.z * 14, text: `W${wi++} ${fmtLen(o.width, units)}×${fmtLen(o.height, units)}`, size: 10 });
      }
    }
    // dimension line
    const off = 30 + t / 2; const ax = X(w.a.x) + n.x * off, ay = Y(w.a.z) + n.z * off, bx = X(w.b.x) + n.x * off, by = Y(w.b.z) + n.z * off;
    parts.push(`<line x1="${X(w.a.x) + n.x * (t / 2 + 4)}" y1="${Y(w.a.z) + n.z * (t / 2 + 4)}" x2="${ax}" y2="${ay}" stroke="#9aa0ad" stroke-width="1"/>`);
    parts.push(`<line x1="${X(w.b.x) + n.x * (t / 2 + 4)}" y1="${Y(w.b.z) + n.z * (t / 2 + 4)}" x2="${bx}" y2="${by}" stroke="#9aa0ad" stroke-width="1"/>`);
    parts.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#4b5060" stroke-width="1.2" marker-start="url(#tick)" marker-end="url(#tick)"/>`);
    let deg = (w.angle * 180) / Math.PI; if (deg > 90 || deg < -90) deg += 180;
    const mx = (ax + bx) / 2 + n.x * 12, my = (ay + by) / 2 + n.z * 12;
    labels.push({ x: mx, y: my, text: fmtLen(w.length, units), rot: deg, size: 12, weight: 600 });
  });
  parts.unshift(`<defs><marker id="tick" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M3 0V6" stroke="#4b5060" stroke-width="1.2"/></marker></defs>`);
  for (const l of labels) parts.push(`<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="${l.size}" font-weight="${l.weight || 500}" fill="#1b1b1f" text-anchor="middle" dominant-baseline="middle" ${l.rot ? `transform="rotate(${l.rot.toFixed(1)} ${l.x.toFixed(1)} ${l.y.toFixed(1)})"` : ''}>${esc(l.text)}</text>`);
  // room label
  const cx = X(cen.x), cy = Y(cen.z);
  parts.push(`<text x="${cx}" y="${cy - 10}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="16" font-weight="700" fill="#1b1b1f" text-anchor="middle">${esc(room.name || 'Room')}</text>`);
  const sub = kind === 'roof' ? (() => { const r = roofMetrics(room); return `${r.squares.toFixed(1)} squares · ${r.pitch}/12 ${r.style} · ${fmtLen(r.overhang, units)} overhang`; })() : kind === 'flat' ? (() => { const f = flatMetrics(room); return `${fmtArea(f.area, units)} · ${f.use}`; })() : kind === 'exterior' ? `Exterior walls · ${fmtArea(m.wallAreaNet, units)} net · ${fmtLen(m.H, units)} high` : `${fmtArea(m.floorArea, units)} · ceiling ${fmtLen(m.H, units)}`;
  if (kind === 'roof') { const r = roofMetrics(room); const alongX = b.w >= b.d; const o = r.overhang * scale; const style = 'stroke="#1f6feb" stroke-width="2" stroke-dasharray="8 5" fill="none"';
    parts.push(`<rect x="${(X(b.minX) - o).toFixed(1)}" y="${(Y(b.minZ) - o).toFixed(1)}" width="${(b.w * scale + 2 * o).toFixed(1)}" height="${(b.d * scale + 2 * o).toFixed(1)}" stroke="#9aa0ad" stroke-width="1" stroke-dasharray="3 4" fill="none"/>`);
    if (r.style === 'hip') { const h2 = (Math.min(b.w, b.d) / 2) * scale; if (alongX) { const yc = Y((b.minZ + b.maxZ) / 2); const a = X(b.minX) + h2, z = X(b.maxX) - h2; parts.push(`<path d="M${X(b.minX)} ${Y(b.minZ)}L${a} ${yc}L${X(b.minX)} ${Y(b.maxZ)}M${X(b.maxX)} ${Y(b.minZ)}L${z} ${yc}L${X(b.maxX)} ${Y(b.maxZ)}M${a} ${yc}L${z} ${yc}" ${style}/>`); } else { const xc = X((b.minX + b.maxX) / 2); const a = Y(b.minZ) + h2, z = Y(b.maxZ) - h2; parts.push(`<path d="M${X(b.minX)} ${Y(b.minZ)}L${xc} ${a}L${X(b.maxX)} ${Y(b.minZ)}M${X(b.minX)} ${Y(b.maxZ)}L${xc} ${z}L${X(b.maxX)} ${Y(b.maxZ)}M${xc} ${a}L${xc} ${z}" ${style}/>`); } }
    else if (alongX) { const yc = Y((b.minZ + b.maxZ) / 2); parts.push(`<line x1="${X(b.minX) - o}" y1="${yc}" x2="${X(b.maxX) + o}" y2="${yc}" ${style}/>`); } else { const xc = X((b.minX + b.maxX) / 2); parts.push(`<line x1="${xc}" y1="${Y(b.minZ) - o}" x2="${xc}" y2="${Y(b.maxZ) + o}" ${style}/>`); } }
  parts.push(`<text x="${cx}" y="${cy + 10}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="12" fill="#4b5060" text-anchor="middle">${esc(sub)}</text>`);
  if (title && !compact) {
    const y0 = height - blockH + 8;
    parts.push(`<line x1="${padding / 2}" y1="${y0}" x2="${width - padding / 2}" y2="${y0}" stroke="#d6d9e0"/>`);
    const rows = kind === 'roof' ? (() => { const r = roofMetrics(room); return [[`Roof ${Math.round(r.roofArea / 0.09290304)} sf (${r.squares.toFixed(1)} sq)`, `Eaves ${fmtLF(r.eave, units)}`, `Rakes ${fmtLF(r.rake, units)}`], [`Ridge ${fmtLF(r.ridge, units)}`, `Hips ${fmtLF(r.hip, units)}`, `Valleys ${fmtLF(r.valley, units)}`]]; })() : kind === 'flat' ? (() => { const f = flatMetrics(room); return [[`Area ${fmtArea(f.area, units)}`, `Perimeter ${fmtLF(f.perimeter, units)}`, `Use ${f.use}`], [`Thickness ${f.thicknessIn}"`, `Height ${f.heightFt} ft`, `Against house ${f.attachedLf} ft`]]; })() : [[`${kind === 'exterior' ? 'Footprint' : 'Floor'} ${fmtArea(m.floorArea, units)}`, `Perimeter ${fmtLF(m.perimeter, units)}`, `Walls (net) ${fmtArea(m.wallAreaNet, units)}`], [`Doors ${m.doorCount}`, `Windows ${m.windowCount}`, kind === 'exterior' ? `Wall height ${fmtLen(m.H, units)}` : `Baseboard ${fmtLF(m.baseboardLF, units)}`]];
    rows.forEach((r, ri) => r.forEach((txt, ci) => parts.push(`<text x="${padding / 2 + ci * ((width - padding) / 3)}" y="${y0 + 24 + ri * 20}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="12" fill="#1b1b1f">${esc(txt)}</text>`)));
    parts.push(`<text x="${width - padding / 2}" y="${height - 12}" font-family="-apple-system,Inter,Helvetica,Arial,sans-serif" font-size="10" fill="#9aa0ad" text-anchor="end">Scale ${(1 / ((units === 'metric' ? 1 : 0.3048) * scale) * 100).toFixed(0)} px per ${units === 'metric' ? 'm' : 'ft'} · ${esc(new Date(room.createdAt || Date.now()).toLocaleDateString())}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height.toFixed(0)}" width="${width}" height="${height.toFixed(0)}">${parts.join('')}</svg>`;
}

export const svgDataURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

export function svgToPngBlob(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'); };
    img.onerror = reject; img.src = svgDataURL(svg);
  });
}

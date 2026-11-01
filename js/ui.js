// DOM + UI helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  if (t.content.childElementCount > 1) { const w = document.createElement('div'); w.append(t.content); return w; } // multi-root templates get a wrapper
  return t.content.firstElementChild;
}
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === false || v == null) continue;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtMoney = (n, opts = {}) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style: 'currency', currency: opts.currency || 'USD', maximumFractionDigits: opts.cents === false ? 0 : 2, minimumFractionDigits: opts.cents === false ? 0 : 2 });
};
export const fmtNum = (n, d = 1) => (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: d });
export const fmtDate = (iso) => { const d = iso ? new Date(iso) : new Date(); return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

let toastTimer = null;
export function toast(msg, ms = 2200) {
  const app = $('#app');
  $$('.toast', app).forEach((t) => t.remove());
  const t = el(`<div class="toast">${esc(msg)}</div>`);
  app.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function sheet({ title, subtitle, body, actions = [], onClose, dismissible = true }) {
  const app = $('#app');
  const back = el(`<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div></div></div>`);
  const s = $('.sheet', back);
  if (title) s.append(el(`<h2>${esc(title)}</h2>`));
  if (subtitle) s.append(el(`<p class="muted small">${esc(subtitle)}</p>`));
  const bodyEl = h('div', { class: 'sheet-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
  s.append(bodyEl);
  const close = (result) => { back.remove(); onClose && onClose(result); };
  if (actions.length) {
    const bar = h('div', { class: 'col mt16' });
    for (const a of actions) {
      bar.append(h('button', { class: `btn block ${a.cls || ''}`, onClick: async () => { const r = a.onClick ? await a.onClick(bodyEl, close) : undefined; if (!a.keepOpen) close(r); } }, a.label));
    }
    s.append(bar);
  }
  if (dismissible) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
  app.append(back);
  return { el: s, body: bodyEl, close };
}

export function confirmDialog(message, { okLabel = 'Confirm', danger = false, title = 'Are you sure?' } = {}) {
  return new Promise((resolve) => {
    sheet({ title, body: `<p class="muted">${esc(message)}</p>`, onClose: (r) => resolve(!!r), actions: [
      { label: okLabel, cls: danger ? 'danger' : '', onClick: () => true },
      { label: 'Cancel', cls: 'neutral', onClick: () => false },
    ] });
  });
}

export function promptDialog(title, { label = '', value = '', placeholder = '', type = 'text', hint = '' } = {}) {
  return new Promise((resolve) => {
    const body = el(`<div><div class="field"><label>${esc(label)}</label><input type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" /></div>${hint ? `<p class="dim small mt8">${esc(hint)}</p>` : ''}</div>`);
    const input = $('input', body);
    const sh = sheet({ title, body, onClose: (r) => resolve(r), actions: [
      { label: 'Save', onClick: () => input.value },
      { label: 'Cancel', cls: 'neutral', onClick: () => null },
    ] });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sh.close(input.value); });
    setTimeout(() => input.focus(), 50);
  });
}

const DOWNLOAD_EXT_ALLOW = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip', 'fig']);
export const isEmbedded = () => { try { return window.self !== window.top; } catch { return true; } };
/** Save a file. In a Claude artifact view this goes through the `downloads` capability (viewer confirms; formats outside
 *  its allowlist are wrapped in a .zip); elsewhere it is a normal browser download. */
export async function download(filename, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch { dl = null; }
    if (dl) {
      let name = filename, payload = blob; const ext = (filename.split('.').pop() || '').toLowerCase();
      if (!DOWNLOAD_EXT_ALLOW.has(ext)) { const { makeZip } = await import('./zip.js'); payload = makeZip([{ name: filename, data: new Uint8Array(await blob.arrayBuffer()) }]); name = filename.replace(/\.[^.]+$/, '') + '.zip'; }
      try { await dl.save({ filename: name, data: payload }); toast(`Saved ${name}`); } catch (e) { if (!e || e.code !== 'declined') toast((e && e.message) || 'Download failed'); }
      return;
    }
    if (isEmbedded()) { toast('Downloads are not available in this view'); return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

export async function shareOrCopy({ title, text, url, files }) {
  try {
    if (navigator.share && (!files || (navigator.canShare && navigator.canShare({ files })))) {
      await navigator.share({ title, text, url, files });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  try { await navigator.clipboard.writeText(url || text); toast('Copied to clipboard'); return 'copied'; } catch { return 'failed'; }
}

export function switchEl(checked, onChange) {
  const b = el(`<button class="switch" role="switch" aria-checked="${checked ? 'true' : 'false'}"></button>`);
  b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onChange(v); });
  return b;
}

export function segEl(options, value, onChange) {
  const seg = h('div', { class: 'seg' });
  for (const o of options) {
    const b = h('button', { class: o.value === value ? 'active' : '', onClick: () => { $$('button', seg).forEach((x) => x.classList.remove('active')); b.classList.add('active'); onChange(o.value); } }, o.label);
    seg.append(b);
  }
  return seg;
}

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${d}</svg>`;
export const icons = {
  home: I('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  scan: I('<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>'),
  cube: I('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/>'),
  doc: I('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  camera: I('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  ar: I('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  ruler: I('<path d="M3 17l14-14 4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  pencil: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  grid: I('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  chevron: I('<path d="M9 18l6-6-6-6"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  check: I('<path d="M20 6L9 17l-5-5"/>'),
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  mic: I('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4M8 23h8"/>'),
  trash: I('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  share: I('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>'),
  print: I('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>'),
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>'),
  sign: I('<path d="M3 17c3-6 5-6 6-2s2 3 4-2 3-3 3 1 2 3 5 0"/>'),
  invoice: I('<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><path d="M12 11v6M9.5 12.5h3.5a1.25 1.25 0 0 1 0 2.5H10a1.25 1.25 0 0 0 0 2.5h3"/>'),
  folder: I('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  bolt: I('<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>'),
  wand: I('<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 6.2L11 5M3 21l9-9"/>'),
  layers: I('<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>'),
  eye: I('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  rotate: I('<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>'),
  info: I('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  warn: I('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  sparkle: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  door: I('<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  window: I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>'),
  photo: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  copy: I('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  more: I('<circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/>'),
  dollar: I('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  target: I('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  play: I('<path d="M5 3l14 9-14 9z"/>'),
  edit: I('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
};

export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function readFileAsDataURL(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(fr.result);
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/** Attach a delegated listener to a long-lived root, replacing any previous one of the same type (safe to call on every render). */
export function bind(root, type, handler) { const key = `__bound_${type}`; if (root[key]) root.removeEventListener(type, root[key]); root[key] = handler; root.addEventListener(type, handler); }

/** Full-screen sub-page (Back · title · action) with a scrolling body. */
export function panel({ title, action = null, onClose = null }) {
  const app = $('#app');
  const root = el(`<div class="panel" role="dialog" aria-label="${esc(title)}"><div class="doc-bar"><button class="btn ghost" data-pact="back">${icons.back} Back</button><b class="panel-title">${esc(title)}</b>${action ? `<button class="btn ghost" data-pact="action">${esc(action.label)}</button>` : '<span style="width:64px"></span>'}</div><div class="panel-body"></div></div>`);
  const body = $('.panel-body', root); let closed = false;
  const close = (r) => { if (closed) return; closed = true; root.remove(); onClose && onClose(r); };
  root.addEventListener('click', async (e) => { const a = e.target.closest('[data-pact]')?.dataset.pact; if (a === 'back') close(null); if (a === 'action' && action) { const r = await action.onClick(body, close); if (r !== false) close(r); } });
  app.append(root); return { el: root, body, close, setTitle: (t) => { $('.panel-title', root).textContent = t; } };
}
export const field = (label, inner, hint = '') => el(`<div class="field"><label>${esc(label)}</label>${inner}${hint ? `<div class="dim tiny">${esc(hint)}</div>` : ''}</div>`);
export const money0 = (n) => fmtMoney(n, { cents: false });
export const pct = (n, d = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(d)}%`;

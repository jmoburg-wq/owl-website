// persistence (localStorage for documents, IndexedDB for point clouds)
import { BRAND } from './brand.js';
import { DEFAULT_PROFILE, newEstimateAdj } from './pricing/profile.js';
const KEY = BRAND.storageKey;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const DEFAULT_TERMS = `This estimate is valid for {validDays} days from the date issued. Pricing is based on the measurements and scope described above; concealed conditions, code upgrades, or changes requested after acceptance will be quoted separately as a change order. A deposit of {depositPct}% is due at acceptance, with the balance due upon substantial completion. All work to be performed in a workmanlike manner according to standard practices.`;

export const DEFAULTS = {
  version: 1,
  settings: {
    units: 'imperial', theme: 'auto',
    company: { name: '', phone: '', email: '', license: '', address: '', logo: '', website: '' },
    region: { state: 'US', zip: '' },
    pricing: { materialIndex: 1.0, laborIndex: 1.0, autoRegion: true },
    defaults: {
      ceilingHeight: 2.4384, cameraHeight: 1.45, wallThickness: 0.1143,
      materialMarkup: 15, laborMarkup: 10, overhead: 10, profit: 10, contingency: 0,
      taxRate: 7.0, taxMaterialsOnly: true, depositPct: 30, validDays: 30, laborRate: 65,
    },
    terms: DEFAULT_TERMS,
    ai: { apiKey: '', endpoint: '', model: 'claude-opus-5-5' },
    profile: structuredClone(DEFAULT_PROFILE),
    suppliers: null, supplierPrefs: {}, priceList: [],
    cvs: { origins: ['https://rrg-studio.vercel.app'] }, // where #cvs-url= links may load designs from (one setting)
    nextEstimateNo: 1001, nextInvoiceNo: 1001,
    onboarded: false,
  },
  projects: [],
  activeProjectId: null,
  activeRoomId: null,
};

function deepMerge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = k in base && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined ? base : over;
}

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = this.load();
    this._t = null;
  }
  load() {
    try {
      let raw = localStorage.getItem(KEY);
      if (!raw) for (const k of BRAND.legacyStorageKeys) { const old = localStorage.getItem(k); if (old) { raw = old; try { localStorage.setItem(KEY, old); } catch {} break; } }
      if (!raw) return structuredClone(DEFAULTS);
      return deepMerge(structuredClone(DEFAULTS), JSON.parse(raw));
    } catch { return structuredClone(DEFAULTS); }
  }
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { console.warn('save failed', e); } }, 120);
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(tag) { for (const fn of this.listeners) { try { fn(this.state, tag); } catch (e) { console.error(e); } } }
  update(fn, tag) { fn(this.state); this.save(); this.emit(tag); }
  get settings() { return this.state.settings; }

  // ---- projects
  projects() { return this.state.projects; }
  project(id) { return this.state.projects.find((p) => p.id === id) || null; }
  activeProject() { return this.project(this.state.activeProjectId); }
  setActiveProject(id) { this.update((s) => { s.activeProjectId = id; const p = s.projects.find((x) => x.id === id); s.activeRoomId = p && p.rooms[0] ? p.rooms[0].id : null; }, 'active'); }
  createProject({ name, client } = {}) {
    const s = this.state.settings;
    const p = {
      id: uid(), name: name || `Project ${this.state.projects.length + 1}`,
      client: { name: '', address: '', phone: '', email: '', ...(client || {}) },
      folder: '', status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      rooms: [], photos: [], changeOrders: [],
      estimate: {
        number: `EST-${s.nextEstimateNo}`, date: new Date().toISOString(), validDays: s.defaults.validDays,
        scopeText: '', assemblies: [], items: [], removedKeys: [], notes: '',
        adj: newEstimateAdj(s), products: [],
        terms: s.terms, signature: null, sentAt: null, invoice: null,
      },
    };
    this.update((st) => { st.settings.nextEstimateNo += 1; st.projects.unshift(p); st.activeProjectId = p.id; st.activeRoomId = null; }, 'project');
    return p;
  }
  deleteProject(id) { this.update((s) => { s.projects = s.projects.filter((p) => p.id !== id); if (s.activeProjectId === id) { s.activeProjectId = s.projects[0] ? s.projects[0].id : null; s.activeRoomId = null; } }, 'project'); }
  duplicateProject(id) {
    const src = this.project(id); if (!src) return null;
    const copy = structuredClone(src);
    copy.id = uid(); copy.name = `${src.name} (copy)`; copy.status = 'draft'; copy.createdAt = new Date().toISOString(); copy.updatedAt = copy.createdAt;
    copy.estimate.number = `EST-${this.state.settings.nextEstimateNo}`; copy.estimate.date = copy.createdAt; copy.estimate.signature = null; copy.estimate.sentAt = null; copy.estimate.invoice = null; delete copy.estimate.signedTotal; copy.changeOrders = []; if (copy.estimate.tiers) copy.estimate.tiers.chosen = null;
    copy.rooms.forEach((r) => { r.id = uid(); r.cloudCount = 0; });
    this.update((s) => { s.settings.nextEstimateNo += 1; s.projects.unshift(copy); s.activeProjectId = copy.id; s.activeRoomId = copy.rooms[0] ? copy.rooms[0].id : null; }, 'project');
    return copy;
  }
  touch(p) { p.updatedAt = new Date().toISOString(); }

  // ---- rooms
  activeRoom() { const p = this.activeProject(); if (!p) return null; return p.rooms.find((r) => r.id === this.state.activeRoomId) || p.rooms[0] || null; }
  addRoom(room) {
    let p = this.activeProject(); if (!p) p = this.createProject({ name: room.name ? `${room.name} project` : undefined });
    this.update((s) => { const pr = s.projects.find((x) => x.id === p.id); pr.rooms.push(room); s.activeRoomId = room.id; this.touch(pr); }, 'room');
    return room;
  }
  updateRoom(roomId, fn) { this.update((s) => { for (const p of s.projects) { const r = p.rooms.find((x) => x.id === roomId); if (r) { fn(r, p); this.touch(p); } } }, 'room'); }
  removeRoom(roomId) { this.update((s) => { for (const p of s.projects) { const i = p.rooms.findIndex((x) => x.id === roomId); if (i >= 0) { p.rooms.splice(i, 1); this.touch(p); } } if (s.activeRoomId === roomId) { const p = s.projects.find((x) => x.id === s.activeProjectId); s.activeRoomId = p && p.rooms[0] ? p.rooms[0].id : null; } }, 'room'); idb.del(roomId).catch(() => {}); }
  setActiveRoom(id) { this.update((s) => { s.activeRoomId = id; }, 'active'); }

  // ---- import/export
  exportJSON() { const copy = structuredClone(this.state); if (copy.settings && copy.settings.ai) copy.settings.ai.apiKey = ''; return JSON.stringify(copy, null, 2); }
  importJSON(json) { const data = JSON.parse(json); if (!data || !Array.isArray(data.projects)) throw new Error(`Not a ${BRAND.name} backup`); const keepKey = this.state.settings && this.state.settings.ai ? this.state.settings.ai.apiKey : ''; this.state = deepMerge(structuredClone(DEFAULTS), data); if (keepKey && !(this.state.settings.ai && this.state.settings.ai.apiKey)) this.state.settings.ai.apiKey = keepKey; this.save(); this.emit('import'); }
  reset() { this.state = structuredClone(DEFAULTS); localStorage.removeItem(KEY); this.emit('reset'); }
}

export const store = new Store();

// ---- IndexedDB for point clouds (Float32Array xyz + Uint8 rgb)
export const idb = (() => {
  const NAME = 'roompilot-clouds', STORE = 'clouds';
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const req = fn(t.objectStore(STORE)); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); }); };
  return {
    put: (id, positions, colors) => tx('readwrite', (s) => s.put({ positions, colors }, id)),
    get: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
  };
})();

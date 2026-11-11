// Backup to the Studio account (docs/FAMILY.md, "One sign-in"): what to send, and how to take what comes back.
// Pure functions (no DOM, no network). Each job is stored whole and the newer copy wins.
export const SETTINGS_ID = '_settings';
export const MAX_PER_CALL = 40;

/** A short, stable fingerprint of a value (djb2 over its JSON): tells "changed since the last backup" without dates. */
export function fingerprint(value) { const s = JSON.stringify(value); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return `${s.length}.${(h >>> 0).toString(36)}`; }

/** Settings as they are backed up: never the AI key (it stays on the device), never the connection itself. */
export function settingsForBackup(settings) { const c = structuredClone(settings || {}); if (c.ai) c.ai.apiKey = ''; delete c.account; return c; }

/**
 * What to send. `acct.synced` is { <id>: { at, fp } } as of the last backup. A job that changed without its date
 * moving (some edits don't touch it) gets a new date, so the change is never lost. A job that was backed up and is
 * gone from the device goes as deleted.
 */
export function buildSync(state, acct, now = new Date()) {
  const synced = acct.synced || {}; const jobs = []; const have = {}; const fps = {};
  const push = (id, at, name, data) => { if (jobs.length < MAX_PER_CALL) jobs.push({ id, updatedAt: at, name, data }); };
  for (const p of state.projects || []) {
    const { updatedAt, ...body } = p; const fp = fingerprint(body); const s = synced[p.id]; let at = p.updatedAt || now.toISOString();
    if (!s || s.fp !== fp) { if (s && !(new Date(at) > new Date(s.at))) { at = now.toISOString(); p.updatedAt = at; } push(p.id, at, p.name || '', { ...body, updatedAt: at }); }
    have[p.id] = at; fps[p.id] = fp;
  }
  const local = new Set((state.projects || []).map((p) => p.id));
  for (const id of Object.keys(synced)) if (id !== SETTINGS_ID && !local.has(id) && jobs.length < MAX_PER_CALL) jobs.push({ id, updatedAt: now.toISOString(), deleted: true });
  const sdoc = settingsForBackup(state.settings); const sfp = fingerprint(sdoc); const ss = synced[SETTINGS_ID];
  // A device that just connected asks first: its fresh settings must not replace the ones already backed up
  if (!ss && !acct.settingsChecked) { /* send nothing, hold nothing: the Studio answers with its copy if it has one */ }
  else if (!ss || ss.fp !== sfp) { const at = now.toISOString(); push(SETTINGS_ID, at, 'Settings', sdoc); have[SETTINGS_ID] = at; } else have[SETTINGS_ID] = ss.at;
  fps[SETTINGS_ID] = sfp;
  return { jobs, have, fps };
}

/** Takes the Studio's answer: marks what was saved, brings in newer jobs and settings, removes jobs deleted elsewhere. */
export function applySync(state, acct, sent, res) {
  const synced = { ...(acct.synced || {}) }; const sentById = new Map(sent.jobs.map((j) => [j.id, j])); const out = { saved: 0, received: 0, removed: 0, settings: false, refused: res.refused || [] };
  for (const id of res.saved || []) { const j = sentById.get(id); if (!j) continue; if (j.deleted) delete synced[id]; else synced[id] = { at: j.updatedAt, fp: sent.fps[id] }; out.saved++; }
  for (const n of res.newer || []) {
    if (n.id === SETTINGS_ID) {
      if (n.data && typeof n.data === 'object') { const keepKey = (state.settings.ai && state.settings.ai.apiKey) || ''; const nextNo = (k) => Math.max(Number(state.settings[k]) || 0, Number(n.data[k]) || 0);
        const merged = { ...state.settings, ...n.data, nextEstimateNo: nextNo('nextEstimateNo'), nextInvoiceNo: nextNo('nextInvoiceNo') }; merged.ai = { ...(n.data.ai || state.settings.ai || {}), apiKey: keepKey };
        state.settings = merged; synced[SETTINGS_ID] = { at: n.updatedAt, fp: fingerprint(settingsForBackup(merged)) }; out.settings = true; }
      continue;
    }
    const i = (state.projects || []).findIndex((p) => p.id === n.id);
    if (n.deleted) { if (i >= 0) { state.projects.splice(i, 1); out.removed++; if (state.activeProjectId === n.id) { state.activeProjectId = state.projects[0] ? state.projects[0].id : null; state.activeRoomId = null; } } delete synced[n.id]; continue; }
    if (!n.data || typeof n.data !== 'object') continue;
    const job = { ...n.data, id: n.id, updatedAt: n.updatedAt };
    if (i >= 0) state.projects[i] = job; else state.projects.unshift(job);
    const { updatedAt, ...body } = job; synced[n.id] = { at: n.updatedAt, fp: fingerprint(body) }; out.received++;
  }
  acct.synced = synced; acct.settingsChecked = true; acct.lastSyncAt = res.at || new Date().toISOString();
  return out;
}

/** Is there anything on this device the backup doesn't have yet? */
export function pendingCount(state, acct) { return buildSync(structuredClone(state), acct).jobs.length; }

/** The connect link Fullbid opens, and the one-time code it expects back. */
export function connectRequest(studioOrigin, random = () => crypto.getRandomValues(new Uint8Array(18))) {
  const state = btoa(String.fromCharCode(...random())).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const origin = new URL(studioOrigin).origin;
  return { state, origin, href: `${origin}/visualizer/fullbid/connect?state=${state}` };
}

/**
 * The Studio's answer on the way back (#studio=<token>&api=<api base>&state=<code>). Accepted only with the code this
 * device made and from the site it opened, so a link someone else wrote can't connect this device to their server.
 */
export function readConnectHash(hash, pending) {
  const h = String(hash || ''); const get = (k) => { const m = new RegExp(`[#&]${k}=([^&]+)`).exec(h); return m ? decodeURIComponent(m[1]) : ''; };
  const token = get('studio'); if (!token) return null;
  const api = get('api'); const state = get('state');
  if (!pending || !pending.state || state !== pending.state) return { error: 'This sign-in link was not started on this device. Open Settings and tap Connect.' };
  let origin; try { origin = new URL(api).origin; } catch { return { error: 'The sign-in link is not complete. Try Connect again.' }; }
  if (origin !== pending.origin || !/^https:$/.test(new URL(api).protocol)) return { error: 'The sign-in came back from a different site than the one opened. Nothing was connected.' };
  return { token, apiBase: api.replace(/\/+$/, '') };
}

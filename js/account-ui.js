// Sign in with a Studio account, and keep this device's jobs backed up there (docs/FAMILY.md).
import { store } from './store.js';
import { BRAND } from './brand.js';
import { buildSync, applySync, connectRequest, readConnectHash } from './account/sync.js';
import { cvsOrigins } from './cvs/import.js';
import { el, h, $, toast, sheet, icons, esc, fmtDate, confirmDialog, debounce } from './ui.js';

// The connection lives in its own slot: never in a backup file, a share link or the synced settings.
const KEY = `${BRAND.storageKey}.account`;
export function getAccount() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } }
function saveAccount(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { console.warn('account save failed', e); } }
export const isConnected = (a = getAccount()) => !!(a.token && a.apiBase);

const call = async (acct, path, init = {}) => {
  const res = await fetch(`${acct.apiBase}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${acct.token}` } });
  const body = await res.json().catch(() => ({ ok: false, error: `The Studio answered ${res.status}.` }));
  return { status: res.status, ...body };
};

/** Step 1: open the Studio's sign-in with a one-time code this device will expect back. */
export function startConnect(studioOrigin) {
  const c = connectRequest(studioOrigin); const a = getAccount(); a.pending = { state: c.state, origin: c.origin, at: Date.now() }; saveAccount(a);
  location.href = c.href;
}

/** Step 2: the Studio sent us back with a token in the link. */
export async function handleStudioHash(hash, { navigate } = {}) {
  if (!/[#&]studio=/.test(hash || '')) return false;
  history.replaceState(null, '', location.pathname + '#/settings');
  const a = getAccount(); const r = readConnectHash(hash, a.pending);
  if (!r) return false;
  if (r.error) { toast(r.error, 5000); return true; }
  const next = { token: r.token, apiBase: r.apiBase, connectedAt: new Date().toISOString(), synced: {} };
  let who; try { who = await call(next, '/fullbid/account'); } catch { toast('Could not reach the Studio. Check the connection and tap Connect again.', 5000); return true; }
  if (!who.ok) { toast(who.error || 'The Studio did not accept the sign-in. Try Connect again.', 5000); return true; }
  Object.assign(next, { company: who.company, name: who.name, email: who.email });
  saveAccount(next); if (navigate) navigate('settings');
  toast(`Connected to ${who.company}`);
  await syncNow({ quiet: false }); if (navigate) navigate('settings');
  return true;
}

let running = null;
/** Back up what changed and bring in anything newer. Returns a summary, or null when offline or not connected. */
export function syncNow({ quiet = true } = {}) {
  if (running) return running;
  running = (async () => {
    const acct = getAccount(); if (!isConnected(acct)) return null;
    try {
      let total = { saved: 0, received: 0, removed: 0, settings: false, refused: [] };
      for (let round = 0; round < 6; round++) {
        const sent = buildSync(store.state, acct);
        if (!sent.jobs.length && round > 0) break;
        const res = await call(acct, '/fullbid/sync', { method: 'POST', body: JSON.stringify({ jobs: sent.jobs, have: sent.have }) });
        if (res.status === 401) { acct.needsReconnect = true; saveAccount(acct); if (!quiet) toast('This device was signed out. Connect again in Settings.', 5000); return { signedOut: true }; }
        if (!res.ok) { acct.lastError = res.error || 'Backup failed.'; saveAccount(acct); if (!quiet) toast(acct.lastError, 4000); return { error: acct.lastError }; }
        const r = applySync(store.state, acct, sent, res);
        total = { saved: total.saved + r.saved, received: total.received + r.received, removed: total.removed + r.removed, settings: total.settings || r.settings, refused: [...total.refused, ...r.refused] };
        // A refused job would be retried forever: remember it as seen until it changes again
        for (const x of r.refused) if (sent.fps[x.id]) acct.synced[x.id] = { at: sent.have[x.id], fp: sent.fps[x.id], refused: x.why };
        delete acct.lastError; delete acct.needsReconnect; saveAccount(acct);
        if (!sent.jobs.length) break;
      }
      if (total.received || total.removed || total.settings) store.update(() => {}, 'sync');
      else store.save();
      if (!quiet) toast(total.refused.length ? `Backed up, except ${total.refused.length}: ${total.refused[0].why}` : total.received || total.removed ? `Backed up. ${total.received + total.removed} job${total.received + total.removed === 1 ? '' : 's'} updated from your account.` : 'Backed up', 3500);
      return total;
    } catch (e) { if (!quiet) toast('Could not reach the Studio. Your jobs are safe on this device and will back up when you are online.', 5000); return null; }
  })().finally(() => { running = null; });
  return running;
}

/** Back up a few seconds after any change, when the app opens, and when the connection returns. */
export function startAutoSync() {
  const later = debounce(() => { if (isConnected() && navigator.onLine !== false) syncNow(); }, 4000);
  store.subscribe((_, tag) => {
    if (tag === 'sync') return;
    // Erasing this device must not erase the account: the device lets go of the account instead
    if (tag === 'reset') { disconnect(); return; }
    // A restored backup file replaces what is here; nothing missing from it is deleted from the account
    if (tag === 'import') { const a = getAccount(); if (isConnected(a)) { a.synced = {}; a.settingsChecked = false; saveAccount(a); } }
    later();
  });
  window.addEventListener('online', later);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(); });
  if (isConnected()) setTimeout(() => syncNow(), 1200);
}

export function disconnect() { saveAccount({}); }

/** Settings card */
export function accountCard(rerender) {
  const a = getAccount(); const on = isConnected(a);
  const card = h('div', { class: 'card', 'data-role': 'account-card' });
  card.append(el(`<div class="card-title"><h3>Account &amp; backup</h3><span class="pill ${on && !a.needsReconnect ? 'signed' : 'draft'}">${on ? (a.needsReconnect ? 'signed out' : 'connected') : 'this device only'}</span></div>`));
  if (!on) {
    card.append(el(`<p class="small muted">Your jobs live only on this device. Sign in with your Contractor Visual Studio account to back them up and use them on your other devices.</p>`));
    card.append(el(`<button class="btn block mt8" data-acct="connect">${icons.share} Connect to the Studio</button>`));
  } else {
    const refused = Object.values(a.synced || {}).filter((x) => x.refused);
    card.append(el(`<p class="small"><b>${esc(a.name || a.email || 'Signed in')}</b> at <b>${esc(a.company || 'your company')}</b></p><p class="dim small">${a.lastSyncAt ? `Last backed up ${esc(fmtDate(a.lastSyncAt))}, ${esc(new Date(a.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}` : 'Not backed up yet'}${a.lastError ? ` · ${esc(a.lastError)}` : ''}</p>`));
    if (refused.length) card.append(el(`<div class="flag mt8">${icons.warn}<div>${refused.length} job${refused.length === 1 ? ' is' : 's are'} not backed up: ${esc(refused[0].refused)}</div></div>`));
    if (a.needsReconnect) card.append(el(`<div class="flag mt8">${icons.warn}<div>This device was signed out by the Studio. Your jobs are still here. Connect again to keep backing up.</div></div>`));
    card.append(el(`<div class="btn-grid mt8">${a.needsReconnect ? `<button class="btn" data-acct="connect">${icons.share} Connect again</button>` : `<button class="btn secondary" data-acct="sync">${icons.check} Back up now</button>`}<button class="btn neutral" data-acct="disconnect">Disconnect</button></div>`));
  }
  card.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-acct]')?.dataset.acct; if (!act) return;
    if (act === 'sync') { await syncNow({ quiet: false }); rerender(); }
    if (act === 'disconnect' && (await confirmDialog('Stop backing up from this device? Your jobs stay on this device and in your account.', { okLabel: 'Disconnect', title: 'Disconnect' }))) { disconnect(); rerender(); }
    if (act === 'connect') connectSheet();
  });
  return card;
}

function connectSheet() {
  const dflt = (getAccount().apiBase ? new URL(getAccount().apiBase).origin : '') || cvsOrigins(store.settings)[0];
  const body = el(`<div><p class="muted small">You'll sign in on the Studio, tap Connect, and come straight back here.</p><div class="field mt8"><label>Your Studio's address</label><input data-f="origin" type="url" inputmode="url" value="${esc(dflt)}"><div class="dim tiny">Use your company's own Studio address if it has one.</div></div></div>`);
  sheet({ title: 'Connect to the Studio', body, actions: [{ label: 'Continue to sign in', onClick: () => {
    let o; try { o = new URL($('[data-f="origin"]', body).value.trim()); } catch { toast('Enter the address as https://…'); return false; }
    if (o.protocol !== 'https:') { toast('The address must start with https://'); return false; }
    startConnect(o.origin); return true; } }, { label: 'Cancel', cls: 'neutral' }] });
}

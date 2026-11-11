// Sign-in with a Studio account and backup: what is sent, what comes back, and the connect handshake.
import { buildSync, applySync, fingerprint, settingsForBackup, connectRequest, readConnectHash, SETTINGS_ID } from '../js/account/sync.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', m, x); } };
const T = (h) => new Date(`2026-11-10T${String(h).padStart(2, '0')}:00:00Z`);
const mk = () => ({ settings: { company: { name: 'Hill Co' }, ai: { apiKey: 'sk-secret', model: 'm' }, nextEstimateNo: 1004, nextInvoiceNo: 1001 }, projects: [{ id: 'a', name: 'Bath', updatedAt: T(9).toISOString(), estimate: { items: [] } }, { id: 'b', name: 'Roof', updatedAt: T(9).toISOString(), estimate: { items: [] } }], activeProjectId: 'a' });

// first backup: everything goes, the AI key never does
{ const st = mk(); const acct = {}; const first = buildSync(st, acct, T(10));
  ok(first.jobs.map((j) => j.id).join() === 'a,b' && !(SETTINGS_ID in first.have), 'a just-connected device sends its jobs but asks for settings before sending its own', first.jobs.map((j) => j.id).join());
  applySync(st, acct, first, { saved: ['a', 'b'], newer: [] }); const s = buildSync(st, acct, T(10));
  ok(s.jobs.map((j) => j.id).join() === SETTINGS_ID, 'with none backed up yet, its settings go next', s.jobs.map((j) => j.id).join());
  ok(!JSON.stringify(s).includes('sk-secret') && settingsForBackup(st.settings).ai.apiKey === '', 'the AI key stays on the device');
  const r = applySync(st, acct, s, { saved: [SETTINGS_ID], newer: [], at: T(10).toISOString() });
  ok(r.saved === 1 && acct.synced.a.at === T(9).toISOString() && acct.lastSyncAt, 'saved jobs are remembered');
  ok(buildSync(st, acct, T(11)).jobs.length === 0, 'nothing changed → nothing sent');
  // an edit that didn't touch the date still goes, with a new date
  st.projects[0].estimate.items.push({ name: 'Tile' }); const s2 = buildSync(st, acct, T(11));
  ok(s2.jobs.length === 1 && s2.jobs[0].id === 'a' && s2.jobs[0].updatedAt === T(11).toISOString() && st.projects[0].updatedAt === T(11).toISOString(), 'a change without a new date gets one', JSON.stringify(s2.jobs.map((j) => [j.id, j.updatedAt])));
  applySync(st, acct, s2, { saved: ['a'], newer: [] });
  // deleting a backed-up job sends it as deleted
  st.projects = st.projects.filter((p) => p.id !== 'b'); const s3 = buildSync(st, acct, T(12));
  ok(s3.jobs.length === 1 && s3.jobs[0].id === 'b' && s3.jobs[0].deleted === true, 'a deleted job goes as deleted');
  applySync(st, acct, s3, { saved: ['b'], newer: [] }); ok(!acct.synced.b && buildSync(st, acct, T(13)).jobs.length === 0, 'and is forgotten once the Studio has it'); }

// a second device: receives jobs, a newer edit, a delete, and settings (keeping its own AI key)
{ const st = { settings: { company: { name: '' }, ai: { apiKey: 'local-key' }, nextEstimateNo: 1010, nextInvoiceNo: 1001 }, projects: [{ id: 'b', name: 'Roof', updatedAt: T(9).toISOString(), estimate: { items: [] } }], activeProjectId: 'b' }; const acct = { synced: { b: { at: T(9).toISOString(), fp: fingerprint({ id: 'b', name: 'Roof', estimate: { items: [] } }) } } };
  const s = buildSync(st, acct, T(14));
  const r = applySync(st, acct, s, { saved: s.jobs.map((j) => j.id), newer: [
    { id: 'a', updatedAt: T(11).toISOString(), name: 'Bath', deleted: false, data: { id: 'a', name: 'Bath', estimate: { items: [{ name: 'Tile' }] } } },
    { id: 'b', updatedAt: T(12).toISOString(), name: '', deleted: true, data: null },
    { id: SETTINGS_ID, updatedAt: T(10).toISOString(), name: 'Settings', deleted: false, data: { company: { name: 'Hill Co' }, ai: { apiKey: '', model: 'm' }, nextEstimateNo: 1004, nextInvoiceNo: 1001 } }] });
  ok(r.received === 1 && r.removed === 1 && r.settings, 'takes a new job, a delete and the settings', JSON.stringify(r));
  ok(st.projects.length === 1 && st.projects[0].id === 'a' && st.projects[0].estimate.items.length === 1 && st.activeProjectId === 'a', 'jobs replaced and removed; the open job moves off a deleted one');
  ok(st.settings.company.name === 'Hill Co' && st.settings.ai.apiKey === 'local-key' && st.settings.nextEstimateNo === 1010, "settings come in; this device's AI key and the higher estimate number stay");
  ok(buildSync(st, acct, T(15)).jobs.length === 0, 'received jobs are not sent straight back'); }

// the connect handshake
{ const c = connectRequest('https://rrg-studio.vercel.app/anything', () => new Uint8Array(18).fill(7));
  ok(c.href === `https://rrg-studio.vercel.app/visualizer/fullbid/connect?state=${c.state}` && /^[A-Za-z0-9_-]{8,64}$/.test(c.state), 'connect opens the Studio with a one-time code', c.href);
  const good = `#studio=tok.mac&api=${encodeURIComponent('https://rrg-studio.vercel.app/visualizer/api')}&state=${c.state}`;
  ok(readConnectHash(good, c).token === 'tok.mac' && readConnectHash(good, c).apiBase === 'https://rrg-studio.vercel.app/visualizer/api', 'accepts its own code from the site it opened');
  ok(readConnectHash(good, null).error && readConnectHash(good.replace(c.state, 'someoneelses'), c).error, 'refuses a link this device did not start');
  ok(readConnectHash(`#studio=t&api=${encodeURIComponent('https://evil.example/api')}&state=${c.state}`, c).error, 'refuses an answer from another site');
  ok(readConnectHash('#/home', c) === null, 'no sign-in in the link → nothing'); }
console.log(`account tests: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);

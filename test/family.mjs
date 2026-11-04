// The family kit: one handoff convention for every RRG app (docs/FAMILY.md).
import { encode, decode, check, linkFor, readHash, familyLead, FAMILY_APPS, HANDOFFS, MAX_INLINE } from '../js/shared/family-kit.js';
import { encodeCvsPackage, decodeCvsPayload } from '../js/cvs/import.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', m, x); } };

const doc = { schema: 'cvs.measurements', version: 1, designId: 'd1', measurements: [{ kind: 'roof_area', value: 2400, unit: 'sq ft', source: 'measured' }] };
ok(JSON.stringify(await decode(await encode(doc))) === JSON.stringify(doc), 'round trip');
ok(JSON.stringify(await decodeCvsPayload(await encode(doc))) === JSON.stringify(doc) && JSON.stringify(await decode(await encodeCvsPackage(doc))) === JSON.stringify(doc), "same encoding as Fullbid's #cvs= links");
ok(check(doc, 'cvs.measurements').ok && !check({ ...doc, version: 2 }, 'cvs.measurements').ok && /newer version/.test(check({ ...doc, version: 2 }, 'cvs.measurements').error), 'schema and version check');
const l = await linkFor('https://rrg-studio.vercel.app/visualizer/admin?lead=abc', doc); const u = new URL(l.href);
ok(u.searchParams.get('lead') === 'abc' && u.hash.startsWith('#cvs-measure=d:'), 'link keeps the page and adds the handoff', l.href);
ok((await readHash(u.hash, 'cvs-measure')).doc.designId === 'd1', 'reads its own link');
ok((await readHash('#cvs-measure-url=' + encodeURIComponent('https://evil.example/p.json'), 'cvs-measure', { allow: ['https://rrg-studio.vercel.app'], fetchImpl: () => { throw new Error('fetched'); } })).error, 'refuses origins not on the allow-list without fetching');
ok((await readHash('#cvs-measure-url=https://rrg-studio.vercel.app/x.json', 'cvs-measure', { allow: ['https://rrg-studio.vercel.app'], fetchImpl: async () => ({ ok: true, json: async () => doc }) })).doc.schema === 'cvs.measurements', 'fetches from an allow-listed origin');
ok((await readHash('#/home', 'cvs-measure')) === null, 'no handoff → null');
const big = { schema: 'cvs.job-package', version: 1, junk: Array.from({ length: 4000 }, (_, i) => `${i}-${Math.random()}`) }; ok((await linkFor('https://x.example/', big)).tooBig, `over ${MAX_INLINE} characters goes as a file`);
ok(familyLead({ app: 'window-matchmaker', name: 'Pat', consent: false }) === null && familyLead({ app: 'window-matchmaker', name: 'Pat', wants: ['windows'], consent: true }).schema === 'family.lead', 'a lead needs consent');
ok(FAMILY_APPS.studio.hub && Object.values(HANDOFFS).every((h) => h.key && h.status), 'Studio is the hub; every handoff has a key and a status');
console.log(`family kit tests: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);

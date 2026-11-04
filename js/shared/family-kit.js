// RRG family kit: how one app hands work to another, in one file with no dependencies.
// Copy this file into any family app (or import it from Fullbid's site) — see docs/FAMILY.md.
//
// Every handoff is a JSON document with `schema` and `version`, carried one of three ways:
//   1. inside a link:   <app>/#<key>=d:<base64url(deflate-raw(JSON))>   (small documents, ≲ 8,000 characters)
//   2. a link to it:    <app>/#<key>-url=<https URL>                      (the receiver fetches it; allow-listed origins only)
//   3. a .json file the person opens or drops on the receiving app
// The receiver always shows what arrived and asks before it creates or changes anything.

/** The family. The Studio (Contractor Visual Studio) is the hub: designs start there and come back there. */
export const FAMILY_APPS = {
  studio: { name: 'Contractor Visual Studio', short: 'Studio', role: 'Design: the customer sees it, picks it, and it becomes a takeoff', url: 'https://rrg-studio.vercel.app/visualizer/', hub: true },
  fullbid: { name: 'Fullbid', short: 'Fullbid', role: 'Bid and run the job: measure, price, propose, sign, change orders, orders, money', url: 'https://jmoburg-wq.github.io/owl-website/' },
  listwell: { name: 'Listwell', short: 'Listwell', role: 'Selling a home: listing visuals and local pros', url: 'https://rrg-studio.vercel.app/visualizer/listing' },
};

/** What each handoff is, who sends it, who reads it, and the link key it travels under. */
export const HANDOFFS = {
  'cvs.job-package': { key: 'cvs', from: ['studio'], to: ['fullbid'], status: 'live', what: 'A design with its options, materials, labor, measurements and pictures' },
  'cvs.measurements': { key: 'cvs-measure', from: ['fullbid'], to: ['studio'], status: 'live', what: 'What was measured on site, each number with where it came from' },
  // Proposed: the Studio does not read these yet (docs/FAMILY.md, "Next")
  'family.lead': { key: 'lead', from: ['*'], to: ['studio'], status: 'proposed', what: 'A homeowner who asked for something: who, where, what for, and how they want to be reached' },
};

export const MAX_INLINE = 8000;

const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0)); };

/** A document → 'd:…' (compressed) or 'j:…' where the browser can't compress. */
export async function encode(doc) {
  const bytes = new TextEncoder().encode(JSON.stringify(doc));
  if (typeof CompressionStream !== 'function') return 'j:' + b64url(bytes);
  const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return 'd:' + b64url(new Uint8Array(await new Response(cs.readable).arrayBuffer()));
}
export async function decode(enc) {
  enc = decodeURIComponent(enc); const bytes = unb64url(enc.slice(2));
  if (enc.startsWith('j:')) return JSON.parse(new TextDecoder().decode(bytes));
  if (!enc.startsWith('d:')) throw new Error('This link is not complete.');
  const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close();
  return JSON.parse(await new Response(ds.readable).text());
}

/** Checks a document's schema and version. A newer version is refused in plain words. */
export function check(doc, schema, maxVersion = 1) {
  if (!doc || typeof doc !== 'object' || doc.schema !== schema) return { ok: false, error: 'This is not the kind of file this app reads.' };
  const v = Number(doc.version); if (!(v >= 1)) return { ok: false, error: 'This file has no version.' };
  if (v > maxVersion) return { ok: false, error: 'This was made with a newer version; update this app.' };
  return { ok: true, doc };
}

/**
 * The link that opens `doc` in another app. `base` is the receiving page (an app's address, or a design's own link).
 * Returns { href, inline } or { tooBig: true } when the document should go as a file or by URL instead.
 */
export async function linkFor(base, doc, { key = (HANDOFFS[doc.schema] || {}).key } = {}) {
  if (!key) throw new Error(`No link key for ${doc.schema}`);
  const enc = await encode(doc); if (enc.length > MAX_INLINE) return { tooBig: true };
  const u = new URL(base); u.hash = `${key}=${enc}`; return { href: u.toString(), inline: true };
}

/**
 * Reads a handoff from a page's hash: `#<key>=…` inside the link, or `#<key>-url=…` fetched from an allow-listed https
 * origin. Returns { doc } | { error } | null when the hash carries neither.
 */
export async function readHash(hash, key, { allow = [], fetchImpl = typeof fetch === 'function' ? fetch : null } = {}) {
  const h = String(hash || ''); const esc = key.replace(/[-]/g, '\\-');
  const inl = new RegExp(`[#&]${esc}=([^&]+)`).exec(h);
  if (inl) { try { return { doc: await decode(inl[1]) }; } catch { return { error: 'This link could not be read. Ask for it again.' }; } }
  const ref = new RegExp(`[#&]${esc}-url=(.+)$`).exec(h); if (!ref) return null;
  const url = decodeURIComponent(ref[1]); let u; try { u = new URL(url); } catch { return { error: 'This link is not complete.' }; }
  if (u.protocol !== 'https:' || !allow.some((o) => { try { return new URL(o).origin === u.origin; } catch { return false; } })) return { error: 'This link points to a site this app does not take files from.' };
  try { const r = await fetchImpl(url, { headers: { accept: 'application/json' } }); if (!r.ok) return { error: `It could not be loaded (${r.status}).` }; return { doc: await r.json() }; }
  catch { return { error: 'It could not be loaded. Check the connection and try again.' }; }
}

/**
 * A lead for the Studio from any family app (a matchmaker quiz, a trade site's form, a storm or claims tool).
 * Only what the homeowner agreed to share; `consent` must be true or nothing is built.
 */
export function familyLead({ app, name = '', phone = '', email = '', address = '', zip = '', wants = [], timeline = '', notes = '', consent = false, repCode = '' }) {
  if (!consent) return null;
  return { schema: 'family.lead', version: 1, from: { app, at: new Date().toISOString() }, person: { name, phone, email }, place: { address, zip }, wants: [...wants], timeline, notes, repCode: repCode || null, consent: { contact: true } };
}

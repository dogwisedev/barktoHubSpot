// lib/intel/liveTrainers.js
// Loads the live trainer list from DogwiseTrainers (the source of truth) into BB_GEO before scoring.
//   env TRAINERS_API_URL  e.g. https://dogwise-trainers.vercel.app
//   env AVAILABILITY_KEY  the app's read-only key
// Order: fresh copy (Redis, 5 min) → fetch → last good copy (Redis, 24h) → built-in snapshot.

require("./trainers.js");
const store = require("../store");
const { BB_GEO } = globalThis;

let memo = null; // { at, list } within one warm function instance

async function ensureTrainers() {
  const url = process.env.TRAINERS_API_URL, key = process.env.AVAILABILITY_KEY;
  if (!url || !key) return { kind: "snapshot", error: "TRAINERS_API_URL / AVAILABILITY_KEY not set" };

  if (memo && Date.now() - memo.at < 2 * 60e3) { BB_GEO.setTrainers(memo.list, { kind: "live", at: new Date(memo.at).toISOString() }); return BB_GEO.SOURCE; }

  const cached = store.configured() ? await store.getJSON("bb:trainers").catch(() => null) : null;
  if (cached && Date.now() - cached.at < 5 * 60e3) {
    memo = cached;
    BB_GEO.setTrainers(cached.list, { kind: "live", at: new Date(cached.at).toISOString() });
    return BB_GEO.SOURCE;
  }

  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/availability`, { headers: { "x-api-key": key } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(d.trainers) || !d.trainers.length) throw new Error(d.error || `App returned ${r.status}`);
    memo = { at: Date.now(), list: d.trainers };
    if (store.configured()) await store.setJSON("bb:trainers", memo, 24 * 3600).catch(() => {});
    BB_GEO.setTrainers(d.trainers, { kind: "live", at: new Date().toISOString() });
  } catch (e) {
    console.warn("[trainers] live list failed:", e.message);
    if (cached) BB_GEO.setTrainers(cached.list, { kind: "cached", at: new Date(cached.at).toISOString(), error: e.message });
    else return { kind: "snapshot", error: e.message };
  }
  return BB_GEO.SOURCE;
}

module.exports = { ensureTrainers };

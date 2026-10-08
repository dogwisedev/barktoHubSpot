// lib/census.js — ZIP median household income (free US Census API, needs CENSUS_KEY). Cached 90 days.
const store = require("./store");

async function medianIncome(zip) {
  const key = process.env.CENSUS_KEY;
  if (!key || !/^\d{5}$/.test(zip || "")) return null;
  const ck = `bb:inc:${zip}`;
  try {
    const cached = await store.getJSON(ck);
    if (cached) return cached.v;
  } catch { /* no cache, carry on */ }
  try {
    const r = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B19013_001E&for=zip%20code%20tabulation%20area:${zip}&key=${key}`);
    const body = await r.text();
    if (!r.ok || !body.trim().startsWith("[")) return null;
    const n = Number(JSON.parse(body)?.[1]?.[0]);
    const v = n > 0 ? n : null;
    await store.setJSON(ck, { v }, 90 * 86400).catch(() => {});
    return v;
  } catch { return null; }
}

module.exports = { medianIncome };

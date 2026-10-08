// lib/autoSettings.js — auto-buy / auto-bust settings, stored in Redis, edited from the Bark Buster popup.
const store = require("./store");

const DEFAULTS = {
  mode: "off",                 // off | dryrun | live
  bustMode: "off",             // off | dryrun | live — free: reactivate strong duplicates, runs 24/7
  pausedReason: "",

  // Core
  buyAbove: 75,
  maxCreditsPerLead: 12,
  dailyCreditCap: 120,
  dailyLeadCap: 35,
  hourFrom: 8,
  hourTo: 20,
  days: [0, 1, 2, 3, 4, 5, 6], // 0 = Sunday
  timezone: "America/New_York",

  // Best-first budget
  rankBy: "score",             // score | value (score per credit)
  pacing: true,
  pacingBurstPct: 20,          // allowed to run this far ahead of an even spend
  risingBar: true,
  risingStartPct: 70,          // once this % of the daily cap is spent…
  risingMaxScore: 85,          // …the bar climbs towards this score
  holdMinutes: 0,              // 0 = off
  holdBelowScore: 85,

  // Always / never
  alwaysBuyShortlisted: true,
  shortlistedMinScore: 50,
  maxProsBefore: 2,
  maxAgeHours: 24,
  neverOutOfRange: true,
  neverGroupOnly: true,

  // Scoring economics
  creditPriceUsd: 1.2
};

const NUM = ["buyAbove", "maxCreditsPerLead", "dailyCreditCap", "dailyLeadCap", "hourFrom", "hourTo", "pacingBurstPct",
  "risingStartPct", "risingMaxScore", "holdMinutes", "holdBelowScore", "shortlistedMinScore", "maxProsBefore", "maxAgeHours", "creditPriceUsd"];
const BOOL = ["pacing", "risingBar", "alwaysBuyShortlisted", "neverOutOfRange", "neverGroupOnly"];

function sanitize(patch) {
  const out = {};
  if (["off", "dryrun", "live"].includes(patch.mode)) out.mode = patch.mode;
  if (["off", "dryrun", "live"].includes(patch.bustMode)) out.bustMode = patch.bustMode;
  if (["score", "value"].includes(patch.rankBy)) out.rankBy = patch.rankBy;
  if (typeof patch.timezone === "string" && patch.timezone.length < 64) out.timezone = patch.timezone;
  if (Array.isArray(patch.days)) out.days = patch.days.map(Number).filter(d => d >= 0 && d <= 6);
  for (const k of NUM) if (patch[k] !== undefined && isFinite(+patch[k]) && +patch[k] >= 0) out[k] = +patch[k];
  for (const k of BOOL) if (patch[k] !== undefined) out[k] = !!patch[k];
  return out;
}

async function getSettings() {
  return { ...DEFAULTS, ...((await store.getJSON("bb:settings")) || {}) };
}

async function saveSettings(patch, by = "unknown") {
  const clean = sanitize(patch);
  const current = await getSettings();
  const next = { ...current, ...clean };
  if (clean.mode && clean.mode !== "off") next.pausedReason = ""; // turning back on clears a pause
  await store.setJSON("bb:settings", next);
  const changed = Object.keys(clean).filter(k => JSON.stringify(clean[k]) !== JSON.stringify(current[k]));
  if (changed.length) {
    await store.pushLog("bb:changes", { at: new Date().toISOString(), by, changes: Object.fromEntries(changed.map(k => [k, clean[k]])) }, 200);
  }
  return next;
}

async function pause(reason, which = "mode") {
  const s = await getSettings();
  s[which] = "off";
  s.pausedReason = reason;
  await store.setJSON("bb:settings", s);
  await store.pushLog("bb:changes", { at: new Date().toISOString(), by: "auto-buyer", changes: { [which]: "off", pausedReason: reason } }, 200);
}

module.exports = { DEFAULTS, getSettings, saveSettings, pause, sanitize };

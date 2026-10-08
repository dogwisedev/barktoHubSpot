// lib/autoRules.js — pure decision logic for the auto-buyer. No I/O, so it's easy to test.

/** Local clock in the business timezone. */
function clock(tz, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23"
  }).formatToParts(now).map(p => [p.type, p.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, dow, minutes: +parts.hour * 60 + +parts.minute };
}

function groupOnly(qa) {
  const k = Object.keys(qa || {}).find(q => /type\(s\) of training|training would you consider/i.test(q));
  if (!k) return false;
  const a = qa[k].toLowerCase();
  return /group/.test(a) && !/private|board|other/.test(a);
}

/** Order leads best first. */
function rank(items, rankBy) {
  const key = (x) => rankBy === "value" && x.L.credits ? x.res.score / x.L.credits : x.res.score;
  return items.sort((a, b) => key(b) - key(a) || (a.L.responses ?? 9) - (b.L.responses ?? 9) || (a.L.ageMinutes ?? 1e9) - (b.L.ageMinutes ?? 1e9));
}

/** Score needed right now: climbs once the day's budget is mostly spent. */
function currentBar(s, spent) {
  if (!s.risingBar || !s.dailyCreditCap) return s.buyAbove;
  const frac = spent / s.dailyCreditCap, start = s.risingStartPct / 100;
  if (frac <= start) return s.buyAbove;
  return Math.round(s.buyAbove + (Math.max(s.risingMaxScore, s.buyAbove) - s.buyAbove) * Math.min(1, (frac - start) / (1 - start)));
}

/**
 * @param x    { L, res, enrich, dup }
 * @param s    settings
 * @param day  { credits, leads }  spent so far today (live or dry, matching mode)
 * @param clk  clock() result
 * @returns    { action: "BUY"|"LEAVE", reason, bar }
 */
function decide(x, s, day, clk) {
  const { L, res, enrich, dup } = x;
  const leave = (reason) => ({ action: "LEAVE", reason });

  if (s.mode === "off") return leave("Auto-buy off");
  if (dup?.level === "strong") return leave("Duplicate: already in HubSpot");
  if (dup?.level === "weak") return leave("Possible duplicate: check by hand");
  if (dup?.level === "error") return leave("Duplicate check failed: not buying blind");
  if (L.credits == null || L.responses == null) return leave("Lead data incomplete");
  if (L.responses >= (L.cap || 5)) return leave("Sold out on Bark");

  if (!s.days.includes(clk.dow)) return leave("Not a buying day");
  if (clk.minutes < s.hourFrom * 60 || clk.minutes >= s.hourTo * 60) return leave(`Outside buying hours (${s.hourFrom}:00–${s.hourTo}:00)`);

  const t = enrich.trainer;
  if (s.neverOutOfRange && (!t || t.ratio > 1)) return leave(t ? `Out of range: ${t.distance} mi to ${t.name.split(" ")[0]}` : "No trainer location match");
  if (s.neverGroupOnly && groupOnly(L.qa)) return leave("Group classes only");
  if (L.responses > s.maxProsBefore) return leave(`${L.responses} pros already bought it`);
  if (s.maxAgeHours && L.ageMinutes != null && L.ageMinutes > s.maxAgeHours * 60) return leave(`Older than ${s.maxAgeHours}h`);
  if (L.credits > s.maxCreditsPerLead) return leave(`${L.credits} credits, max is ${s.maxCreditsPerLead}`);
  if (day.leads >= s.dailyLeadCap) return leave(`Daily lead cap reached (${s.dailyLeadCap})`);
  if (day.credits + L.credits > s.dailyCreditCap) return leave(`Daily credit cap: ${day.credits}/${s.dailyCreditCap} used`);

  const priority = s.alwaysBuyShortlisted && L.badges?.shortlisted && res.score >= s.shortlistedMinScore;
  const bar = currentBar(s, day.credits);

  if (!priority) {
    if (res.score < bar) return leave(bar > s.buyAbove ? `Score ${res.score}, bar raised to ${bar} (budget ${Math.round(day.credits / s.dailyCreditCap * 100)}% used)` : `Score ${res.score} below ${bar}`);
    if (s.holdMinutes > 0 && res.score < s.holdBelowScore && L.ageMinutes != null && L.ageMinutes < s.holdMinutes) {
      return leave(`Holding: buys after ${s.holdMinutes} min if still the best`);
    }
    if (s.pacing && s.dailyCreditCap) {
      const span = (s.hourTo - s.hourFrom) * 60;
      const elapsed = Math.min(1, Math.max(0, (clk.minutes - s.hourFrom * 60) / span));
      const allowed = s.dailyCreditCap * Math.min(1, elapsed + s.pacingBurstPct / 100);
      if (day.credits + L.credits > allowed) return leave(`Pacing: ${day.credits} of ${Math.round(allowed)} credits allowed so far today`);
    }
  }

  return { action: "BUY", reason: priority ? `Asked for you, score ${res.score}` : `Score ${res.score}, ${L.credits} credits`, bar };
}

module.exports = { decide, rank, clock, currentBar, groupOnly };

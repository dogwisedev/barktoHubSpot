// lib/tick.js
// One auto-buyer round. Called every minute by Vercel cron (and by "Run now" in the popup).
//   1. List open Barks  2. Score all + duplicate check  3. Bust strong duplicates (free)
//   4. Rank the rest best-first and buy down the list until a limit is hit.

const store = require("./store");
const { listBarks, purchaseBark } = require("./bark");
const { updateDealProperties, addNoteToDeal, addHighPriorityTaskToDeal } = require("./hubspot");
const { buildResubmissionNote } = require("./parseBarkQA");
const { NEW_LEADS_STAGE_ID } = require("./constants");
const { getSettings, pause } = require("./autoSettings");
const { decide, rank, clock } = require("./autoRules");
const { checkDuplicateCached } = require("./dupCheck");
const { medianIncome } = require("./census");
const { normalize, scoreNormalized, toProps } = require("./intel/barkLead");

const DAY_TTL = 3 * 86400, FINAL_TTL = 30 * 86400;
const sig = (reason) => String(reason || "").replace(/\d+/g, "#"); // log a lead again only when its reason *type* changes

async function bustDeal(x) {
  const { L, res, enrich, dup } = x;
  await updateDealProperties(dup.dealId, { dealstage: NEW_LEADS_STAGE_ID, bark_busted: "Yes" });
  const head = [
    "Auto-busted by Bark Buster: not bought on Bark, no credits spent.",
    `Lead score: ${res.score}/100`,
    res.pros.length ? `+ ${res.pros.join(" | ")}` : "",
    res.cons.length ? `− ${res.cons.join(" | ")}` : "",
    res.flags.length ? `! ${res.flags.join(" | ")}` : "",
    ""
  ].filter(Boolean).join("\n");
  await addNoteToDeal(dup.dealId, head + "\n" + buildResubmissionNote({
    category: "Dog Training", location: L.place, barkId: L.id, qa: L.qa, isResubmission: true
  }));
  await addHighPriorityTaskToDeal(dup.dealId, "Bark Buster: resubmitted lead — follow up ASAP",
    "This lead resubmitted on Bark and Bark Buster matched it to this deal automatically. Follow up while it's hot.");
  await updateDealProperties(dup.dealId, toProps(res, enrich, L)).catch(e => console.warn(`[bust] intel: ${e.message}`));
}

function summary(x) {
  const t = x.enrich.trainer;
  return {
    id: x.L.id, name: x.L.fullName, place: x.L.place, url: x.L.url,
    score: x.res.score, verdict: x.res.verdict, credits: x.L.credits, responses: x.L.responses,
    ageMin: x.L.ageMinutes != null ? Math.round(x.L.ageMinutes) : null, shortlisted: !!x.L.badges.shortlisted,
    trainer: t ? `${t.name} ${t.distance}/${t.range} mi` : null,
    dup: x.dup?.level || "none", dupDeal: x.dup?.dealName || null, dupStage: x.dup?.stageLabel || null,
    action: x.decision?.action || "LEAVE", reason: x.decision?.reason || "",
    pros: x.res.pros, cons: x.res.cons, flags: x.res.flags
  };
}

async function tick({ trigger = "cron" } = {}) {
  const s = await getSettings();
  if (s.mode === "off" && s.bustMode === "off" && trigger === "cron") return { skipped: "Auto-buy and auto-bust are both off" };

  if (!(await store.setNX("bb:lock", trigger, 55))) return { skipped: "Previous round still running" };
  const out = { at: new Date().toISOString(), trigger, seen: 0, bought: 0, wouldBuy: 0, busted: 0, wouldBust: 0, errors: [] };

  try {
    const leads = (await listBarks()).map(normalize).filter(L => L.id);
    out.seen = leads.length;
    const ids = leads.map(L => L.id);
    const [finals, dryBuys, dryBusts, seen] = await Promise.all([
      store.mgetJSON(ids.map(id => `bb:final:${id}`)),
      store.mgetJSON(ids.map(id => `bb:drybuy:${id}`)),
      store.mgetJSON(ids.map(id => `bb:drybust:${id}`)),
      store.mgetJSON(ids.map(id => `bb:seen:${id}`))
    ]);
    const idx = Object.fromEntries(ids.map((id, i) => [id, i]));

    const clk = clock(s.timezone);
    const dayKey = `bb:day:${clk.day}`;
    const day = await store.hgetall(dayKey);

    // Score everything + duplicate check
    const items = [];
    for (const L of leads) {
      if (finals[idx[L.id]]) continue; // already bought or busted
      let dup;
      try { dup = await checkDuplicateCached(L); } catch (e) { dup = { level: "error", error: e.message }; }
      const income = await medianIncome(L.zip);
      const { res, enrich } = scoreNormalized(L, { medianIncome: income, duplicate: dup.level === "strong" ? { found: true } : null },
        { creditPriceUsd: s.creditPriceUsd });
      items.push({ L, res, enrich, dup });
    }

    // 1. BUST strong duplicates (free)
    for (const x of items.filter(x => x.dup.level === "strong")) {
      if (s.bustMode === "off") { x.decision = { action: "LEAVE", reason: "Duplicate: auto-bust is off" }; continue; }
      if (x.dup.isWon) { x.decision = { action: "LEAVE", reason: `Duplicate of a ${x.dup.stageLabel} deal: check by hand` }; continue; }
      if (s.bustMode === "dryrun") {
        x.decision = { action: "BUST", reason: `Dry run: would bust "${x.dup.dealName}"` };
        if (!dryBusts[idx[x.L.id]]) {
          await store.setJSON(`bb:drybust:${x.L.id}`, { at: out.at }, FINAL_TTL);
          await store.hincr(dayKey, "dryBusted", 1, DAY_TTL);
          await store.pushLog("bb:log", { at: out.at, type: "WOULD_BUST", ...summary(x) });
          out.wouldBust++;
        }
        continue;
      }
      if ((await getSettings()).bustMode !== "live") break; // switched off mid-round
      try {
        await bustDeal(x);
        x.decision = { action: "BUST", reason: `Busted "${x.dup.dealName}": moved to New Leads` };
        await store.setJSON(`bb:final:${x.L.id}`, { action: "busted", at: out.at, dealId: x.dup.dealId }, FINAL_TTL);
        await store.hincr(dayKey, "busted", 1, DAY_TTL);
        await store.pushLog("bb:log", { at: out.at, type: "BUSTED", ...summary(x) });
        out.busted++;
      } catch (e) {
        x.decision = { action: "LEAVE", reason: `Bust failed: ${e.message}` };
        out.errors.push(e.message);
        await pause(`Bust failed on ${x.L.fullName}: ${e.message}`, "bustMode");
        await store.pushLog("bb:log", { at: out.at, type: "ERROR", ...summary(x) });
        break;
      }
    }

    // 2. BUY best first
    const live = s.mode === "live";
    const spent = { credits: (live ? day.credits : day.dryCredits) || 0, leads: (live ? day.leads : day.dryLeads) || 0 };
    const ranked = rank(items.filter(x => x.dup.level !== "strong"), s.rankBy);

    for (const x of ranked) {
      if (s.mode === "dryrun" && dryBuys[idx[x.L.id]]) { x.decision = { action: "BUY", reason: "Dry run: would have bought (counted)" }; continue; }
      const d = decide(x, s, spent, clk);
      x.decision = d;
      if (d.action !== "BUY") continue;

      if (s.mode === "dryrun") {
        d.reason = `Dry run: would buy. ${d.reason}`;
        await store.setJSON(`bb:drybuy:${x.L.id}`, { at: out.at }, FINAL_TTL);
        await store.hincr(dayKey, "dryCredits", x.L.credits, DAY_TTL);
        await store.hincr(dayKey, "dryLeads", 1, DAY_TTL);
        await store.pushLog("bb:log", { at: out.at, type: "WOULD_BUY", ...summary(x) });
        spent.credits += x.L.credits; spent.leads++; out.wouldBuy++;
        continue;
      }

      // LIVE: kill switch check right before spending
      if ((await getSettings()).mode !== "live") { d.action = "LEAVE"; d.reason = "Stopped"; break; }
      try {
        // Snapshot first, so the webhook finds it even if it fires before we return
        await store.setJSON(`bb:intel:${x.L.id}`, toProps(x.res, x.enrich, x.L, { autoBought: true }), 7 * 86400);
        await purchaseBark(x.L.id);
        await store.setJSON(`bb:final:${x.L.id}`, { action: "bought", at: out.at, credits: x.L.credits }, FINAL_TTL);
        await store.hincr(dayKey, "credits", x.L.credits, DAY_TTL);
        await store.hincr(dayKey, "leads", 1, DAY_TTL);
        await store.pushLog("bb:log", { at: out.at, type: "BOUGHT", ...summary(x) });
        spent.credits += x.L.credits; spent.leads++; out.bought++;
      } catch (e) {
        await store.del(`bb:intel:${x.L.id}`).catch(() => {});
        d.action = "LEAVE"; d.reason = `Purchase failed: ${e.message}`;
        out.errors.push(e.message);
        await pause(`Purchase failed on ${x.L.fullName}: ${e.message}`);
        await store.pushLog("bb:log", { at: out.at, type: "ERROR", ...summary(x) });
        break;
      }
    }

    // 3. Log skips only when a lead's reason type changes (keeps the log readable)
    const seenWrites = [];
    for (const x of items) {
      const r = x.decision?.reason || "";
      const prev = seen[idx[x.L.id]];
      if (x.decision?.action === "LEAVE" && (!prev || prev.sig !== sig(r))) {
        await store.pushLog("bb:log", { at: out.at, type: x.dup.level === "weak" ? "POSSIBLE_DUP" : "SKIP", ...summary(x) });
      }
      seenWrites.push(["SET", `bb:seen:${x.L.id}`, JSON.stringify({ sig: sig(r) }), "EX", 2 * 86400]);
    }
    await store.pipeline(seenWrites);

    // 4. Snapshot for the popup
    const order = [...items.filter(x => x.dup.level === "strong"), ...ranked];
    await store.setJSON("bb:queue", { at: out.at, items: order.map(summary) });
    await store.setJSON("bb:lastTick", out);
    return out;
  } catch (e) {
    out.errors.push(e.message);
    await store.setJSON("bb:lastTick", out).catch(() => {});
    throw e;
  } finally {
    await store.del("bb:lock").catch(() => {});
  }
}

module.exports = { tick };

/**
 * LEAD INTEL → HUBSPOT DEAL PROPERTIES
 * Shared by Bark Buster (browser) and Bark to HubSpot (Node). Pure, no I/O.
 * Property internal names must match the "Lead intel" group in HubSpot.
 */
(function (root) {
  const VERDICT_VALUE = { BUY: "buy", CONSIDER: "consider", SKIP: "skip", CHECK: "check", BUST: "duplicate" };

  /** "B&T Conversion" when the Bark training-types answer doesn't include board & train. */
  function leadTrack(qa) {
    const k = Object.keys(qa || {}).find(q => /type\(s\) of training|training would you consider/i.test(q));
    if (!k) return "standard";
    return /board|residential|stay|live.?in|send.?away/i.test(qa[k]) ? "standard" : "bt_conversion";
  }

  /**
   * @param res     scoreLead() result
   * @param enrich  { trainer, medianIncome, timezone }
   * @param lead    { qa, credits, responses, ageMinutes }
   * @param meta    { autoBought: bool }  (only known in the browser)
   */
  function toDealProperties(res, enrich = {}, lead = {}, meta = {}) {
    const t = enrich.trainer;
    const qa = lead.qa || {};
    const bitten = qa[Object.keys(qa).find(q => /bitten/i.test(q))] || "";
    const p = {
      lead_score: res.score,
      lead_verdict: VERDICT_VALUE[res.verdict],
      lead_score_version: (root.BB_SCORE && root.BB_SCORE.SCORE_VERSION) || "",
      lead_pros: res.pros.join("\n"),
      lead_cons: res.cons.join("\n"),
      lead_flags: res.flags.join("\n"),
      lead_track: leadTrack(qa),
      bite_history: /^yes/i.test(bitten.trim()) ? "true" : "false",
      nearest_trainer: t ? t.name : "",
      trainer_distance_mi: t ? t.distance : "",
      trainer_in_range: t ? String(t.ratio <= 1) : "",
      zip_median_income: enrich.medianIncome || "",
      lead_timezone: enrich.timezone || "",
      bark_credits_paid: lead.credits ?? "",
      bark_pros_before_purchase: lead.responses ?? "",
      bark_lead_age_at_purchase_min: lead.ageMinutes != null ? Math.round(lead.ageMinutes) : ""
    };
    if (meta.autoBought != null) p.auto_bought = String(!!meta.autoBought);
    // Don't overwrite existing HubSpot values with blanks
    for (const k of Object.keys(p)) if (p[k] === "" || p[k] == null) delete p[k];
    return p;
  }

  root.BB_INTEL = { toDealProperties, leadTrack, VERDICT_VALUE };
})(typeof globalThis !== "undefined" ? globalThis : window);

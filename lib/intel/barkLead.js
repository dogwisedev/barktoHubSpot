// lib/intel/barkLead.js
// Bark API "bark" object → the lead shape the shared scoring engine expects, plus enrichment.

require("./trainers.js");
require("./scoring.js");
require("./leadintel.js");
const { BB_GEO, BB_SCORE, BB_INTEL } = globalThis;

const STATE_RE = /,\s*([A-Z]{2})\b/;

function normalize(bark) {
  const md = bark.metadata || {};
  const loc = md.location || {};
  const buyer = bark.entities?.buyer || {};
  const qa = {};
  for (const q of md.questions?.data || []) {
    const a = Array.isArray(q.answer) ? q.answer.map(s => String(s).trim()).join(", ") : String(q.answer ?? "").trim();
    if (q.question && a) qa[q.question.trim()] = a;
  }
  const detailsKey = Object.keys(qa).find(k => /additional details/i.test(k));
  const created = bark.created_at?.date_utc ? Date.parse(bark.created_at.date_utc.replace(" ", "T") + "Z") : NaN;
  const prefersPhone = bark.contact_preferences?.prefers_contact_by_phone;

  return {
    id: String(bark.id),
    firstName: String(buyer.name || buyer.short_name || "").split(" ")[0],
    fullName: buyer.name || buyer.short_name || "",
    zip: String(loc.postcode || "").slice(0, 5),
    state: (String(loc.name || "").match(STATE_RE) || [])[1] || null,
    place: loc.name || "",
    lat: loc.latitude != null ? parseFloat(loc.latitude) : null,
    lon: loc.longitude != null ? parseFloat(loc.longitude) : null,
    maskedEmail: buyer.email || "",
    maskedPhone: buyer.telephone || "",
    phonePrefix: (String(buyer.telephone || "").match(/\((\d{3})\)/) || [])[1] || "",
    qa,
    details: detailsKey ? qa[detailsKey] : (Object.keys(qa).length ? "" : null),
    breed: qa[Object.keys(qa).find(k => /breed/i.test(k))] || "",
    credits: bark.credits_required ?? null,
    responses: bark.purchased_count ?? null,
    cap: bark.purchase_cap ?? 5,
    ageMinutes: isNaN(created) ? null : Math.max(0, (Date.now() - created) / 60000),
    badges: {
      urgent: !!bark.is_urgent,
      topOpportunity: !!bark.is_top_opportunity,
      shortlisted: !!bark.interactions?.is_shortlisted,
      verifiedPhone: null // only visible on the Bark page
    },
    callsAllowed: null, // Bark's contact_preferences are all false on most leads; not reliable enough to score yet
    url: bark.display?.url || ""
  };
}

/** Score a normalized lead. enrichExtra: { medianIncome, duplicate } */
function scoreNormalized(L, enrichExtra = {}, cfg = {}) {
  const near = L.lat != null ? BB_GEO.nearestTrainers(L.lat, L.lon, 3) : [];
  const enrich = {
    trainer: near[0],
    inRangeCount: near.filter(t => t.inRange).length,
    medianIncome: enrichExtra.medianIncome || null,
    local: L.state ? BB_GEO.localTime(L.state) : null,
    timezone: L.state ? BB_GEO.STATE_TZ[L.state] || null : null,
    duplicate: enrichExtra.duplicate || null
  };
  const res = BB_SCORE.scoreLead({
    firstName: L.firstName, credits: L.credits, responses: L.responses, ageMinutes: L.ageMinutes,
    details: L.details, qa: L.qa, badges: L.badges, callsAllowed: L.callsAllowed
  }, enrich, cfg);
  return { res, enrich, near };
}

const toProps = (res, enrich, L, meta) => BB_INTEL.toDealProperties(res, enrich, L, meta);

module.exports = { normalize, scoreNormalized, toProps, SCORE_VERSION: BB_SCORE.SCORE_VERSION };

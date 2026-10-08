// lib/dupCheck.js
// Pre-purchase duplicate check against HubSpot, using what Bark shows before purchase:
// first name + ZIP (deal name), then masked phone area code, masked email pattern, breed.
//   strong → same person (safe to auto-bust)   weak → name + ZIP only (human checks)   none

const store = require("./store");
const { searchDealsByNameZip, getFirstContactForDeal, getStageLabels } = require("./hubspot");

const BREED_ALIASES = {
  "gsd": "german shepherd", "golden": "golden retriever", "lab": "labrador", "labrador retriever": "labrador",
  "doodle": "goldendoodle", "aussie": "australian shepherd", "frenchie": "french bulldog",
  "pit": "pit bull", "pitbull": "pit bull", "pit bull terrier": "pit bull"
};
const normBreed = (r) => { const l = String(r || "").toLowerCase().trim().replace(/\bshe+p+h?[ae]+r+d\b/g, "shepherd"); return BREED_ALIASES[l] || l; };
const breedsMatch = (a, b) => { if (!a || !b) return false; a = normBreed(a); b = normBreed(b); return a === b || a.includes(b) || b.includes(a); };
const digits = (p) => { let d = String(p || "").replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };

/** "l***********n@y***o.com" matches "lisajohnson@yahoo.com": visible characters fixed, each run of * = 1+ chars. */
function maskedEmailMatch(masked, real) {
  if (!masked || !real || !masked.includes("*")) return null;
  const re = new RegExp("^" + masked.toLowerCase().split(/\*+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+") + "$");
  return re.test(real.toLowerCase());
}

async function stageLabels() {
  const cached = await store.getJSON("bb:stages").catch(() => null);
  if (cached) return cached;
  const map = await getStageLabels();
  await store.setJSON("bb:stages", map, 12 * 3600).catch(() => {});
  return map;
}

async function checkDuplicate(L) {
  if (!L.firstName || !L.zip) return { level: "none" };
  const deals = await searchDealsByNameZip(L.firstName, L.zip);
  if (!deals.length) return { level: "none" };

  const deal = deals[0];
  const p = deal.properties || {};
  const contact = await getFirstContactForDeal(deal.id).catch(() => null);
  const cp = contact?.properties || {};
  const phone = digits(cp.phone || cp.mobilephone);

  const signals = [];
  if (L.phonePrefix) signals.push({ label: "Area code", ok: !!phone && phone.startsWith(L.phonePrefix) });
  if (L.maskedEmail) signals.push({ label: "Email", ok: !!maskedEmailMatch(L.maskedEmail, cp.email) });
  if (L.breed) signals.push({ label: "Breed", ok: breedsMatch(L.breed, p.what_is_the_breed_of_the_dog_s__) });
  const matched = signals.filter(s => s.ok).length;

  const labels = await stageLabels().catch(() => ({}));
  const stageLabel = labels[p.dealstage] || p.dealstage || "";

  return {
    level: matched >= 2 ? "strong" : "weak",
    dealId: deal.id,
    dealName: p.dealname || "",
    stageLabel,
    isWon: /won/i.test(stageLabel),
    signals,
    matched
  };
}

/** Cached per Bark ID for 6h — a lead's identity doesn't change while it sits in the list. */
async function checkDuplicateCached(L) {
  const key = `bb:dup:${L.id}`;
  const cached = await store.getJSON(key).catch(() => null);
  if (cached) return cached;
  const result = await checkDuplicate(L);
  await store.setJSON(key, result, 6 * 3600).catch(() => {});
  return result;
}

module.exports = { checkDuplicate, checkDuplicateCached, maskedEmailMatch };

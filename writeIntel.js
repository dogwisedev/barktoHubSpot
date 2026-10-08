// lib/intel/writeIntel.js
// Writes the "Lead intel" deal properties after a purchase.
// Auto-buys: uses the snapshot the auto-buyer saved at the moment of purchase (pre-purchase numbers, auto_bought = true).
// Manual buys: scores the purchased bark itself.
// Never throws: a missing HubSpot property must not break deal creation.

const store = require("../store");
const { updateDealProperties } = require("../hubspot");
const { medianIncome } = require("../census");
const { normalize, scoreNormalized, toProps } = require("./barkLead");
const { ensureTrainers } = require("./liveTrainers");

async function writeIntel(dealId, bark, { isResubmission = false } = {}) {
  try {
    let properties = store.configured() ? await store.getJSON(`bb:intel:${bark.id}`).catch(() => null) : null;

    if (!properties) {
      await ensureTrainers();
      const L = normalize(bark);
      // purchased_count in a purchase payload likely includes our own purchase — record pros *before* us.
      if (L.responses != null) L.responses = Math.max(0, L.responses - 1);
      const income = await medianIncome(L.zip);
      const { res, enrich } = scoreNormalized(L, { medianIncome: income, duplicate: isResubmission ? { found: true } : null });
      properties = toProps(res, enrich, L, { autoBought: false });
    }

    await updateDealProperties(dealId, properties);
    return { written: Object.keys(properties).length };
  } catch (err) {
    console.warn(`[lead-intel] deal ${dealId}: ${err.message}`);
    return { error: err.message };
  }
}

module.exports = { writeIntel };

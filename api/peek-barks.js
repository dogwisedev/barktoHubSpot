// api/peek-barks.js
// READ-ONLY. Lists open Barks via the API and shows every field Bark gives us
// BEFORE purchase. Never calls purchaseBark().
//
//   GET /api/peek-barks?secret=YOUR_CRON_SECRET          → field map + first 2 raw items
//   GET /api/peek-barks?secret=YOUR_CRON_SECRET&all=1    → every item raw

const { listBarks } = require("../lib/bark");

// Flatten nested objects into "a.b.c" paths with a sample value, so we can see the full shape.
function fieldMap(obj, prefix = "", out = {}) {
  if (obj === null || typeof obj !== "object") {
    out[prefix] = typeof obj === "string" && obj.length > 120 ? obj.slice(0, 120) + "…" : obj;
    return out;
  }
  if (Array.isArray(obj)) {
    out[prefix + "[]"] = `array(${obj.length})`;
    if (obj.length) fieldMap(obj[0], prefix + "[0]", out);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) fieldMap(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

// Quick answer to "can the server score a lead pre-purchase?"
function checklist(item) {
  const flat = JSON.stringify(item).toLowerCase();
  const has = (...words) => words.some(w => flat.includes(w));
  return {
    qaHtml: !!item?.display?.html,
    location: !!item?.metadata?.location,
    credits_or_price: has("credit", "price", "cost"),
    responses_count: has("response", "responded", "contacted", "purchase_count"),
    verified_phone: has("verified"),
    urgent_or_badges: has("urgent", "badge", "highlight", "frequent"),
    posted_time: has("created_at", "posted", "timestamp"),
    buyer_contact_visible: !!(item?.entities?.buyer?.email || item?.entities?.buyer?.telephone)
  };
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).json({ error: "Add ?secret=CRON_SECRET" });

  try {
    const items = await listBarks();
    if (req.query.all) return res.status(200).json({ count: items.length, items });
    return res.status(200).json({
      count: items.length,
      checklist: items[0] ? checklist(items[0]) : null,
      fields: items[0] ? fieldMap(items[0]) : null,
      sample: items.slice(0, 2)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// api/backfill-purchased.js
// Manual, on-demand tool — pulls your N most recent purchases from
// /seller/barks/purchased and runs them through the same logic as the
// webhook. Useful for catching anything bought before the webhook was
// registered, or for re-running a specific page if something failed.
// NOT on a schedule — call this yourself when needed.

const { listPurchasedBarks } = require("../lib/bark");
const { processPurchasedBark } = require("../lib/processPurchasedBark");

module.exports = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const results = [];

  try {
    const purchases = await listPurchasedBarks(page);

    for (const purchase of purchases) {
      const bark = purchase.bark;
      const buyer = bark?.entities?.buyer;

      if (!bark?.id || !buyer?.email) {
        results.push({ action: "skipped-no-buyer-info", barkId: bark?.id });
        continue;
      }

      const buyerInfo = {
        name: buyer.name || buyer.short_name || "",
        email: buyer.email,
        tel: buyer.telephone_formatted || buyer.telephone || "",
      };

      try {
        const result = await processPurchasedBark(bark, buyerInfo);
        results.push({ barkId: bark.id, ...result });
      } catch (innerErr) {
        results.push({ barkId: bark.id, action: "error", error: innerErr.message });
      }
    }

    return res.status(200).json({ success: true, page, processed: results.length, results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

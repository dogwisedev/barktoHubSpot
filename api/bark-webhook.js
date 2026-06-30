// api/bark-webhook.js
// Receives a push notification from Bark the instant a Bark is purchased
// (event: new.purchased_bark) — no polling, no purchase call from us.
//
// NOTE: Bark's documentation doesn't specify the exact webhook payload
// shape. This handles the most likely shapes defensively:
//   - the raw "purchased item" shape from /seller/barks/purchased
//     (a { bark: {...}, created_at, quote, note, last_message } wrapper), or
//   - the bark object directly (flat), with entities.buyer already unmasked.
// If neither matches, it logs the raw payload in the response so we can see
// exactly what Bark actually sent and adjust.

const { processPurchasedBark } = require("../lib/processPurchasedBark");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Expected POST from Bark's webhook system" });
  }

  const payload = req.body || {};

  // Try the wrapped shape first (bark nested under `bark`), then flat.
  const bark = payload.bark || payload;
  const buyer = bark?.entities?.buyer;

  if (!bark?.id || !buyer?.email) {
    // Don't guess further — surface exactly what we got so we can adjust.
    return res.status(400).json({
      error: "Unrecognized webhook payload shape — could not find bark.id and buyer.email",
      receivedPayload: payload,
    });
  }

  const buyerInfo = {
    name: buyer.name || buyer.short_name || "",
    email: buyer.email,
    tel: buyer.telephone_formatted || buyer.telephone || "",
  };

  try {
    const result = await processPurchasedBark(bark, buyerInfo);
    return res.status(200).json({ success: true, barkId: bark.id, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, barkId: bark.id, error: err.message });
  }
};

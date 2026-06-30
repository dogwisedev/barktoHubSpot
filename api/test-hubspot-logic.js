// api/test-hubspot-logic.js
// SAFE TEST ENDPOINT — does NOT call Bark, does NOT purchase anything.
// Uses the exact same processPurchasedBark logic as the real webhook, just
// fed with fake/manual data instead of a real Bark payload.
//
// Usage: POST to /api/test-hubspot-logic with a JSON body like:
// {
//   "email": "your-test-contact@example.com",
//   "name": "Test Person",
//   "tel": "5551234567",
//   "locationName": "Austin, TX",
//   "barkId": "TEST-001",
//   "categoryName": "Dog Training",
//   "qaHtml": "<h3>What is the breed(s) of the dog(s)?</h3><p>Labrador</p>"
// }
// Only "email" is required — everything else has safe fallbacks.

const { processPurchasedBark } = require("../lib/processPurchasedBark");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST with a JSON body — see comments in this file for the shape." });
  }

  const body = req.body || {};
  if (!body.email) {
    return res.status(400).json({ error: "email is required in the request body" });
  }

  const fakeBark = {
    id: body.barkId || "TEST-" + Date.now(),
    display: { html: body.qaHtml || "" },
    metadata: {
      category: { name: body.categoryName || "Test Service" },
      location: { name: body.locationName || "Test City, TS" },
    },
  };
  const buyerInfo = {
    name: body.name || "Test Person",
    email: body.email,
    tel: body.tel || "5550000000",
  };

  try {
    const result = await processPurchasedBark(fakeBark, buyerInfo);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// api/setup-webhook.js
// Run this ONCE (manually, by visiting the URL) to register our webhook
// endpoint with Bark for the "new.purchased_bark" event. After this
// succeeds, Bark will push to /api/bark-webhook automatically — this
// endpoint doesn't need to be called again unless the subscription is lost.

const { subscribeWebhook, listWebhookSubscriptions } = require("../lib/bark");

module.exports = async (req, res) => {
  try {
    // GET just shows current subscriptions, for checking without registering again.
    if (req.method === "GET") {
      const subs = await listWebhookSubscriptions();
      return res.status(200).json({ currentSubscriptions: subs });
    }

    if (req.method === "POST") {
      const webhookUrl = `https://${req.headers.host}/api/bark-webhook`;
      const result = await subscribeWebhook(webhookUrl, "new.purchased_bark");
      return res.status(200).json({ success: true, subscribedUrl: webhookUrl, result });
    }

    return res.status(405).json({ error: "Use GET to check subscriptions, POST to register the webhook." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

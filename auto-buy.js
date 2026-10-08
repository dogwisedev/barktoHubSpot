// api/auto-buy.js
// Runs one auto-buy / auto-bust round.
//   Vercel cron: every minute (vercel.json), authenticated with CRON_SECRET automatically.
//   "Run now" from the Bark Buster popup: POST with the x-bb-key header.

const { isCron, isBB } = require("../lib/auth");
const { tick } = require("../lib/tick");

module.exports = async (req, res) => {
  const cron = isCron(req), manual = isBB(req);
  if (!cron && !manual) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await tick({ trigger: manual ? "manual" : "cron" });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

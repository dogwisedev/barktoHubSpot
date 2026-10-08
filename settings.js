// api/settings.js — read / change auto-buy settings from the Bark Buster popup.
//   GET               → current settings
//   POST { patch, by } → save changes (logged with "by")

const { isBB } = require("../lib/auth");
const { getSettings, saveSettings, DEFAULTS } = require("../lib/autoSettings");

module.exports = async (req, res) => {
  if (!isBB(req)) return res.status(401).json({ error: "Wrong or missing Bark Buster key" });
  try {
    if (req.method === "GET") return res.status(200).json({ settings: await getSettings(), defaults: DEFAULTS });
    if (req.method === "POST") {
      const { patch = {}, by = "unknown" } = req.body || {};
      return res.status(200).json({ settings: await saveSettings(patch, String(by).slice(0, 40)) });
    }
    return res.status(405).json({ error: "GET or POST" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

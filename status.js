// api/status.js — everything the popup shows: switches, today's spend, ranked queue, log, possible duplicates, changes.

const store = require("../lib/store");
const { isBB } = require("../lib/auth");
const { getSettings } = require("../lib/autoSettings");
const { clock } = require("../lib/autoRules");

module.exports = async (req, res) => {
  if (!isBB(req)) return res.status(401).json({ error: "Wrong or missing Bark Buster key" });
  try {
    const settings = await getSettings();
    const clk = clock(settings.timezone);
    const [today, queue, lastTick, log, changes] = await Promise.all([
      store.hgetall(`bb:day:${clk.day}`),
      store.getJSON("bb:queue"),
      store.getJSON("bb:lastTick"),
      store.listJSON("bb:log", 60),
      store.listJSON("bb:changes", 10)
    ]);
    const items = queue?.items || [];
    return res.status(200).json({
      settings, today, lastTick, log, changes,
      queue: { at: queue?.at || null, items },
      possibleDups: items.filter(i => i.dup === "weak" || (i.dup === "strong" && i.action === "LEAVE"))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

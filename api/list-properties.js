// api/list-properties.js
// One-off utility — hit this manually (not on cron) to see your HubSpot's
// actual internal property names before finalizing the mapping in sync-barks.js.
// e.g. GET /api/list-properties?object=deals  or  ?object=contacts

const { listProperties } = require("../lib/hubspot");

module.exports = async (req, res) => {
  const objectType = req.query.object === "deals" ? "deals" : "contacts";

  try {
    const properties = await listProperties(objectType);
    return res.status(200).json({ objectType, count: properties.length, properties });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

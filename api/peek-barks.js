// api/peek-barks.js
// READ-ONLY — calls Bark's GET /seller/barks and returns the raw response.
// Does NOT purchase anything. Purely for inspecting what the API shows
// before vs. after a manual portal purchase.

const { listBarks } = require("../lib/bark");

module.exports = async (req, res) => {
  try {
    const barks = await listBarks();
    return res.status(200).json({ count: barks.length, barks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

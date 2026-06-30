// api/sync-barks.js
// Triggered on a schedule by Vercel Cron (see vercel.json).
//
// Flow: list new Barks -> purchase -> check HubSpot for an existing contact (by email)
//   - EXISTING contact with a deal -> do NOT create a new deal. Update the
//     existing deal's fields (Q&A mapping, location, phone, etc.), add a note
//     explaining the resubmission, and move the deal to "New Leads".
//   - NEW contact (or existing contact with no deal yet) -> create deal,
//     mapped from the Q&A block. Existing HubSpot workflow takes over
//     distribution from there.

const { listBarks, purchaseBark } = require("../lib/bark");
const {
  findContactByEmail,
  findDealsForContact,
  createContact,
  createDeal,
  associateContactToDeal,
  updateDealStage,
  updateDealProperties,
  addNoteToDeal,
} = require("../lib/hubspot");
const { parseBarkQA, mapQAToDealProperties } = require("../lib/parseBarkQA");

// TODO: confirm this is the correct "New Leads" stage ID for your pipeline.
const NEW_LEADS_STAGE_ID = "173324388";
const DEAL_PIPELINE_ID = "94161220"; // carried over from the old Zap — confirm still correct

function splitLocation(locationName) {
  const [city, state] = (locationName || "").split(",").map((s) => (s || "").trim());
  return { city: city || "", state: state || "" };
}

function buildResubmissionNote(bark) {
  const category = bark.metadata?.category?.name || "Unknown service";
  const location = bark.metadata?.location?.name || "Unknown location";
  return [
    "🐾 BARK BUSTER — RESUBMISSION DETECTED",
    "─────────────────────────────────────",
    "Existing contact purchased a new Bark — deal updated, not duplicated.",
    "",
    `Service: ${category}`,
    `Location: ${location}`,
    `Bark ID: ${bark.id}`,
    "",
    "↳ Deal moved to New Leads automatically.",
  ].join("\n");
}

module.exports = async (req, res) => {
  if (
    process.env.CRON_SECRET &&
    req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results = [];

  try {
    const barks = await listBarks();

    for (const bark of barks) {
      try {
        // Buyer email/phone only appears once purchased.
        const purchased = await purchaseBark(bark.id);
        const buyerInfo = purchased.buyerInfo || {};

        const qa = parseBarkQA(bark.display?.html);
        const dealProps = mapQAToDealProperties(qa);
        const { city, state } = splitLocation(bark.metadata?.location?.name);

        const existingContact = await findContactByEmail(buyerInfo.email);

        if (existingContact) {
          const deals = await findDealsForContact(existingContact.id);

          if (deals.length > 0) {
            // Existing contact with at least one deal — update in place, do not
            // create a new deal. Pick the most relevant existing deal.
            const deal = deals[0]; // TODO: confirm tie-break rule if multiple

            await updateDealProperties(deal.id, {
              ...dealProps,
              city,
              state,
            });
            await addNoteToDeal(deal.id, buildResubmissionNote(bark));
            await updateDealStage(deal.id, NEW_LEADS_STAGE_ID);

            results.push({ barkId: bark.id, action: "existing-deal-updated", dealId: deal.id });
          } else {
            // Contact exists but has no deal yet — treat as a fresh lead on that contact.
            const [firstName] = (buyerInfo.name || "").split(" ");
            const newDeal = await createDeal({
              pipeline: DEAL_PIPELINE_ID,
              dealstage: NEW_LEADS_STAGE_ID,
              dealname: `${buyerInfo.name || firstName}, ${bark.metadata?.location?.name || ""}`,
              city,
              state,
              ...dealProps,
            });
            await associateContactToDeal(existingContact.id, newDeal.id);

            results.push({ barkId: bark.id, action: "deal-created-for-existing-contact", dealId: newDeal.id });
          }
        } else {
          // Brand new contact — create contact + deal.
          const [firstName, ...rest] = (buyerInfo.name || "").split(" ");
          const newContact = await createContact({
            email: buyerInfo.email,
            firstname: firstName || "",
            lastname: rest.join(" ") || "",
            phone: buyerInfo.tel || "",
            mobilephone: buyerInfo.tel || "",
          });

          const newDeal = await createDeal({
            pipeline: DEAL_PIPELINE_ID,
            dealstage: NEW_LEADS_STAGE_ID,
            dealname: `${buyerInfo.name || firstName}, ${bark.metadata?.location?.name || ""}`,
            city,
            state,
            ...dealProps,
          });
          await associateContactToDeal(newContact.id, newDeal.id);

          results.push({
            barkId: bark.id,
            action: "created-contact-and-deal",
            contactId: newContact.id,
            dealId: newDeal.id,
          });
        }
      } catch (innerErr) {
        results.push({ barkId: bark.id, action: "error", error: innerErr.message });
      }
    }

    return res.status(200).json({ success: true, processed: results.length, results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

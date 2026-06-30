// api/sync-barks.js
// Triggered on a schedule by Vercel Cron (see vercel.json).
//
// Flow: list new Barks -> purchase -> check HubSpot for an existing contact (by email)
//   - EXISTING contact with a deal -> do NOT create a new deal. Fill in only
//     the EMPTY fields on the existing deal (never overwrite existing data),
//     add a note with the full new info regardless, and move the deal to
//     "New Leads".
//   - EXISTING contact, no deal yet / NEW contact -> create a deal, add the
//     same note, and set lead_source to "Bark" only if it was empty.

const { listBarks, purchaseBark } = require("../lib/bark");
const {
  findContactByEmail,
  findDealsForContact,
  createContact,
  createDeal,
  associateContactToDeal,
  updateDealStage,
  updateDealProperties,
  updateContactProperties,
  getDeal,
  addNoteToDeal,
} = require("../lib/hubspot");
const { parseBarkQA, mapQAToDealProperties, buildResubmissionNote } = require("../lib/parseBarkQA");
const { mergeOnlyEmpty, isEmpty } = require("../lib/mergeOnlyEmpty");

// TODO: confirm this is the correct "New Leads" stage ID for your pipeline.
const NEW_LEADS_STAGE_ID = "173324388";
const DEAL_PIPELINE_ID = "94161220"; // carried over from the old Zap — confirm still correct

function splitLocation(locationName) {
  const [city, state] = (locationName || "").split(",").map((s) => (s || "").trim());
  return { city: city || "", state: state || "" };
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

        const noteBody = buildResubmissionNote({
          category: bark.metadata?.category?.name,
          location: bark.metadata?.location?.name,
          barkId: bark.id,
          qa,
        });

        const existingContact = await findContactByEmail(buyerInfo.email);

        if (existingContact) {
          const deals = await findDealsForContact(existingContact.id);

          if (deals.length > 0) {
            const deal = deals[0]; // most recently touched (sorted in findDealsForContact)

            // Re-fetch the deal's current values for every field we might write,
            // so we only fill in blanks and never clobber existing data.
            const candidateProps = { ...dealProps, city, state };
            const currentDeal = await getDeal(deal.id, Object.keys(candidateProps));
            const toWrite = mergeOnlyEmpty(currentDeal.properties, candidateProps);

            if (Object.keys(toWrite).length > 0) {
              await updateDealProperties(deal.id, toWrite);
            }
            await addNoteToDeal(deal.id, noteBody);
            await updateDealStage(deal.id, NEW_LEADS_STAGE_ID);

            // lead_source on the contact — only set if currently empty.
            if (isEmpty(existingContact.properties?.lead_source)) {
              await updateContactProperties(existingContact.id, { lead_source: "Bark" });
            }

            results.push({
              barkId: bark.id,
              action: "existing-deal-updated",
              dealId: deal.id,
              fieldsFilled: Object.keys(toWrite),
            });
          } else {
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
            await addNoteToDeal(newDeal.id, noteBody);

            if (isEmpty(existingContact.properties?.lead_source)) {
              await updateContactProperties(existingContact.id, { lead_source: "Bark" });
            }

            results.push({ barkId: bark.id, action: "deal-created-for-existing-contact", dealId: newDeal.id });
          }
        } else {
          const [firstName, ...rest] = (buyerInfo.name || "").split(" ");
          const newContact = await createContact({
            email: buyerInfo.email,
            firstname: firstName || "",
            lastname: rest.join(" ") || "",
            phone: buyerInfo.tel || "",
            mobilephone: buyerInfo.tel || "",
            lead_source: "Bark", // brand new contact — always empty, safe to set directly
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
          await addNoteToDeal(newDeal.id, noteBody);

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

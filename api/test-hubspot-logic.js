// api/test-hubspot-logic.js
// SAFE TEST ENDPOINT — does NOT call Bark, does NOT purchase anything.
// Mirrors the exact logic in api/sync-barks.js so you can verify behavior
// against a real (test) HubSpot contact/deal before relying on the cron.
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

const NEW_LEADS_STAGE_ID = "173324388";
const DEAL_PIPELINE_ID = "94161220";

function splitLocation(locationName) {
  const [city, state] = (locationName || "").split(",").map((s) => (s || "").trim());
  return { city: city || "", state: state || "" };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST with a JSON body — see comments in this file for the shape." });
  }

  const body = req.body || {};
  if (!body.email) {
    return res.status(400).json({ error: "email is required in the request body" });
  }

  const fakeBark = {
    barkId: body.barkId || "TEST-" + Date.now(),
    categoryName: body.categoryName || "Test Service",
    locationName: body.locationName || "Test City, TS",
  };
  const buyerInfo = {
    email: body.email,
    name: body.name || "Test Person",
    tel: body.tel || "5550000000",
  };

  const qa = parseBarkQA(body.qaHtml || "");
  const dealProps = mapQAToDealProperties(qa);
  const { city, state } = splitLocation(fakeBark.locationName);

  const noteBody = buildResubmissionNote({
    category: fakeBark.categoryName,
    location: fakeBark.locationName,
    barkId: fakeBark.barkId,
    qa,
  });

  try {
    const existingContact = await findContactByEmail(buyerInfo.email);

    if (existingContact) {
      const deals = await findDealsForContact(existingContact.id);

      if (deals.length > 0) {
        const deal = deals[0];

        const candidateProps = { ...dealProps, city, state };
        const currentDeal = await getDeal(deal.id, Object.keys(candidateProps));
        const toWrite = mergeOnlyEmpty(currentDeal.properties, candidateProps);

        if (Object.keys(toWrite).length > 0) {
          await updateDealProperties(deal.id, toWrite);
        }
        await addNoteToDeal(deal.id, noteBody);
        await updateDealStage(deal.id, NEW_LEADS_STAGE_ID);

        if (isEmpty(existingContact.properties?.lead_source)) {
          await updateContactProperties(existingContact.id, { lead_source: "Bark" });
        }

        return res.status(200).json({
          success: true,
          action: "existing-deal-updated",
          contactId: existingContact.id,
          dealId: deal.id,
          fieldsFilled: Object.keys(toWrite),
          note: "Check this deal in HubSpot — stage should be New Leads, note attached, only previously-empty fields changed.",
        });
      } else {
        const [firstName] = buyerInfo.name.split(" ");
        const newDeal = await createDeal({
          pipeline: DEAL_PIPELINE_ID,
          dealstage: NEW_LEADS_STAGE_ID,
          dealname: `${buyerInfo.name}, ${fakeBark.locationName}`,
          city,
          state,
          ...dealProps,
        });
        await associateContactToDeal(existingContact.id, newDeal.id);
        await addNoteToDeal(newDeal.id, noteBody);

        if (isEmpty(existingContact.properties?.lead_source)) {
          await updateContactProperties(existingContact.id, { lead_source: "Bark" });
        }

        return res.status(200).json({
          success: true,
          action: "deal-created-for-existing-contact",
          contactId: existingContact.id,
          dealId: newDeal.id,
        });
      }
    } else {
      const [firstName, ...rest] = buyerInfo.name.split(" ");
      const newContact = await createContact({
        email: buyerInfo.email,
        firstname: firstName || "",
        lastname: rest.join(" ") || "",
        phone: buyerInfo.tel || "",
        mobilephone: buyerInfo.tel || "",
        lead_source: "Bark",
      });

      const newDeal = await createDeal({
        pipeline: DEAL_PIPELINE_ID,
        dealstage: NEW_LEADS_STAGE_ID,
        dealname: `${buyerInfo.name}, ${fakeBark.locationName}`,
        city,
        state,
        ...dealProps,
      });
      await associateContactToDeal(newContact.id, newDeal.id);
      await addNoteToDeal(newDeal.id, noteBody);

      return res.status(200).json({
        success: true,
        action: "created-contact-and-deal",
        contactId: newContact.id,
        dealId: newDeal.id,
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

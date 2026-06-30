// lib/processPurchasedBark.js
// Single source of truth for "what do we do with a purchased Bark."
// Used by the real webhook receiver, the manual backfill tool, and the
// safe test endpoint — so all three behave identically.

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
} = require("./hubspot");
const { parseBarkQA, mapQAToDealProperties, buildResubmissionNote } = require("./parseBarkQA");
const { mergeOnlyEmpty, isEmpty } = require("./mergeOnlyEmpty");

const NEW_LEADS_STAGE_ID = "173324388";
const DEAL_PIPELINE_ID = "94161220"; // carried over from the old Zap — confirm still correct

function splitLocation(locationName) {
  const [city, state] = (locationName || "").split(",").map((s) => (s || "").trim());
  return { city: city || "", state: state || "" };
}

// `bark` is the raw Bark object — same shape whether it came from the
// purchased-list endpoint, a webhook payload, or our test fixtures.
// `buyerInfo` is { name, email, tel } — unmasked, real contact info.
async function processPurchasedBark(bark, buyerInfo) {
  const qa = parseBarkQA(bark.display?.html);
  const dealProps = mapQAToDealProperties(qa);
  const { city, state } = splitLocation(bark.metadata?.location?.name);

  const noteBase = {
    category: bark.metadata?.category?.name,
    location: bark.metadata?.location?.name,
    barkId: bark.id,
    qa,
  };

  const existingContact = await findContactByEmail(buyerInfo.email);

  if (existingContact) {
    const deals = await findDealsForContact(existingContact.id);

    if (deals.length > 0) {
      const deal = deals[0]; // most recently touched (sorted in findDealsForContact)

      const candidateProps = { ...dealProps, city, state };
      const currentDeal = await getDeal(deal.id, Object.keys(candidateProps));
      const toWrite = mergeOnlyEmpty(currentDeal.properties, candidateProps);

      if (Object.keys(toWrite).length > 0) {
        await updateDealProperties(deal.id, toWrite);
      }
      await addNoteToDeal(deal.id, buildResubmissionNote({ ...noteBase, isResubmission: true }));
      await updateDealStage(deal.id, NEW_LEADS_STAGE_ID);

      if (isEmpty(existingContact.properties?.lead_source)) {
        await updateContactProperties(existingContact.id, { lead_source: "Bark" });
      }

      return { action: "existing-deal-updated", contactId: existingContact.id, dealId: deal.id, fieldsFilled: Object.keys(toWrite) };
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
      await addNoteToDeal(newDeal.id, buildResubmissionNote({ ...noteBase, isResubmission: false }));

      if (isEmpty(existingContact.properties?.lead_source)) {
        await updateContactProperties(existingContact.id, { lead_source: "Bark" });
      }

      return { action: "deal-created-for-existing-contact", contactId: existingContact.id, dealId: newDeal.id };
    }
  } else {
    const [firstName, ...rest] = (buyerInfo.name || "").split(" ");
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
      dealname: `${buyerInfo.name || firstName}, ${bark.metadata?.location?.name || ""}`,
      city,
      state,
      ...dealProps,
    });
    await associateContactToDeal(newContact.id, newDeal.id);
    await addNoteToDeal(newDeal.id, buildResubmissionNote({ ...noteBase, isResubmission: false }));

    return { action: "created-contact-and-deal", contactId: newContact.id, dealId: newDeal.id };
  }
}

module.exports = { processPurchasedBark };

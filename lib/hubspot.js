// lib/hubspot.js
// All HubSpot calls go through here, using the server-side token only.
// HUBSPOT_TOKEN must be set as a Vercel Environment Variable — never hardcode it.

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const BASE = "https://api.hubapi.com";

function authHeaders() {
  return {
    "Authorization": `Bearer ${HUBSPOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function hsFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HubSpot ${path} failed: ${res.status} ${data.message || res.statusText}`);
  }
  return data;
}

// ── Find a contact by email ─────────────────────────────────────────────────
async function findContactByEmail(email) {
  if (!email) return null;
  const data = await hsFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: "email", operator: "EQ", value: email }],
      }],
      properties: ["email", "firstname", "lastname", "phone", "lead_source"],
      limit: 1,
    }),
  });
  return (data.results && data.results[0]) || null;
}

// ── Find deals associated with a contact ────────────────────────────────────
async function findDealsForContact(contactId) {
  const data = await hsFetch(
    `/crm/v3/objects/contacts/${contactId}/associations/deals`
  );
  const dealIds = (data.results || []).map((d) => d.id);
  if (dealIds.length === 0) return [];

  const deals = await Promise.all(
    dealIds.map((id) =>
      hsFetch(
        `/crm/v3/objects/deals/${id}?properties=dealname,dealstage,closed_lost_reason_new,hs_lastmodifieddate`
      )
    )
  );

  // Most recently touched first — same simple tie-break Bark Buster used
  // (just take the most relevant single deal, no fancy ranking).
  deals.sort((a, b) => {
    const aDate = new Date(a.properties?.hs_lastmodifieddate || 0);
    const bDate = new Date(b.properties?.hs_lastmodifieddate || 0);
    return bDate - aDate;
  });

  return deals;
}

// ── Create a new contact ────────────────────────────────────────────────────
async function createContact(properties) {
  return hsFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
}

// ── Move a deal to a target stage ───────────────────────────────────────────
async function updateDealStage(dealId, dealstageId) {
  return hsFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { dealstage: dealstageId } }),
  });
}

// ── Update arbitrary deal properties (e.g. Q&A fields, location) ───────────
async function updateDealProperties(dealId, properties) {
  return hsFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// ── Create a note and associate it with a deal ──────────────────────────────
async function addNoteToDeal(dealId, noteBody) {
  const note = await hsFetch("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });

  await hsFetch(
    `/crm/v4/objects/note/${note.id}/associations/default/deals/${dealId}`,
    { method: "PUT" }
  );

  return note;
}

// ── Create a HIGH priority task and associate it with a deal ───────────────
async function addHighPriorityTaskToDeal(dealId, subject, body) {
  const task = await hsFetch("/crm/v3/objects/tasks", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_task_subject: subject,
        hs_task_body: body,
        hs_task_priority: "HIGH",
        hs_task_status: "NOT_STARTED",
        hs_task_type: "CALL",
        hs_timestamp: new Date().toISOString(),
      },
    }),
  });

  await hsFetch(
    `/crm/v4/objects/task/${task.id}/associations/default/deals/${dealId}`,
    { method: "PUT" }
  );

  return task;
}

// ── List all properties for an object type (contacts | deals) ──────────────
// Useful one-off lookup to find internal property names before mapping.
async function listProperties(objectType) {
  const data = await hsFetch(`/crm/v3/properties/${objectType}`);
  return (data.results || []).map((p) => ({
    name: p.name,
    label: p.label,
    type: p.type,
    fieldType: p.fieldType,
  }));
}

// ── Fetch a deal with specific properties (for merge-only-empty comparisons) ─
async function getDeal(dealId, propertyNames) {
  const props = propertyNames.join(",");
  return hsFetch(`/crm/v3/objects/deals/${dealId}?properties=${props}`);
}

// ── Update a contact's properties ───────────────────────────────────────────
async function updateContactProperties(contactId, properties) {
  return hsFetch(`/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// ── Create a new deal ────────────────────────────────────────────────────────
async function createDeal(properties) {
  return hsFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
}

// ── Associate a contact with a deal ─────────────────────────────────────────
async function associateContactToDeal(contactId, dealId) {
  return hsFetch(
    `/crm/v4/objects/contact/${contactId}/associations/default/deal/${dealId}`,
    { method: "PUT" }
  );
}

// ── Bark Buster duplicate search: deal name contains first name AND ZIP ─────
async function searchDealsByNameZip(firstName, zip) {
  const data = await hsFetch("/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [
        { propertyName: "dealname", operator: "CONTAINS_TOKEN", value: firstName },
        { propertyName: "dealname", operator: "CONTAINS_TOKEN", value: zip },
      ]}],
      properties: ["dealname", "dealstage", "hubspot_owner_id", "what_is_the_breed_of_the_dog_s__", "closed_lost_reason_new"],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
      limit: 5,
    }),
  });
  return data.results || [];
}

// ── First contact associated with a deal (phone + email live on the contact) ─
async function getFirstContactForDeal(dealId) {
  const assoc = await hsFetch(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
  const id = assoc.results?.[0]?.id;
  if (!id) return null;
  return hsFetch(`/crm/v3/objects/contacts/${id}?properties=phone,mobilephone,email`);
}

// ── Deal stage id → label, across all pipelines ─────────────────────────────
async function getStageLabels() {
  const data = await hsFetch("/crm/v3/pipelines/deals");
  const map = {};
  for (const pl of data.results || []) for (const st of pl.stages || []) map[st.id] = st.label;
  return map;
}

module.exports = {
  searchDealsByNameZip,
  getFirstContactForDeal,
  getStageLabels,
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
  addHighPriorityTaskToDeal,
  listProperties,
};

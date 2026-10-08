// api/stripe-webhook.js
// Replaces Zaps: "Payment Succeeded > Slack" and "Payment Failed > Slack"
//
// Env vars required (Vercel → Settings → Environment Variables, then REDEPLOY):
//   STRIPE_WEBHOOK_SECRET  whsec_... from Sean (webhook signing secret)
//   SLACK_BOT_TOKEN        xoxb-... from the Dogwise Payments app
//   HUBSPOT_TOKEN          existing HubSpot private app token (contacts+deals r/w)
//   STRIPE_SECRET_KEY      OPTIONAL restricted key (Customers: Read) — enables
//                          customer-email fallback when billing email is missing
//
// Stripe webhook events to subscribe: charge.succeeded, charge.failed
//
// Behavior is 1:1 with the Zaps:
//  - find-or-CREATE HubSpot contact by email
//  - Slack message to C05LQT7BPEY (success 🤑 / failed 🛎️ with reason)
//  - find deal via contact's associated deals in pipeline 94161220;
//    if none, CREATE placeholder deal "…merge to correct deal." in
//    pipeline 49587876 / stage 101791104 / owner 451342257
//  - threaded reply: "Deal Owner: X Y" + View in HubSpot link

const crypto = require('crypto');

const SLACK_CHANNEL = 'C05LQT7BPEY';
const HS_PORTAL = '21869370';
const HS_SEARCH_PIPELINE = '94161220';
const HS_CREATE_PIPELINE = '49587876';
const HS_CREATE_STAGE = '101791104';
const HS_CREATE_OWNER = '451342257';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = verifyStripeSignature(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature verification failed:', err.message);
    return res.status(400).send('Invalid signature');
  }

  if (event.type !== 'charge.succeeded' && event.type !== 'charge.failed') {
    return res.status(200).send('Ignored event type');
  }

  // Ack Stripe immediately-ish; do the work, but never let errors cause retries storms
  try {
    await handleCharge(event);
  } catch (err) {
    console.error('Handler error:', err);
    // Still 200 so Stripe doesn't retry forever; error is logged in Vercel
  }
  return res.status(200).send('ok');
};

// Vercel: disable body parsing so we can verify the raw payload
module.exports.config = { api: { bodyParser: false } };

async function handleCharge(event) {
  const charge = event.data.object;
  const success = event.type === 'charge.succeeded';

  // --- Resolve email + name (Zap paths C/D collapsed) ---
  let email = charge.billing_details?.email || charge.receipt_email || null;
  let name = charge.billing_details?.name || null;

  if (!email && charge.customer && process.env.STRIPE_SECRET_KEY) {
    const cust = await stripeGet(`/v1/customers/${charge.customer}`);
    if (cust && !cust.deleted) {
      email = cust.email || email;
      name = name || cust.name;
    }
  }

  const amount = `${(charge.currency || '').toUpperCase()} ${(charge.amount / 100).toFixed(2)}`;

  // --- Slack message #1 (matches Zap formatting) ---
  let text, username, icon;
  if (success) {
    username = 'Successful Payment';
    icon = ':money_mouth_face:';
    text = `*Name:* ${name || 'Unknown'}\n*Email:* ${email || 'Unknown'}\n*Amount Paid:* ${amount}`;
  } else {
    username = 'Failed Payment';
    icon = ':bellhop_bell:';
    const reason = `${charge.outcome?.reason || charge.failure_code || 'unknown'} - ${charge.outcome?.seller_message || charge.failure_message || ''}`;
    text = `*Name:* ${name || 'Unknown'}\n*Email:* ${email || 'Unknown'}\n*Failed Amount Transaction:* ${amount}\n*Reason:* ${reason}`;
  }

  const first = await slackPost({ channel: SLACK_CHANNEL, text, username, icon_emoji: icon, link_names: true, reply_broadcast: true });

  if (!email) {
    await slackPost({
      channel: SLACK_CHANNEL,
      thread_ts: first.ts,
      username: 'Deal',
      icon_emoji: ':hubspot-image:',
      text: 'No email on this charge — could not look up HubSpot contact/deal.'
    });
    return;
  }

  // --- HubSpot: find-or-create contact (Zap contactSearch search_or_write) ---
  const contact = await hsFindOrCreateContact(email, name);

  // --- HubSpot: find deal via contact associations in the sales pipeline;
  //     create placeholder if none (Zap deal_crmSearch search_or_write) ---
  const { deal, created } = await hsFindOrCreateDeal(contact, email, success);

  // --- Owner lookup + threaded reply (Zap get_owner_by_id + Slack #2) ---
  let ownerName = 'Unassigned';
  const ownerId = deal.properties?.hubspot_owner_id;
  if (ownerId) {
    const owner = await hsGet(`/crm/v3/owners/${ownerId}?archived=false`).catch(() => null)
      || await hsGet(`/crm/v3/owners/${ownerId}?archived=true`).catch(() => null);
    if (owner) ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim();
  }

  const dealLink = `https://app.hubspot.com/contacts/${HS_PORTAL}/record/0-3/${deal.id}`;
  await slackPost({
    channel: SLACK_CHANNEL,
    thread_ts: first.ts,
    username: 'Deal',
    icon_emoji: ':hubspot-image:',
    unfurl_links: true,
    text: `*Deal Owner:* ${ownerName}${created ? ' (placeholder deal created)' : ''}\n<${dealLink}|View in Hubspot>`
  });
}

// ---------- HubSpot helpers ----------

async function hsFindOrCreateContact(email, name) {
  const search = await hsPost('/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['email', 'firstname', 'lastname'],
    limit: 1
  });
  if (search.total > 0) return search.results[0];

  return hsPost('/crm/v3/objects/contacts', {
    properties: { email, firstname: name || '' }
  });
}

async function hsFindOrCreateDeal(contact, email, success) {
  // Deals associated to the contact, filtered to the sales pipeline
  const assoc = await hsGet(`/crm/v4/objects/contacts/${contact.id}/associations/deals?limit=100`).catch(() => null);
  const dealIds = (assoc?.results || []).map(r => r.toObjectId);

  if (dealIds.length) {
    const batch = await hsPost('/crm/v3/objects/deals/batch/read', {
      inputs: dealIds.map(id => ({ id: String(id) })),
      properties: ['dealname', 'pipeline', 'dealstage', 'hubspot_owner_id']
    });
    const inPipeline = (batch.results || []).find(d => d.properties.pipeline === HS_SEARCH_PIPELINE);
    if (inPipeline) return { deal: inPipeline, created: false };
  }

  // Placeholder create — names copied verbatim from the Zaps
  const dealname = success
    ? `${email} - Stripe successful payment merge to correct deal.`
    : `${email} - Stripe failed payment merge to correct deal.`;

  const deal = await hsPost('/crm/v3/objects/deals', {
    properties: {
      dealname,
      pipeline: HS_CREATE_PIPELINE,
      dealstage: HS_CREATE_STAGE,
      hubspot_owner_id: HS_CREATE_OWNER
    },
    associations: [{
      to: { id: contact.id },
      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] // deal↔contact
    }]
  });
  return { deal, created: true };
}

async function hsGet(path) {
  const r = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}` }
  });
  if (!r.ok) throw new Error(`HubSpot GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function hsPost(path, body) {
  const r = await fetch(`https://api.hubapi.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`HubSpot POST ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ---------- Slack helper ----------

async function slackPost(payload) {
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return data;
}

// ---------- Stripe helpers ----------

async function stripeGet(path) {
  const r = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  if (!r.ok) { console.error(`Stripe GET ${path}: ${r.status}`); return null; }
  return r.json();
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) throw new Error('Missing signature or secret');
  const parts = Object.fromEntries(sigHeader.split(',').map(kv => kv.split('=')));
  const timestamp = parts.t;
  const expected = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  const provided = parts.v1;
  if (!provided || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    throw new Error('Signature mismatch');
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error('Timestamp outside tolerance');
  }
  return JSON.parse(rawBody);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// lib/bark.js
// Talks to Bark's Personal Client Credentials API.
// BARK_CLIENT_ID / BARK_CLIENT_SECRET must be Vercel Environment Variables.

const BARK_CLIENT_ID = process.env.BARK_CLIENT_ID;
const BARK_CLIENT_SECRET = process.env.BARK_CLIENT_SECRET;
const BARK_BASE = "https://api.bark.com";

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  // Reuse the token until shortly before it expires.
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: BARK_CLIENT_ID,
    client_secret: BARK_CLIENT_SECRET,
  });

  const res = await fetch(`${BARK_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Bark token request failed: ${data.error || res.statusText}`);
  }

  cachedToken = data.access_token;
  // expires_in is in seconds per typical oAuth2 — fall back to 50 min if absent.
  const ttlMs = (data.expires_in ? data.expires_in - 60 : 50 * 60) * 1000;
  cachedTokenExpiry = Date.now() + ttlMs;

  return cachedToken;
}

async function authHeaders() {
  const token = await getAccessToken();
  return {
    Accept: "application/vnd.bark.pub_v1+json",
    Authorization: `Bearer ${token}`,
  };
}

// ── List recent Barks in your service areas ─────────────────────────────────
async function listBarks() {
  const headers = await authHeaders();
  const res = await fetch(`${BARK_BASE}/seller/barks`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bark list failed: ${data.error || res.statusText}`);
  }
  return data.data?.items || [];
}

// ── Purchase a specific Bark ─────────────────────────────────────────────────
async function purchaseBark(barkId) {
  const headers = await authHeaders();
  const res = await fetch(`${BARK_BASE}/seller/bark/${barkId}/purchase`, {
    method: "POST",
    headers,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bark purchase failed: ${data.error || res.statusText}`);
  }
  return data; // includes buyerInfo: { name, email, tel }
}

// ── List your recent purchases (real, unmasked buyer info) ─────────────────
async function listPurchasedBarks(page = 1) {
  const headers = await authHeaders();
  const res = await fetch(`${BARK_BASE}/seller/barks/purchased?page=${page}&per_page=15`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bark purchased-list failed: ${data.error || res.statusText}`);
  }
  return data.data?.items || [];
}

// ── Subscribe to a webhook event (e.g. "new.purchased_bark") ───────────────
async function subscribeWebhook(url, event) {
  const headers = await authHeaders();
  const res = await fetch(`${BARK_BASE}/webhooks`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ url, event }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bark webhook subscribe failed: ${data.error || res.statusText}`);
  }
  return data; // { id: <subscription id> }
}

// ── List current webhook subscriptions ──────────────────────────────────────
async function listWebhookSubscriptions() {
  const headers = await authHeaders();
  const res = await fetch(`${BARK_BASE}/webhooks/list`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Bark webhook list failed: ${data.error || res.statusText}`);
  }
  return data.data || [];
}

module.exports = { listBarks, purchaseBark, listPurchasedBarks, subscribeWebhook, listWebhookSubscriptions };

# Bark Buster — Vercel sync

Replaces the Zapier link between Bark and HubSpot, and the Bark-native
HubSpot OAuth integration (which requests full read/write/delete on
contacts, companies, and deals — broader than needed).

## ⚠️ Rotate your HubSpot token

The old Zap's webhook step had a HubSpot Private App token in plain text.
That token was live in production and has been exposed — rotate it in
HubSpot (Settings → Private Apps → regenerate) before going further,
separately from generating the new scoped token below.

## How it works

1. Vercel Cron hits `/api/sync-barks` every 15 minutes.
2. It lists new Barks via Bark's Personal Client Credentials API.
3. For each one, it purchases the Bark (buyer email/phone is only
   revealed on purchase — Bark's list endpoint doesn't include it).
4. It parses the Bark's Q&A block (HTML) into deal property values.
5. It checks HubSpot for an existing contact by email:
   - **Existing contact with a deal** → does **not** create a new deal.
     Updates the existing deal's fields (Q&A mapping, city/state, phone),
     adds a note explaining the resubmission, and moves the deal to
     "New Leads".
   - **Existing contact, no deal yet** → creates a deal for that contact.
   - **No matching contact** → creates a new contact and a deal for them.

This intentionally diverges from the old Zap, which always created a new
deal and only tagged duplicates as `"Deal Duplicate"` after the fact
(blanking the name rather than reusing the existing deal). The new logic
updates the original deal in place instead.

## Setup

1. **HubSpot Private App**
   Settings → Integrations → Private Apps → Create.
   Grant only what's needed:
   - `crm.objects.contacts.read` / `.write`
   - `crm.objects.deals.read` / `.write`
   Leave delete scopes unchecked. Copy the token into `HUBSPOT_TOKEN`.

2. **Bark credentials**
   From your Bark Account Manager: `BARK_CLIENT_ID`, `BARK_CLIENT_SECRET`.

3. **Confirm the "New Leads" stage ID**
   `NEW_LEADS_STAGE_ID` in `api/sync-barks.js` is currently a placeholder
   carried over from the old extension (`173324388`) — confirm this is
   the correct stage ID for the current pipeline before relying on it.

4. **Confirm property names**
   Hit `/api/list-properties?object=deals` (and `?object=contacts`) once
   deployed, to get the real internal names for any custom properties
   you want to set on contact creation or in the note. Update
   `createContact(...)` in `api/sync-barks.js` accordingly.

5. **Env vars**
   Set `HUBSPOT_TOKEN`, `BARK_CLIENT_ID`, `BARK_CLIENT_SECRET`, and
   (optional) `CRON_SECRET` in Vercel project settings.

## Open questions before going live

- Does Bark have a dispute/refund endpoint for bad leads? Not in the
  current doc — ask the Account Manager if you want to revisit the
  cost-reclaim idea later.
- Sandbox availability — unconfirmed, per the email already sent.
- Which deal to act on if a contact has multiple open deals
  (`findDealsForContact` currently just takes the first one returned).

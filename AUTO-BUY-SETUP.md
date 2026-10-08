# Auto-buy / auto-bust setup

## 1. Redis (stores settings, log, spend)
Vercel → project → Storage → Create → **Upstash Redis** (free) → connect to this project.
It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`). Both namings work.

## 2. Environment variables (Settings → Environment Variables)
| Name | What |
|---|---|
| `CRON_SECRET` | Any long random string. Vercel sends it on every cron call automatically. |
| `BB_KEY` | A different long random string. Paste it into the Bark Buster popup (Setup tab). Only give it to people allowed to spend credits. |
| `CENSUS_KEY` | `0110bfef…` (optional, ZIP income in the score) |

Existing `HUBSPOT_TOKEN`, `BARK_CLIENT_ID`, `BARK_CLIENT_SECRET` stay as they are.

## 3. Deploy
`vercel.json` runs `/api/auto-buy` every minute. Both switches start **Off**, so nothing happens until someone turns them on in the popup.

## 4. HubSpot properties
Create the "Lead intel" deal properties before going live. Missing ones never break deal creation (intel is written separately and failures are only logged).

## Endpoints
| Path | Auth | Does |
|---|---|---|
| `/api/auto-buy` | cron / `x-bb-key` | One round: score all open leads, bust strong duplicates, buy best-first |
| `/api/settings` | `x-bb-key` | GET / POST settings (changes logged with who) |
| `/api/status` | `x-bb-key` | Switches, today's spend, ranked queue, log, possible duplicates |
| `/api/peek-barks` | `?secret=CRON_SECRET` | Read-only raw view of open leads |

## Safety
- Off by default; Dry run logs "would buy / would bust" and counts spend separately.
- Settings re-checked before every single purchase and bust: Stop works mid-round.
- Any purchase or bust error pauses that switch and shows the reason in the popup.
- Never buys duplicates, possible duplicates, or when the duplicate check fails.
- Never auto-busts onto a won deal.
- Webhook is idempotent: Bark retries can't create a fake "resubmission".

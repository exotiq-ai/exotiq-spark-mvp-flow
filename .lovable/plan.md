# Uptime monitor for app.exotiq.ai

A small background job that pings the published app every 5 minutes, detects the kinds of failure that just happened, records each check, and emails you only on **state changes** (up→down and down→up) so your inbox stays quiet during steady operation.

## What it can and can't detect

| Failure type | Detected? | How |
|---|---|---|
| App URL unreachable / 5xx / timeout | ✅ | HTTP status + timeout on the HTML fetch |
| HTML returned but `<div id="root">` missing or empty shell | ✅ | Parse the response body |
| HTML references a JS chunk that 404s (the exact bug from today) | ✅ | Extract every `<script src>` and `<link rel="modulepreload">` from the HTML and HEAD-check each one |
| Service worker serving stale broken bundle to real users | ⚠️ Partial | The monitor sees the freshly served HTML, not what a returning user's SW cached. Real-user JS runtime errors aren't catchable without a headless browser, which we can't run inside an Edge Function. |
| Runtime `TypeError` after the bundle loads | ❌ | Would require a real browser. Not in scope. |

This catches the deploy-bundle-broken category — which is what hit today — plus generic outages. I'll be upfront about that limitation in the email.

## Pieces to build

1. **Edge function `uptime-check`** (no JWT).
   - Fetches `https://app.exotiq.ai` with a 15-second timeout.
   - Verifies HTTP 200, non-empty `<div id="root">`, and that every referenced JS/CSS asset returns 200.
   - Writes the result (status, latency, failure reason) to a new `uptime_checks` table.
   - Compares to the previous check; if status flipped, sends an email via existing `send-transactional-email`.

2. **Database**
   - `uptime_checks` table: `id, checked_at, status (up|down), latency_ms, http_status, failure_reason`.
   - RLS: owner-only read.
   - `uptime_alert_recipients` table: `id, email, active` so you can add/remove recipients later without code changes (seeded with the email you give me).

3. **App email template `uptime-alert`**
   - Two states: "App is DOWN" (red, includes failure reason, http status, time, link to app) and "App is back UP" (green, includes downtime duration).
   - Plain, minimal, brand-consistent.

4. **Schedule**
   - `pg_cron` job every 5 minutes invoking `uptime-check`.

5. **(Optional) Admin view**
   - Tiny page at `/dashboard/admin/uptime` showing the last 100 checks and current status. Owner-only. Skip if you'd rather just get the emails.

## What I need from you before building

- **Alert email address** — where should the up/down emails go? (Just one address, or several?)
- **Cadence** — 5 minutes is the sane default. Slower = cheaper, faster = noisier. OK with 5?
- **Skip the admin page?** — yes/no. The emails alone are enough for most people.

I'll wait for those answers, then build it in one pass.

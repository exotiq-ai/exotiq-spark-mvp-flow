# Rari / FleetCopilot — Independent Health Audit

I ran this from scratch against the live functions, the live database, and production logs from the last hour. I did not assume anything from the earlier external report. The findings below are each backed by a specific check.

## Verdict

**Not healthy. One critical cross-tenant defect is active in production right now.** Rari currently answers every caller as one specific tenant — Drive Exotiq — regardless of who is actually signed in. Several of her data tools are also querying columns that do not exist, so they fail and she reports "no data" instead of an error.

## Critical — cross-tenant identity failure (active in production)

Production logs from the last hour, on a real signed-in session:

```text
[Auth] Bearer token received (27 chars, JWT-like: false)
⚠ Bearer token is not JWT format - trying fallbacks
Using DEMO_USER_ID from env: 99d902d4-...
Auth resolved: method=demo_user_env, teamId=null
Team from DB: c1de6533-... (Drive Exotiq)
✓ get_fleet_vehicles → "You have 55 vehicles"
```

That answer was served from Drive Exotiq's fleet. Every tool call in the log resolved this way. Not one used the real caller's identity.

The cause is a mismatch between two halves that were each built correctly but never connected:

- The **app side works.** `elevenlabs-session` mints a signed per-session token carrying the real `userId` and `teamId`, and `RariVoiceInterface` passes it as the `secret__rari_tool_token` dynamic variable. Logs confirm the correct team is resolved at session start.
- The **agent side does not use it.** The bearer token actually arriving at the tools endpoint is 27 characters and is not a JWT — it is a static shared secret, not the per-session token. The agent's 49 tools are sending a fixed workspace secret in their `Authorization` header instead of `Bearer {{secret__rari_tool_token}}`.

Two compounding faults in `elevenlabs-tools` turn that misconfiguration into silent tenant impersonation instead of a visible error:

1. **Auth fails open.** When the token does not verify, the code explicitly does *not* return 401. It falls through to caller-supplied conversation metadata, then to `DEMO_USER_ID`, then to a hardcoded UUID. There is no path where an unauthenticated call is rejected.
2. **"Any team will do" fallback.** If no team resolves, the function picks the first non-deleted team in the database (`limit 1`, no ordering) and silently inserts the caller into it as a viewer. There are 18 live teams. This writes real `team_members` rows.

There is also a stored `ELEVENLABS_TOOL_SECRET` secret that **no function in the codebase reads** — consistent with the agent holding a static secret the backend was never taught to verify.

### Fix
- Make auth fail closed: verified tool token only. No metadata fallback, no `DEMO_USER_ID`, no hardcoded user. Unverified calls return 401.
- Delete the auto-join-to-first-team block entirely, and the profile auto-create alongside it.
- Accept the static `ELEVENLABS_TOOL_SECRET` as a valid second scheme *only* when the caller also supplies an explicit verified `team_id` — or drop it and require the session token. My recommendation is to require the session token.
- You update the ElevenLabs tool headers to `Bearer {{secret__rari_tool_token}}` (dashboard-side; I cannot write there).
- Audit and remove any `team_members` rows created by the auto-join before locking it down.

## High — tools querying columns that do not exist

`public.customers` has `full_name`. It has no `first_name` and no `last_name` (verified against the live schema). Five sites in `elevenlabs-tools` embed `customers(first_name, last_name)` — lines 1358, 1363, 1640, 1667, 2355, 2384. Each of those queries errors, and the tool returns an empty-but-successful shape. That is exactly the failure mode where Rari says "all payments are up to date" when she simply could not read the table.

Same class of bug elsewhere:
- `rari-message-summary:107` reads `conversation_participants` — the table is `conversation_members`.
- `fleet-copilot-chat:496` reads `vehicle_documents` — the table is `documents`.

Fix: correct all three to the real schema, and make failed lookups return an explicit error field so Rari says "I could not read that" rather than reporting good news.

## High — financial figures that contradict the app

- **Metrics filter on `created_at`.** Six sites filter bookings and revenue by when the booking row was *created*, not by when the rental happens. A booking made in January for an August rental lands in January's revenue. Must use date-range overlap on `start_date` / `end_date`.
- **P&L does not use the real engine.** `fn_vehicle_pnl` exists in the database and powers the Margin tab, but `elevenlabs-tools` never calls it. Rari's P&L answers are computed separately and will not match what you see on screen.
- **The document vault is fake.** Line 1803 returns three hardcoded rows and never queries `documents`.
- **The weather tool invents numbers.** Line 2065 returns `Math.random()` temperature, conditions, humidity, and wind — presented as fact. Removing it, per your earlier call.

## Medium — surface area and hygiene

- **`rari-mcp-server` auth**: `validateAuth` returns `true` when `MCP_SECRET_TOKEN` is unset ("no token configured = open access"). The secret *is* set today, so it is closed right now — but it is one deleted secret away from a fully open database endpoint. Change the default to deny.
- **`rari-enterprise-handlers`**: 803 lines, zero callers anywhere in `src/` or `supabase/`. Decommission and delete.
- **`rari-universal-query` is the model to copy** — it derives identity from the JWT only, refuses unauthenticated calls, and scopes every one of its ~15 queries by `team_id`. Worth mirroring its pattern in `elevenlabs-tools`.
- **Missing index**: no `idx_bookings_team_dates` on `bookings`. Once metrics move to date-overlap windows, every Rari fleet query will need it.
- **Adjacent bug spotted in logs** (not Rari, but Fleet): `check-fleet-alerts` is erroring on every run with Postgres `42P10` — "no unique or exclusion constraint matching the ON CONFLICT specification" — for at least two tenants. Fleet alert notifications are silently not being written. Flagging it; happy to fix in the same pass or separately.

## What is actually healthy

- Session bootstrap (`elevenlabs-session`) correctly resolves user, team, and fleet context, and mints a proper signed token.
- `rari-universal-query` is correctly scoped and correctly authenticated.
- Tool dispatch, request logging, and the `_meta` block are good — the logging is precisely what made this diagnosis possible in minutes.
- Conversation persistence, transcript handling, and the voice UI show no defects.

## Proposed order of work

1. **Stop the bleeding.** Fail-closed auth in `elevenlabs-tools`; delete auto-join and auto-profile-create. Deploy. Rari will correctly refuse calls until step 2 lands — that is the right state versus answering as the wrong tenant.
2. **You reconfigure the ElevenLabs tool headers** to `Bearer {{secret__rari_tool_token}}`, then we confirm a live call logs `authMethod: tool_token` with the real team.
3. **Fix the queries.** All `customers` embeds, `conversation_members`, `documents`; real vault query; remove the weather tool; errors surface as errors.
4. **Fix the money.** Date-overlap windows; route P&L through `fn_vehicle_pnl`; verify one vehicle matches the Margin tab exactly.
5. **Harden.** MCP fail-closed; delete `rari-enterprise-handlers`; add `idx_bookings_team_dates`.
6. **Verify.** Two tenants, same question, disjoint answers. Then "who owes me money" and per-vehicle P&L cross-checked against the UI.
7. **Clean up** any `team_members` rows the auto-join created.

## Technical notes

- Functions touched: `elevenlabs-tools`, `rari-mcp-server`, `rari-message-summary`, `fleet-copilot-chat`; `rari-enterprise-handlers` removed.
- One migration, index only: `CREATE INDEX IF NOT EXISTS idx_bookings_team_dates ON public.bookings (team_id, start_date, end_date);` No RLS changes, no table changes.
- `DEMO_USER_ID` stays as a secret for the demo-login flow but is no longer readable as an auth fallback by the tools endpoint.
- Rollback: redeploy prior function revisions; the index is safe to drop.

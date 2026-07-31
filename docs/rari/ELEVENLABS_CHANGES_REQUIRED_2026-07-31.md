# ElevenLabs Changes Required — Rari / FleetCopilot

**Date:** 2026-07-31
**Owner action required in the ElevenLabs dashboard.** No further code changes are needed on our side — the backend is deployed and hardened. Rari's tools currently return **401** until the steps below are completed.

---

## 0. Why this is needed (one paragraph)

The tools endpoint used to fall back to a hardcoded demo user when it couldn't identify the caller, which meant one tenant could be served another tenant's data. That fallback is gone. The tools endpoint is now **fail-closed**: the only accepted credential is a short-lived, signed, per-session token that our app mints for the logged-in user. ElevenLabs must forward that token on every tool call.

---

## 1. What the app already sends you

When a user starts a voice session, our app calls `elevenlabs-session`, which mints a signed token (HS256, 15-minute expiry, payload = `{ userId, teamId, iat, exp }`) and starts the conversation with these **dynamic variables**:

| Variable | Value |
| --- | --- |
| `secret__rari_tool_token` | The signed per-session tool token (**this is the one that matters**) |
| `user_id` | Supabase user id |
| `team_id` | Tenant/team id (may be absent for users with no team) |
| `user_name` | Display name |
| `current_date`, `current_datetime` | For date reasoning |

`secret__rari_tool_token` uses the `secret__` prefix so ElevenLabs treats it as a secret dynamic variable and allows it in headers.

---

## 2. Required change — tool auth header

For **every** custom tool on agent `agent_0001k9d5pvdwfmvv7aq0mhaexgd6`:

- **HTTP Method:** `POST`
- **URL:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{secret__rari_tool_token}}`   ← **the change**

Remove any of the following if present on the tools (all are now rejected):

- A static `Authorization` bearer using the Supabase anon key or a service key
- An `apikey` header
- Any hardcoded `user_id` / `team_id` / `DEMO_USER_ID` in the body or headers
- Any per-tool "default user" value

If the header is missing, the endpoint returns `401 missing_bearer_token`. If a static (non-JWT) key is sent, it returns `401 token_not_session_token`.

---

## 3. Required change — request body shape

Each tool must send the tool name plus parameters:

```json
{
  "tool_name": "get_fleet_vehicles",
  "parameters": {
    "status": "available",
    "location": "Miami"
  }
}
```

Alternative accepted form: POST to `/elevenlabs-tools/<toolName>` with just the parameters object. A call with no resolvable tool name returns `400 Missing tool name`.

---

## 4. Tools to remove from the agent

- **`getWeatherInfo` — delete it.** It returned randomly generated temperatures (fabricated data) and has been removed from the backend. Any remaining reference in the agent's tool list or system prompt must be deleted.
- Any tool not in the supported list in §5 should be deleted; unknown names will not dispatch.

---

## 5. Supported tool names (exact strings, case-sensitive)

```
get_fleet_vehicles          get_bookings                get_recent_activity
getFleetMetrics             getLocationMetrics          getPaymentSummary
getVehicleDetails           getCustomerProfile          checkAvailability
getRevenueAnalysis          getTopPerformers            searchBookings
getDamageReports            getUpcomingMaintenance      getCustomerLifetimeValue
getVaultDocuments           getDemandForecast           getPricingRecommendation
getFleetPricingOverview     getEventImpact              getVehicleSpecs
getCarJoke                  logFeedback                 featureComingSoon
getVehicleProfitLoss        getFleetProfitLoss          getCompetitorRates
getSeasonalPricing          getFleetInsights            getActionItems
createBooking               updateBooking               sendCustomerMessage
get_vehicle_status          get_todays_schedule         get_booking_by_reference
search_customer             get_open_work_orders        create_booking_hold
```

Suggested approval mode: auto-approve read-only tools; require approval for `createBooking`, `updateBooking`, `sendCustomerMessage`, `create_booking_hold`.

---

## 6. System prompt edits

1. Delete any mention of weather or weather lookups.
2. Delete any mention of sample/demo vehicles (e.g. the old McLaren/Ferrari vault documents) — vault documents now come from the tenant's real records.
3. Add a line: "If a tool returns an authentication error, tell the user their session expired and to reopen Rari from inside the app. Never guess or invent fleet data."
4. Revenue is now reported by rental window (when the rental occurs), not booking creation date — reflect that in any wording about "revenue this month".

---

## 7. MCP server — do not use

The `rari-mcp-server` SSE path is **not** the integration path. Conversational AI agents use webhook custom tools (`elevenlabs-tools`). Remove the Rari MCP server from the agent if it is still attached, so it can't shadow the webhook tools.

---

## 8. Verification steps after the change

1. **Health check (no auth needed):**
   ```bash
   curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools/health
   ```
   Expect: `{"ok":true,"hasToolSecret":true,"authMode":"tool_token_only",...}`

2. **Unauthenticated call must be rejected:**
   ```bash
   curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools \
     -H "Content-Type: application/json" \
     -d '{"tool_name":"get_fleet_vehicles","parameters":{}}'
   ```
   Expect: `401` with `"reason":"missing_bearer_token"`. **A 200 here is a security failure — stop and report it.**

3. **Live session test:** sign in as an Exotiq user, open Rari, ask *"What vehicles do I have available?"* — expect real Exotiq vehicles.

4. **Cross-tenant test:** sign in as a Denver Exotic Rental Cars user, ask the same question — expect Denver vehicles only, with zero overlap with step 3.

5. **Expiry test:** leave a session idle past 15 minutes, then ask a question — Rari should say the session needs restarting rather than returning data.

---

## 9. Failure codes and meanings

| HTTP | `reason` | Meaning / fix |
| --- | --- | --- |
| 401 | `missing_bearer_token` | Header not configured on that tool |
| 401 | `token_not_session_token` | Static key used instead of `{{secret__rari_tool_token}}` |
| 401 | `token_verification_failed` | Token expired or signature mismatch — restart the session |
| 401 | `tool_token_secret_missing` | Server secret unset (our side — contact us) |
| 400 | Missing tool name | Body missing `tool_name` / wrong URL path |

Every response includes a `requestId`; include it when reporting a problem so we can pull the matching edge function log.

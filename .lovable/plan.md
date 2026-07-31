# Rari FleetCopilot — Enterprise Readiness Plan

## What my own audit found

I checked every claim in the external report against this project's actual code and database. The headline: **the report's "committed to the branch" fixes are not in this project yet.** Everything it describes as already fixed is still broken here.

Verified in the current code:

| Claim | Status here |
| --- | --- |
| `customers(first_name, last_name)` embeds broken | Confirmed — 5 sites in `elevenlabs-tools`; the table only has `full_name` |
| Fleet metrics filtered on `created_at` | Confirmed — booking and revenue queries both filter on creation date, not the rental window |
| Vault tool returns fake documents | Confirmed — three hardcoded rows, no `documents` query at all |
| P&L uses maintenance estimates | Confirmed — does not call `fn_vehicle_pnl`, so it contradicts the Margin tab |
| Spoofable identity | Confirmed — falls back to caller-supplied metadata, then env demo user, then a hardcoded UUID; auto-creates profiles and auto-joins the caller to the first team in the database |
| `rari-enterprise-handlers` live and unauthenticated | Confirmed — 803 lines, zero callers anywhere in `src/` or `supabase/` |
| `rari-mcp-server` open when token unset | Confirmed — returns "allowed" when `MCP_SECRET_TOKEN` is missing |
| `rari-message-summary` wrong table | Confirmed — `conversation_participants` does not exist |
| `fleet-copilot-chat` wrong table | Confirmed — `vehicle_documents` does not exist |
| `idx_bookings_team_dates` missing | Confirmed — no such index on `bookings` |
| Frontend already mints the token | Confirmed — `RariVoiceInterface` sets `secret__rari_tool_token` |

The critical consequence: **the pasted Lovable prompt would have made things worse.** "Deploy the repo versions, do not change their code" would have redeployed the broken functions over whatever is live. Since you are merging the branch first, that risk goes away — but the merge must land before any deploy.

## Sequence

### Step 0 — you merge the branch (blocking)
Nothing below runs until the fixed edge functions are actually in this project. I verify the merge landed by re-running the same checks in the table above; if any still fail, that is a merge problem, not a deploy problem, and I stop and report.

### Step 1 — independent verification of the merged code
Not a rubber stamp. For each of the five functions I confirm against the live schema and against how the rest of the app computes the same numbers:
- Every customer embed uses `full_name`.
- Fleet metrics use date-range overlap (`start_date <= windowEnd AND end_date >= windowStart`) and accept the dashboard's `this_week` / `this_month` / `all_time` values.
- P&L calls `fn_vehicle_pnl` with the same arguments the Margin tab uses, and spot-check one vehicle so both surfaces return the same number.
- Vault reads `documents` scoped to `team_id`.
- No remaining path resolves identity from caller-supplied metadata, from a hardcoded UUID, or by joining the caller to an arbitrary team.
- Every tool that reads tenant data is scoped by the token's `team_id`.
- Failed lookups return an error field, never an empty-but-successful shape (this is what produced "all payments are up to date").

Anything the external audit missed gets fixed here before deploy.

### Step 2 — deploy
Deploy `elevenlabs-tools`, `rari-mcp-server`, `rari-message-summary`, `fleet-copilot-chat`, and the `rari-enterprise-handlers` 410 stub. Then fully delete `rari-enterprise-handlers` and drop its entry from `supabase/config.toml`.

### Step 3 — database index
```sql
CREATE INDEX IF NOT EXISTS idx_bookings_team_dates
  ON public.bookings (team_id, start_date, end_date);
```
No RLS changes, no table changes. This is the only migration.

### Step 4 — MCP hardening
Generate a strong random `MCP_SECRET_TOKEN` and confirm `rari-mcp-server` fails closed without it. I will not print the value.

### Step 5 — drop getWeatherInfo
Remove the simulated-weather tool from `elevenlabs-tools` so Rari cannot return invented numbers at all. You detach the matching tool from the ElevenLabs agent (I have no write access to that dashboard).

### Step 6 — post-deploy verification
- Health endpoint reports `hasToolSecret: true`.
- A live tool call from an in-app session logs `authMethod: tool_token` with the real `userId` and `teamId`.
- Cross-tenant check: the same tool called with two different tenants' tokens returns disjoint data.
- The two questions that failed in your transcript — "who owes me money" and per-vehicle P&L — return real figures, and the P&L number matches the Margin tab for the same vehicle.
- A deliberately broken lookup surfaces as an error, not as reassurance.

## Not in this plan
- Dead widget code (`RariWidgetInterface`, `RariWidgetDemo`, the `unpkg.com` CSP entry) — you left this out; easy follow-up whenever.
- Detaching the 5 Cursor tools, enabling `enable_auth`, and detaching the Supabase MCP — all ElevenLabs dashboard actions on your side.
- Next-wave tool coverage (Margin expenses, partner payouts, protection-fee breakdowns, tenant documents, Team Hub) — a separate build once this foundation is verified.

## Technical notes
- Files touched: `supabase/functions/elevenlabs-tools/index.ts` (weather tool removal plus any verification fixes), `supabase/config.toml` (remove the decommissioned function entry).
- One migration, index-only.
- One new secret: `MCP_SECRET_TOKEN`.
- Rollback: the ElevenLabs side is restorable from `docs/rari/backups/` via `rari-agent-admin?op=raw`; the function side is restorable by redeploying the previous revision. The index is safe to drop.

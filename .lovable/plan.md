# Rari ElevenLabs Agent Update — Handoff Doc

The edge-function fixes are already live (status synonyms, overlap dates, smarter tool routing, stale `active` rows reconciled). The remaining work lives **inside the ElevenLabs dashboard** — I can't reach it from here without an API key. Below is what I'll deliver and how you'll apply it.

## What I'll create

A single new file: `RARI_AGENT_CONFIG_UPDATE.md` with three copy-paste blocks:

1. **System prompt diff** — Adds a "Booking Status Vocabulary" section teaching Rari:
   - Real statuses: `confirmed`, `pending`, `completed`, `cancelled` (no `active`)
   - For "what's out today / currently rented / active", call `get_bookings({ date: "today" })` — never `status: "active"`
   - For "upcoming", use `date: "upcoming"`; for date ranges, pass `start_date`/`end_date` and trust overlap semantics
   - Always read back the `interpretation` field from the tool response so the voice answer matches the data window

2. **Updated `get_bookings` tool schema** (JSON) — adds:
   - `date` enum: `today | tomorrow | this_week | upcoming`
   - `status` enum with canonical values **plus** synonyms (`active`, `current`, `rented`, `out`) and a description noting synonyms resolve to confirmed+pending overlapping today
   - Clarified `start_date`/`end_date` description: "any booking overlapping this window"

3. **5-step apply instructions** for the ElevenLabs dashboard:
   1. Open agent → System Prompt → paste the new "Booking Status Vocabulary" section at the end → Save
   2. Tools → `get_bookings` → Replace JSON with the new schema → Save
   3. Test in the dashboard sandbox: "What's out today?" → expect 20 bookings with real customer names
   4. Test: "Show me active rentals" → same 20 (synonym path)
   5. Publish agent

## Answer to your API question

**Yes — with an ElevenLabs API key (Workspace Admin scope) I can fully manage the agent programmatically.** Their Conversational AI REST API exposes:

- `GET/PATCH /v1/convai/agents/:agent_id` — read/update system prompt, first message, voice, model, language
- `GET/POST/PATCH/DELETE /v1/convai/agents/:agent_id/tools` — full CRUD on tool definitions (name, description, JSON schema, webhook URL, auth headers)
- `GET /v1/convai/conversations` — pull transcripts for debugging (exactly the kind you pasted earlier)
- Knowledge base, secrets, and workspace settings endpoints

**How I'd use it going forward:**
- Store the key as `ELEVENLABS_ADMIN_API_KEY` via the secrets tool (separate from the existing `ELEVENLABS_API_KEY` used for voice tokens so we can scope/rotate independently)
- Build a small `supabase/functions/rari-agent-admin/` function with operations like `sync-tools-from-edge`, `update-system-prompt`, `fetch-recent-transcripts`, `diff-agent-config`
- Optionally add a checked-in `rari-agent.config.json` in the repo as the source of truth, with a `sync` script that pushes diffs to ElevenLabs — so agent config is reviewable like code instead of clicked through a dashboard
- For one-offs (like today's fix) I'd just call the API directly from an edge function or a `code--exec` script rather than building UI

Caveat: the key needs **Workspace Admin** permission. A read-only or voice-only key won't let me edit agents/tools.

## Out of scope for this turn
- Any further edge-function changes (already deployed and verified)
- Building the agent-admin function — only if you confirm the API-key path

Approve and I'll write `RARI_AGENT_CONFIG_UPDATE.md` with the exact prompt + tool JSON ready to paste.

# FleetCopilot / Rari — Architecture Review and Modernization Plan

## Short answer

Your voice choice is right. Your plumbing is not.

Staying on ElevenLabs is the correct call — the 2026 ElevenAgents platform gained exactly the things you need (native MCP tools, agent workflows with per-node tool scoping, config-as-code CLI, simulation test suites, Eleven v3 Conversational expressive mode). Switching to OpenAI Realtime would trade a better voice and a working orchestration layer for a system you'd have to hand-build. I recommend against it.

The real problem is that FleetCopilot's brain is duplicated four times:

```text
                     the SAME fleet questions
   ElevenLabs voice ──> elevenlabs-tools      (2,989 lines, 42 tools)
   Text chat        ──> fleet-copilot-chat    (937 lines, its own tool set)
   "Universal"      ──> rari-universal-query  (866 lines, keyword routing)
   MCP              ──> rari-mcp-server       (1,562 lines, 24 tools)
                        = ~6,350 lines, four copies of the same logic
```

Every new feature or tenant behavior has to be written four times, and today they already disagree. That is why it doesn't "update itself as the business grows" — nothing is shared.

## What I found that is actively wrong

- `fleet-copilot-chat` still serves a hardcoded spec sheet for five cars (Ferrari SF90, Aventador, 720S, 911 Turbo S, Chiron). A tenant asking about their own car gets a canned answer or nothing.
- `rari-mcp-server` still returns the mock vault documents ("McLaren 720S Insurance", "Ferrari SF90 Registration") that were already removed from `elevenlabs-tools` — the fabricated-data cleanup only landed on one of the four surfaces.
- `getCarJoke` and `featureComingSoon` are shipped tools. On a live tenant account, "coming soon" is a false affordance and the joke tool burns a turn.
- The tool catalog is 42 names, many overlapping (`get_fleet_vehicles` vs `getVehicleDetails` vs `getFleetPricingOverview`). Large catalogs measurably degrade tool selection; this is the main cause of "Rari picked the wrong tool."

## The proposal: one brain, many mouths

```text
                    ┌──────────────────────────────┐
   ElevenLabs voice │                              │
   In-app text chat │   ONE tool registry          │──> Supabase (RLS, team-scoped)
   Claude / Cursor  │   _shared/fleet-tools/       │
   Future: WhatsApp │   served over MCP + HTTP     │
                    └──────────────────────────────┘
```

One registry file per tool. Adding a tool = one file. It appears automatically in voice, in text chat, and in any MCP client. That is the "grows by itself" property you're asking for — not a worker, a single source of truth.

### Phase 1 — Consolidate (the actual win)

1. Create `supabase/functions/_shared/fleet-tools/` — one module per capability, each exporting name, description, Zod input schema, and a handler that takes `{ userId, teamId, supabase }`.
2. Collapse 42 tools to roughly 12 well-named ones plus one `query_fleet` escape hatch. Merge the vehicle/pricing/revenue variants; delete `getCarJoke`, `featureComingSoon`, `getVehicleSpecs` (or back it by real `vehicles` rows).
3. Rewrite `elevenlabs-tools` and `rari-mcp-server` as thin adapters over the registry (each becomes a few hundred lines). Keep the current fail-closed `RARI_TOOL_TOKEN_SECRET` verification exactly as-is — it moves into shared middleware.
4. Delete `rari-universal-query` (keyword routing is strictly worse than LLM tool selection) and rebuild `fleet-copilot-chat` on the AI SDK against the shared registry.

### Phase 2 — Move ElevenLabs onto MCP

ElevenAgents now supports MCP servers natively with per-tool approval modes. Point the agent at `rari-mcp-server` instead of 42 hand-configured webhook tools. Then adding a tool needs zero dashboard work — new tenants and features light up on deploy. Keep approval required for the write tools (`createBooking`, `updateBooking`, `sendCustomerMessage`, `create_booking_hold`).

Auth stays identical: the MCP connection carries `Authorization: Bearer {{secret__rari_tool_token}}`, so the 15-minute per-session token still scopes every call to one tenant. Note this is the one dashboard change still outstanding from the 2026-07-31 handoff — Rari is 401 until it's made, so we should do the MCP switch in that same sitting rather than wiring webhooks first and MCP later.

### Phase 3 — Agent config as code

Install `@elevenlabs/cli`, commit the agent config under `elevenlabs/` in the repo, and add a CI step that pushes it on merge. Prompt changes, tool scoping, and voice settings become reviewable diffs instead of dashboard drift. This is also what stops the prompt from silently referencing tools that no longer exist.

### Phase 4 — Platform features worth adopting

- **Eleven v3 Conversational / expressive mode** — better turn-taking, fewer interruptions. Direct quality upgrade for a hands-busy operator.
- **Agent workflows with tool scoping** — split into Ops (bookings, availability), Analytics (revenue, P&L), and Actions (writes). Each node sees only its tools, which fixes selection accuracy structurally rather than by prompt-begging.
- **Simulation test suites** — scripted conversations with mocked tool responses, run in CI. This is the missing safety net; today a prompt edit is untested until a customer hits it.
- **Custom guardrails + conversation analysis** — catch fabricated numbers automatically instead of by audit.
- **Knowledge base RAG per tenant** — tenant policies, rates, and SOPs as retrievable documents rather than prompt stuffing.

## Pushback on things you may want

- **Don't move to OpenAI Realtime.** Voice quality regression, you'd rebuild transfer/workflows/analytics yourself, and the tool problem stays identical — it lives in your Supabase layer, not the voice vendor.
- **Don't add a background worker.** Nothing here is long-running; a worker would add a queue and a polling UI to solve a problem you don't have.
- **Don't auto-generate tools from the schema.** Tempting, but it leaks table shape into the model and defeats the team-scoping guarantees you just hardened.

## Sequencing

Phase 1 is the only one that requires real work; Phases 2-4 are largely configuration once the registry exists. Suggested order: Phase 1 (consolidate + delete fabricated data), then Phase 2 in the same session as the pending ElevenLabs auth change, then 3 and 4 incrementally.

## Technical notes

- Registry contract: `{ name, description, inputSchema (Zod), scopes: 'read' | 'write', handler(input, ctx) }` where `ctx = { userId, teamId, supabase }`. No handler ever accepts `team_id` from input.
- `elevenlabs-tools` keeps its current URL and body shape (`{ tool_name, parameters }`) so nothing breaks during migration; MCP is added alongside, then webhooks are removed.
- Deleting `rari-universal-query` requires removing its ElevenLabs webhook tool first.
- Model choice for text chat: latest-generation fast model via the Lovable AI gateway; ElevenLabs agent LLM stays on its own configured model with the cascade timeout at the new 4s default.
- No schema changes. No RLS changes. Existing `RARI_TOOL_TOKEN_SECRET` flow is preserved verbatim.

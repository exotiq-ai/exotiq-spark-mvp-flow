# Rari Phase 1b + Phase 2

## Phase 1b — Fold the universal query into the registry

`rari-universal-query` is the last Rari surface still holding its own logic: 866 lines with its own intent keyword matcher, its own timeframe parser, hardcoded city list (Miami / Scottsdale / LA / NY), and 11 private handlers that re-query the database separately from `executor.ts`. Nothing in `src/` calls it — the only references are old planning docs, `config.toml`, and a legacy deploy script. It is dead weight that can drift away from the shared truth.

What to do:

1. Add one new capability to the shared layer: `ask_fleet` (natural-language question → routed answer), implemented in `_shared/fleet-tools/executor.ts` and declared in `registry.ts` (category `insights`, read-only, params: `question` required, plus optional `timeframe`, `location`).
2. Implement it by intent-routing onto existing executor cases rather than new queries — revenue → existing revenue case, idle → idle-vehicles case, payments → payment summary, and so on. No new SQL, no duplicate handlers.
3. Drop the hardcoded city list; resolve locations from the team's own `vehicles.location` values so it works for every tenant, not just Miami/Scottsdale.
4. Delete `supabase/functions/rari-universal-query/`, remove its `config.toml` entry and `deploy-rari-universal.sh`, and mark the stale root-level docs (`START_HERE_UNIVERSAL_RARI.md`, `RARI_UNIVERSAL_QUERY_SETUP.md`, `MCP_VS_UNIVERSAL_QUERY_GUIDE.md`, `RARI_UNIVERSAL_SOLUTION_SUMMARY.md`) as superseded.
5. Redeploy `elevenlabs-tools`, `rari-mcp-server`, `fleet-copilot-chat` so all three pick up tool #39, and verify identical output from all three surfaces for the same question on two different tenants.

Result: one registry, one executor, one auth path — 39 capabilities, zero surface-local logic.

## Phase 2 — Native MCP in ElevenLabs

Goal was: point the agent at `rari-mcp-server`, let it auto-discover tools, and delete the 42 hand-configured webhook tools.

### The blocker found in the current ElevenLabs docs

ElevenLabs MCP server integrations are **workspace-scoped with static credentials**. The config accepts a Server URL, a Secret Token, and static HTTP headers. Environment variables (`{{system__env_*}}`) resolve per deployment environment, not per conversation, and are supported in URL fields. Per-conversation **dynamic variables are not supported in MCP headers** — that mechanism exists only for webhook tools.

Our whole multi-tenant safety model depends on the per-conversation `secret__rari_tool_token` (HS256, 15-min, `{userId, teamId}`) arriving in the `Authorization` header. A single static token on an MCP server would mean either one shared identity for every tenant — exactly the cross-tenant hole we just closed — or no identity at all.

So a straight swap to native MCP is not currently safe. Three ways forward:

**Option A — Recommended: keep webhooks for voice, ship MCP for everything else.**
Voice keeps the 42 webhook tools (they carry per-session identity), but they stop being 42 hand-maintained configs: generate the ElevenLabs tool definitions from `registry.ts` via the ElevenLabs Agents API and add a sync script so adding a capability updates the agent automatically. `rari-mcp-server` stays as the surface for Claude / ChatGPT / Lovable / any MCP client, where per-user OAuth is possible. Retires the *manual* maintenance of 42 tools without weakening isolation.

**Option B — Per-tenant MCP servers.** Create one ElevenLabs MCP server per tenant, each with its own static tenant-scoped token, bound to a tenant-specific agent. True native MCP, correct isolation, but agent/server count grows with every new tenant and the tokens are long-lived. Only worth it if you want a handful of white-labeled voice agents anyway.

**Option C — Wait.** Keep the current webhook tools as-is and revisit when ElevenLabs supports dynamic variables in MCP headers. Zero work now.

### If Option A is chosen, the work is

1. `scripts/rari/sync-elevenlabs-tools.ts` — reads `FLEET_TOOLS` from `registry.ts`, converts to ElevenLabs webhook-tool definitions (URL, `Authorization: Bearer {{secret__rari_tool_token}}`, body `{tool_name, parameters}`), and creates/updates/deletes tools on the agent via the Agents API so the agent always mirrors the registry exactly.
2. Delete `getWeatherInfo` and any tool no longer in the registry as part of that sync (mutating tools flagged so they can be set to "requires approval").
3. Extend the session token lifetime from 15 min to 60 min, or add silent re-mint, so long voice calls stop failing mid-conversation.
4. Publish the MCP server for external clients: proper `initialize`/`tools/list` already work; add per-user OAuth so Claude/ChatGPT users authenticate as themselves instead of pasting a session token.
5. Regenerate `docs/rari/ELEVENLABS_CHANGES_REQUIRED_*.md` from the sync output so the handoff doc can't drift.

### Technical notes

- No database changes in either phase.
- Phase 1b touches `_shared/fleet-tools/registry.ts`, `_shared/fleet-tools/executor.ts`, deletes `rari-universal-query`, edits `supabase/config.toml`, redeploys three functions.
- Auth path is unchanged and stays fail-closed; `ask_fleet` inherits the same team scoping as every other tool.

## Question before Phase 2

Phase 1b is unconditional — I'll do it either way. For Phase 2, tell me A, B, or C. My recommendation is A: it gets you the "registry updates itself as the business grows" outcome you asked for, without reopening cross-tenant exposure on the voice surface.

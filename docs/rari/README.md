# Rari documentation

This folder is the canonical home for Rari / Fleet Copilot documentation. The root-level `RARI_*.md` files are archived in `docs/rari/_archive/`.

## Active docs

| File | Purpose |
| --- | --- |
| `AGENTIC_OS_ROADMAP.md` | Long-term 6–12 month roadmap for Rari as an agentic OS. |
| `ELEVENLABS_TOOL_SYNC.md` | How to sync the canonical tool registry to the ElevenLabs workspace via the sync script. |
| `ELEVENLABS_CHANGES_REQUIRED_2026-07-31.md` | Owner action required in ElevenLabs dashboard to fix auth after the fail-closed security change. |
| `FLEETCOPILOT_NUMBER_TRUTH_AUDIT.md` | Audit of fabricated vs. real KPIs and the plan to fix them. |
| `FLEETCOPILOT_PHASE_2_PLAN.md` | Phase 2 plan for honest AI + provenance UI. |

## Quick reference

- **Canonical tool registry:** `supabase/functions/_shared/fleet-tools/registry.ts`
- **Shared tool executor:** `supabase/functions/_shared/fleet-tools/executor.ts`
- **Voice webhook adapter:** `supabase/functions/elevenlabs-tools/index.ts`
- **MCP adapter:** `supabase/functions/rari-mcp-server/index.ts`
- **In-app chat adapter:** `supabase/functions/fleet-copilot-chat/index.ts`
- **Session token minting:** `supabase/functions/elevenlabs-session/index.ts`
- **Sync script:** `scripts/rari/sync-elevenlabs-tools.ts` → run via `bun run rari:sync-tools`
- **Parity test:** `scripts/rari/cross-surface-parity-check.ts` → `bun run rari:parity-check`
- **Tenant isolation proof:** `scripts/rari/tenant-isolation-proof.ts` → `bun run rari:tenant-isolation`

## System prompt + knowledge base

The latest prompt text to paste into the ElevenLabs agent is at the repo root:

- `RARI_ELEVENLABS_SYSTEM_PROMPT.md`
- `RARI_CAPABILITIES_KNOWLEDGE_BASE.md`

Both are generated from the current registry and should be updated whenever the registry changes.

## Current state (2026-08-01)

- 37 live tools in the canonical registry.
- Voice, MCP, and in-app chat all use the same executor and registry.
- Authentication is fail-closed: only a signed, per-session tool token is accepted.
- Two mutating tools require ElevenLabs "Requires approval": `create_booking_hold` and `logFeedback`.

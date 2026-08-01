# Rari — remaining work before test day

The tool layer is done: one registry (37 tools), one executor, one auth path, all three surfaces (voice webhooks, MCP, in-app chat) reading from it, and the ElevenLabs workspace synced with zero name collisions. What's left is agent-side configuration, stale documentation, and a repeatable way to prove it works.

## 1. Finish the ElevenLabs agent config (manual, ~10 min)

- Set **Requires approval** on the two mutating tools: `create_booking_hold`, `logFeedback`. Everything else is read-only and can stay auto-approved.
- Refresh the agent's system prompt and knowledge base. The current prompt and `RARI_CAPABILITIES_KNOWLEDGE_BASE.md` still describe the old 25-tool catalog, name tools that no longer exist (`getCarJoke`, `featureComingSoon`, `getWeatherInfo`), and don't mention `ask_fleet` — which is the tool the agent should reach for whenever no specific tool matches. Without this the agent will keep guessing at tools that aren't there.
- Confirm the agent's first-message and fallback copy doesn't promise capabilities the registry no longer exposes.

## 2. Add `ask_fleet` guidance to the prompt

`ask_fleet` is the catch-all router. It only pays off if the prompt tells the agent: try a specific tool first, fall back to `ask_fleet` with the user's question verbatim, never answer fleet questions from memory.

## 3. Cross-surface parity check (scripted)

A single script that, for a fixed tenant session token, calls the same 6–8 representative tools through all three surfaces (`elevenlabs-tools`, `rari-mcp-server`, `fleet-copilot-chat`) and asserts identical payloads. This is the guardrail that keeps the three surfaces from drifting again, and it doubles as the pre-test smoke run.

## 4. Tenant isolation proof

Run the same tool set with two different tenant session tokens and assert zero overlap in returned IDs — a written record that the cross-tenant hole is closed, not just an assumption.

## 5. Doc consolidation

There are ~24 root-level `RARI_*.md` files, most describing superseded architecture (MCP-to-ElevenLabs connection steps that are no longer the model, the old 25-tool list, a wrong project URL in `RARI_NEXT_STEPS_JAN_7_2026.md`). Collapse them into the three current docs under `docs/rari/` and delete the rest, so the next person testing doesn't follow a dead runbook.

## 6. Then test

Suggested order: text chat first (fastest loop), then MCP via Claude/Cursor, then voice last — voice failures are the hardest to read, and by then the tool layer is already proven.

## Technical notes

- No schema changes, no new secrets, no RLS work in any of the above.
- Items 1 and 2 are ElevenLabs dashboard work; I can't do them from here, but I can produce the exact prompt text and knowledge-base file to paste.
- Items 3 and 4 add scripts under `scripts/rari/`; they run against the deployed functions with an `ELEVENLABS_API_KEY` and a session token, and touch no application code.
- Item 5 is deletions plus one consolidated index in `docs/rari/`.

# Rari webhook tools: verdict on your JSON + the one fix needed

## Your JSON is correct

Two things in the pasted `create_booking_hold` config are already right:

- `"auth_connection": null` — this is the "Authentication = None" state. Correct, because tenant identity comes from the request header below, not from a workspace connection.
- `"request_headers"` carries `Authorization: Bearer {{secret__rari_tool_token}}` — the per-conversation, per-tenant token. This is what keeps voice calls scoped to one team.

## There is no "Requires approval" toggle for these tools

Confirmed against the ElevenLabs API reference and SDK types: approval is an **MCP-server-only** feature (`approval_policy`: `auto_approve_all` / `require_approval_all` / `require_approval_per_tool`, plus a per-tool `tool-approvals` sub-resource).

Webhook tools — which is what all 37 Rari tools are — have no approval field at all. Your JSON is the complete supported field set. That is why you could not find the toggle: for this tool type it does not exist.

Rari cannot switch to native MCP to get it, because MCP auth headers are static and workspace-scoped, which would break the per-tenant token.

## The one actual bug: doubled description

Your description reads:

> "Place a provisional hold on a vehicle for a date range. **Mutates data. Mutates data —** confirm with the operator first. [rari-registry]"

The phrase is written twice because it exists in two places:

- `supabase/functions/_shared/fleet-tools/registry.ts` — the `create_booking_hold` description ends with "Mutates data."
- `scripts/rari/sync-elevenlabs-tools.ts` — appends "Mutates data — confirm with the operator first." for every `readOnly: false` tool.

Fix: drop the trailing "Mutates data." from the registry description, leaving the sync script as the single place that adds the mutation warning. Then re-run the sync to push the cleaned description.

## Changes

1. **Registry** — remove the redundant "Mutates data." sentence from `create_booking_hold` so the sync script owns that phrasing for all mutating tools.
2. **Sync script tail message** — stop instructing the operator to set "requires approval" in the agent UI, since no such setting exists for webhook tools. Replace it with the accurate note that mutating tools are gated by the system prompt's confirmation rule.
3. **Docs** — correct the same claim wherever it appears in the active `docs/rari/` files so future setup passes don't chase a non-existent toggle.
4. **Re-sync** — run the tool sync with `--apply` to update the live descriptions, then confirm the tools stay pinned to the agent.

## What guards writes instead

With no platform-level approval, the confirmation rule lives in Rari's system prompt: state the action and wait for explicit operator confirmation before calling `create_booking_hold` or `logFeedback`.

That is prompt-level, not enforced. If you want a real guarantee that a voice turn cannot write without confirmation, the durable fix is a server-side two-step flow: a prepare call returns a summary and stores a short-lived tenant-scoped pending action, and only an explicit confirm call executes it, rejecting expired, replayed, wrong-user, or cross-tenant attempts. That is a larger change and is not included above — say the word and I'll plan it separately.

## Verification

- Re-fetch the tool from ElevenLabs and confirm the description reads once, ending in `[rari-registry]`.
- Confirm `auth_connection` stays `null` and the Authorization header is intact on all 37 tools.
- Confirm the agent still has exactly 37 registry tools pinned and no legacy duplicates.
- Re-run `rari:parity-check` and `rari:tenant-isolation`.

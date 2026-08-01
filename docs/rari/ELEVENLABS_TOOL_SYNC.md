# Rari tool sync — ElevenLabs (registry-driven)

**Date:** 2026-08-01 · Supersedes the manual tool list in `ELEVENLABS_CHANGES_REQUIRED_2026-07-31.md` (the auth section there still applies).

## The model

`supabase/functions/_shared/fleet-tools/registry.ts` is the only place tools are defined. Voice, MCP, and in-app chat all read from it. The agent's webhook tools are now generated from it too, so adding a capability is one file change plus one script run — no dashboard work.

Voice stays on **webhook tools**, not native MCP. ElevenLabs MCP server integrations use static, workspace-scoped headers; they cannot carry the per-conversation `{{secret__rari_tool_token}}` that scopes each call to one tenant. Using native MCP for voice would mean one shared identity for all tenants — the exact cross-tenant hole we closed. `rari-mcp-server` remains the surface for Claude / ChatGPT / Cursor, where per-user auth is possible.

## Running the sync

```bash
ELEVENLABS_API_KEY=... \
ELEVENLABS_AGENT_ID=agent_0001k9d5pvdwfmvv7aq0mhaexgd6 \
RARI_TOOLS_URL=https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools \
  bun run rari:sync-tools            # dry run — prints created/updated/deleted
  bun run rari:sync-tools -- --apply # writes to the workspace + pins agent tool_ids
```

What it does:

- Creates any registry tool missing from the workspace.
- Updates any tool whose config drifted.
- Deletes workspace tools it owns (marked `[rari-registry]`) that left the registry.
- Sets the agent's `conversation_config.agent.prompt.tool_ids` to exactly the registry set.

Tools not created by this script are never touched.

## Generated tool shape

| Field | Value |
| --- | --- |
| URL | `.../elevenlabs-tools/<tool_name>` (path-suffix dispatch) |
| Method | `POST` |
| Header | `Authorization: Bearer {{secret__rari_tool_token}}` |
| Body | flat parameter object from the registry schema |
| Timeout | 20s |

## Manual step that remains after sync

The script can create and update tools, but it cannot set the **Auth connection** field in the ElevenLabs UI. For every registry-owned tool:

1. **Auth connection:** Set to **None** (`"auth_connection": null` in the tool JSON). Our tools authenticate via the `Authorization: Bearer {{secret__rari_tool_token}}` header in the Headers section, not via an ElevenLabs auth connection. A leftover auth connection such as "Cursor - Cursor API Key" should be removed.

There is **no "Requires approval" toggle to set.** That control exists only for native MCP servers in ElevenLabs (`approval_policy` on the MCP server, plus a per-tool `tool-approvals` resource). Webhook tools — which is what all registry tools are — have no approval field, so do not go looking for it in the tool panel. Mutating tools are gated by the system prompt's confirmation rule instead.

Rari cannot move to native MCP just to gain that toggle: MCP auth headers are static and workspace-scoped, which would break the per-conversation tenant token.

The script prints the list of mutating tools at the end of every run.

## Other changes in this pass

- Session tool tokens now live **60 minutes** (was 15), so long voice calls stop failing mid-conversation.
- `featureComingSoon` and `getCarJoke` were removed from the registry — a "coming soon" reply is a false affordance on a live tenant account, and the joke tool burned a turn. Registry is now **37 tools**.

## Verification

Run `bun run rari:parity-check` after a sync to confirm the same tool works through voice, MCP, and chat with identical results.

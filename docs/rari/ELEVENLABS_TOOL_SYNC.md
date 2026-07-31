# Rari tool sync — ElevenLabs (registry-driven)

**Date:** 2026-07-31 · Supersedes the manual tool list in `ELEVENLABS_CHANGES_REQUIRED_2026-07-31.md` (the auth section there still applies).

## The model

`supabase/functions/_shared/fleet-tools/registry.ts` is the only place tools are
defined. Voice, MCP, and in-app chat all read from it. The agent's webhook tools
are now generated from it too, so adding a capability is one file change plus one
script run — no dashboard work.

Voice stays on **webhook tools**, not native MCP. ElevenLabs MCP server
integrations use static, workspace-scoped headers; they cannot carry the
per-conversation `{{secret__rari_tool_token}}` that scopes each call to one
tenant. Using native MCP for voice would mean one shared identity for all 17
tenants — the exact cross-tenant hole we closed. `rari-mcp-server` remains the
surface for Claude / ChatGPT / Cursor, where per-user auth is possible.

## Running the sync

```bash
ELEVENLABS_API_KEY=... \
ELEVENLABS_AGENT_ID=agent_0001k9d5pvdwfmvv7aq0mhaexgd6 \
RARI_TOOLS_URL=https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools \
  bun run rari:sync-tools            # dry run — prints created/updated/deleted
  bun run rari:sync-tools -- --apply # writes to the workspace + pins agent tool_ids
```

What it does:

- creates any registry tool missing from the workspace,
- updates any tool whose config drifted,
- deletes workspace tools it owns (marked `[rari-registry]`) that left the registry,
- sets the agent's `conversation_config.agent.prompt.tool_ids` to exactly the registry set.

Tools not created by this script are never touched.

## Generated tool shape

| Field | Value |
| --- | --- |
| URL | `.../elevenlabs-tools/<tool_name>` (path-suffix dispatch) |
| Method | `POST` |
| Header | `Authorization: Bearer {{secret__rari_tool_token}}` |
| Body | flat parameter object from the registry schema |
| Timeout | 20s |

## Manual step that remains

Mutating tools (`registry.readOnly === false`) must be set to **requires
approval** in the agent UI. The script prints the exact list at the end of every
run.

## Other changes in this pass

- Session tool tokens now live **60 minutes** (was 15), so long voice calls stop
  failing mid-conversation.
- `featureComingSoon` and `getCarJoke` were removed from the registry — a
  "coming soon" reply is a false affordance on a live tenant account, and the
  joke tool burned a turn. Registry is now **37 tools**.

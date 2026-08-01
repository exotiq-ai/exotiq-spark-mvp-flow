# Correct Rari webhook approval handling

## What is true

Rari’s 37 ElevenLabs tools are **webhook tools**. ElevenLabs does not expose a `requires_approval` field for webhook-tool JSON. The approval JSON found in ElevenLabs documentation applies only to native MCP servers, so adding it to Rari’s current `tool_config` would be invalid or ignored.

The current webhook JSON should keep authentication set to **None** in ElevenLabs because tenant identity is supplied by Rari’s dynamic request header:

```json
{
  "tool_config": {
    "type": "webhook",
    "name": "create_booking_hold",
    "description": "Place a provisional hold on a vehicle for a date range.",
    "response_timeout_secs": 20,
    "api_schema": {
      "url": "<RARI_TOOLS_URL>/create_booking_hold",
      "method": "POST",
      "request_headers": {
        "Authorization": "Bearer {{secret__rari_tool_token}}"
      },
      "request_body_schema": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  }
}
```

There is intentionally **no approval property** in that JSON.

## Implementation

1. **Remove the incorrect setup guidance**
   - Update `scripts/rari/sync-elevenlabs-tools.ts` and the active `docs/rari/` instructions so they no longer claim a webhook “Requires approval” dashboard toggle exists.
   - Keep the correct instruction that every registry webhook tool uses Authentication = None.

2. **Preserve explicit conversational confirmation**
   - Keep `create_booking_hold` and `logFeedback` marked as mutating in the canonical registry.
   - Keep Rari’s system prompt requirement to explain the proposed action and wait for explicit operator confirmation before calling either tool.

3. **Add server-enforced write safety**
   - Add a two-step prepare/confirm flow for mutating voice actions rather than trusting prompt compliance alone.
   - The prepare step stores a short-lived, tenant-scoped pending action and returns a human-readable summary.
   - The confirm step accepts only that pending action after explicit confirmation, validates the same user/team identity again, rejects expiry/replay/cross-tenant use, then executes once.
   - Read-only tools remain unchanged.

4. **Keep cross-surface behavior aligned**
   - Drive the prepare/confirm definitions from the shared FleetCopilot registry so voice, in-app chat, and MCP do not acquire separate write rules.
   - Update the ElevenLabs sync output and parity checks for the new write-tool flow.

## Verification

- Confirm the generated webhook JSON contains no unsupported approval field.
- Confirm all registry tools retain the dynamic tenant authorization header.
- Prove a write cannot execute without a valid pending confirmation.
- Test expired, replayed, wrong-user, and wrong-tenant confirmations fail closed.
- Re-run cross-surface parity and tenant-isolation checks.

## Technical note

Native ElevenLabs MCP supports JSON such as `approval_policy: "require_approval_per_tool"`, but Rari cannot safely switch voice tools to that path because its current per-conversation tenant token is dynamic while ElevenLabs MCP authentication is workspace-scoped. The webhook architecture should remain in place until that identity boundary can be preserved.
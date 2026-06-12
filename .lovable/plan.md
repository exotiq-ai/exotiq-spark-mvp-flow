# Fix Rari: redeploy stale elevenlabs-tools function

## Root cause

Every Rari tool call fails with:

```
[req_…] Rejected: missing or invalid x-elevenlabs-secret header
```

(visible in the `elevenlabs-tools` edge function logs).

But the current repo source at `supabase/functions/elevenlabs-tools/index.ts` does **not** check `x-elevenlabs-secret` anywhere. It authenticates via the `Authorization: Bearer <tool_token>` header that `elevenlabs-session` mints and ElevenLabs forwards (and the session function is already minting that token correctly per its logs).

So the June‑10 rollback reverted the repo, but the **deployed copy of `elevenlabs-tools` on Lovable Cloud is still the newer post‑rollback build** that enforces `x-elevenlabs-secret`. ElevenLabs never sends that header, so every tool call is rejected and Rari responds with "I'm having trouble accessing your fleet data / authentication issue" — exactly what the user is seeing.

Other Rari plumbing is healthy:
- `elevenlabs-session` returns a valid signed URL + tool token (logs confirm).
- Conversation persistence (`rari_conversations` / `rari_messages`) writes fine.
- Fleet context (55 vehicles) is built correctly.

The only break is the deployed `elevenlabs-tools` function being out of sync with repo source.

## Fix

Force `elevenlabs-tools` to redeploy from the current repo source so the live function matches the rolled‑back code (Bearer tool‑token auth, no `x-elevenlabs-secret` gate).

Steps:

1. Touch `supabase/functions/elevenlabs-tools/index.ts` with a no‑op edit (e.g. update the top banner comment) so Lovable Cloud picks up the change and redeploys the function.
2. After redeploy, hit `…/functions/v1/elevenlabs-tools/health` and confirm `{ ok: true, hasToolSecret: true }` with no "x-elevenlabs-secret" log line.
3. Start a Rari session in the preview, ask "how many vehicles do I have", and confirm:
   - `elevenlabs-tools` logs show `Auth resolved: method=tool_token` (not "Rejected").
   - Rari answers with the real fleet number instead of the auth‑error fallback.

## Out of scope

- No changes to `elevenlabs-session`, ElevenLabs agent config, or the Rari UI.
- No schema, RLS, or secret changes. `RARI_TOOL_TOKEN_SECRET` is already set and working (session function signs with it; tools function will verify with it once redeployed).
- No rollback of any other feature.

## Technical notes

- Auth path that will be active after redeploy (already in repo, lines ~531–599 of `supabase/functions/elevenlabs-tools/index.ts`): `Authorization: Bearer <jwt>` → `verifyToolToken(token, RARI_TOOL_TOKEN_SECRET)` → `{ userId, teamId }` → `authMethod = 'tool_token'`. Falls back to conversation metadata, then `DEMO_USER_ID`, then hardcoded demo user.
- If after redeploy the health endpoint reports `hasToolSecret: false`, the missing piece is the `RARI_TOOL_TOKEN_SECRET` env var on the tools function — would re‑add via secrets tool. Logs currently suggest it is present (session function signs successfully with the same secret name).

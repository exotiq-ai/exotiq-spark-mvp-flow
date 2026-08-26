# Fix demo-login sessions + Rari cleanups

## 1. demo-login: sessions fail `auth.getUser` with `session_not_found`

**Diagnosis (confirmed by reads):** `demo-login` signs in the shared demo user `hello@exotiq.ai` via `signInWithPassword`, which does mint a real persisted session — but every demo visitor shares that one account. `AuthContext.signOut()` calls `supabase.auth.signOut()` with the default **global** scope, which revokes **all** sessions for that user. So any demo visitor signing out kills every other live demo session → subsequent `getUser` returns `session_not_found`.

**Fix:**
- First reproduce: curl `demo-login`, then call `GET /auth/v1/user` with the returned access token to confirm the failure mode (revocation vs. never-persisted).
- In `src/contexts/AuthContext.tsx`: when the current session is the demo user (`isDemo` / demo email), sign out with `scope: 'local'` only — never revoke the shared account's other sessions.
- In `supabase/functions/demo-login/index.ts`: keep `signInWithPassword` (it is the correct way to get a persisted session) but harden it — verify the returned session with an admin `getUserById`/token check before responding, and log the session id so we can confirm persistence. If reproduction shows sessions are revoked rather than never created, the local-scope sign-out is the actual fix and the function stays as-is.
- Verify end-to-end: demo login → `getUser` succeeds → second demo login in another browser context still works after the first signs out.

## 2. Remove hardcoded PEAK_SEASONS + 'miami' default from `executor.ts`

- Delete the `PEAK_SEASONS` array (lines ~255-279) and `getCurrentPeakSeason`.
- Update the 6 call sites (getFleetMetrics ~721, getLocationMetrics ~815, getDemandForecast ~1455, pricing recommendation ~1531, ~1613, insights ~2318) to stop injecting hardcoded surge context. Where a location is needed, derive it from the tenant's own data: query the `locations` table (fallback: distinct `vehicles.location`) for that `teamId`, same pattern as the existing `detectAskFleetLocation` helper.
- `getDemandForecast`: replace `city = 'miami'` default with the tenant's primary/first location from the `locations` table; if the tenant has no locations, run the forecast fleet-wide instead of defaulting to a city.
- Insights/peak-season callouts: drop the fake surge recommendations; demand context comes from the tenant's real bookings (and MotorIQ where already wired). No fabricated Miami/Scottsdale events for tenants in other markets.

## 3. Delete dead widget code + unpkg CSP

- Delete `src/components/rari/RariWidgetInterface.tsx` and `src/components/rari/RariWidgetDemo.tsx` (confirmed: no imports anywhere in `src/`).
- Remove `https://unpkg.com` from `script-src` in `index.html` CSP (only there for the ElevenLabs widget script the dead components loaded).

## 4. fleet-copilot-chat: confirm deployable or remove

- Confirmed: no client code invokes it — the only references are comments in `executor.ts`/`registry.ts`. Live adapters are `elevenlabs-tools` (voice) and `rari-mcp-server` (MCP).
- Test-deploy it. Since nothing calls it, **remove** the function directory, its `[functions.fleet-copilot-chat]` entry in `supabase/config.toml`, and update the two header comments to name only the live adapters. (If deploy reveals it's load-bearing for something unexpected, keep it and report instead.)

## Out of scope (per instructions)
- No changes to the fleet-tools registry, auth flows beyond the demo sign-out scope, or the ElevenLabs tool sync.

## Verification
- Build clean; `demo-login` + `getUser` round-trip via curl before and after.
- Deploy `elevenlabs-tools` + `rari-mcp-server` after the executor edit and smoke-call one tool (`getFleetMetrics`) to confirm no regression.
- Grep confirms no dangling imports of deleted files.

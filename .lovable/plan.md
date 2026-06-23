## What's actually slow

The HAR from `app.exotiq.ai` shows ~160 requests on a single navigation, dominated by **duplicate Supabase calls fired by the team-messaging hook**, not by your recent Super Admin change:

| Count | Endpoint |
|---|---|
| 36 | `rest/v1/team_messages` |
| 24 | `rest/v1/profiles` |
| 24 | `rest/v1/conversation_members` |
| 18 | `rest/v1/team_members` (always the same query) |
| 12 | `rest/v1/team_conversations` |

All of those come from `src/hooks/useTeamMessaging.ts`, which is mounted in `DashboardHeader` and therefore runs on every page. The big asset load times (`Auth-*.js` 9.7s, `chartExport-*.js` 15s) are network/CDN noise — the dev-server change to "Last activity" is not implicated.

## Root cause

`useTeamMessaging` has a self-feeding `useEffect` loop and a heavy N+1 enrichment pass:

1. `fetchCurrentTeamId` reads `team_members` even though `TeamContext` already exposes `currentTeam.id`. It also `setCurrentTeamId(...)`, which is in the dep array of `fetchConversations`/`fetchTeamMembers`, so those callbacks get new identities → the init `useEffect` (deps: those callbacks) re-runs → re-fetches everything. This is why the same `team_members?team_id=…` query fires 10–18 times.
2. `fetchConversations` then loops every conversation and issues **4 separate queries per conversation** (last message, members, member profiles, unread count). With a handful of conversations that's the 36 / 24 / 24 we see.
3. `DashboardHeader` only needs an unread badge but pulls the full hook, so the entire pipeline runs on every dashboard route.

## Fix

### `src/hooks/useTeamMessaging.ts`
- Drop `fetchCurrentTeamId` and the local `currentTeamId` state. Read team id from `useTeam()` (`TeamContext`).
- Stabilize callback deps: `fetchConversations` and `fetchTeamMembers` depend on `[user?.id, currentTeam?.id]` only. Remove cross-callback deps that cause re-creation.
- Replace the per-conversation N+1 enrichment with batched queries:
  - One `team_messages` query: latest row per `conversation_id` via `order(created_at desc)` + `in('conversation_id', ids)` then dedupe client-side (or a SQL view / RPC if we want it tighter later).
  - One `conversation_members` query with `in('conversation_id', ids)`.
  - One `profiles` query with the union of member ids.
  - Unread counts: compute client-side from the batched messages + each member's `last_read_at` instead of a `count head:true` per conversation.
- Init `useEffect` deps become `[user?.id, currentTeam?.id]` so it runs once per user/team, not on every callback re-creation.

### `src/components/dashboard/DashboardHeader.tsx`
- Stop calling `useTeamMessaging` just for the unread badge. Use a lightweight selector — either expose `unreadTotal` from a new `useUnreadMessagesCount(teamId)` hook (single `count head:true` query + realtime channel on `team_messages` for that team), or read it from the slimmed-down `useTeamMessaging` only on the messaging route.

### Out of scope
- No schema changes, no RLS changes, no edge-function changes.
- No rollback of the "Last activity" Super Admin change — it isn't the cause.
- No service worker / Workbox changes (the slow JS chunks are CDN-side and unrelated to the regression pattern).

## Verification

After the change, a fresh load of any dashboard page should show in the network tab:
- `team_members` for the user fires **0–1** times (TeamContext already has it).
- `team_conversations`, `conversation_members`, `profiles`, `team_messages` each fire **1–2** times total on initial load instead of 12–36.
- Switching routes inside the dashboard does not re-issue messaging queries unless `currentTeam.id` changes.
- Unread badge in the header still updates when a new message arrives (realtime subscription on `team_messages`).

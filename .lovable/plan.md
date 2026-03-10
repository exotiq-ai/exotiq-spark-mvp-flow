

# Fix: Team Hub Data Isolation — Cross-Tenant Leak

## Critical Problem

The Team Directory, My Team Section, and Team Activity all query `profiles` and `user_roles` **without any team_id filter**. This means every user in the entire system is visible to every other user. The screenshot confirms: 9 users from different accounts all appear in a single team's directory.

### Root Cause (3 components, same bug)

| Component | Query | Problem |
|-----------|-------|---------|
| `TeamDirectorySection.tsx` (line 74) | `supabase.from('profiles').select(...)` | No team filter — returns ALL profiles |
| `TeamDirectorySection.tsx` (line 81) | `supabase.from('user_roles').select(...)` | No team filter — returns ALL roles |
| `MyTeamSection.tsx` (line 66) | `supabase.from('profiles').select(...)` | Same — no team filter |
| `MyTeamSection.tsx` (line 76) | `supabase.from('user_roles').select(...)` | Same |
| `useTeamActivity.ts` (line 37) | `supabase.from('user_activity_log').select(...)` | No team filter — shows all user activity |
| `useTeamActivity.ts` (line 53) | `supabase.from('profiles').select(...)` | Fetches profiles across teams |

## Fix Plan

### 1. Rewrite `TeamDirectorySection` to use `team_members` table

Instead of querying the global `profiles` + `user_roles` tables, query **`team_members`** joined with `profiles` — filtered by the current user's `team_id` from `useTeam()`.

```
// BEFORE (broken):
supabase.from('profiles').select('*')       // ALL users globally
supabase.from('user_roles').select('*')     // ALL roles globally

// AFTER (team-scoped):
supabase.from('team_members')
  .select('user_id, role, is_active, profiles(id, full_name, email, avatar_url, is_active)')
  .eq('team_id', currentTeam.id)
```

This is both the correct multi-tenant pattern AND simpler code (one query instead of two, no manual merge).

### 2. Rewrite `MyTeamSection` the same way

Same fix — replace `profiles` + `user_roles` queries with a single `team_members` join query filtered by `currentTeam.id`.

### 3. Fix `useTeamActivity` to scope by team

Add `team_id` filter to the `user_activity_log` query. The `user_activity_log` table doesn't have a `team_id` column, so we need to:
- Option A: Filter activity by user_ids who are members of the current team (subquery or pre-fetch team member IDs)
- Option B: Add `team_id` to `user_activity_log` (better long-term, but migration needed)

Recommended: Option A for now — fetch team member user_ids first, then filter activity by those IDs. This avoids a migration and fixes the leak immediately.

### 4. Team Hub visibility in sidebar

Currently `team-hub` has `minRole: 'manager'` in the sidebar. This is fine for role gating, but the real issue is data leaking, not navigation access. Once the queries are team-scoped, even if someone accesses Team Hub, they'll only see their own team members.

No sidebar changes needed — the data isolation fix is sufficient.

### 5. Scope `TeamInvitationsSection` by team

The invitations query (`user_invitations`) also has no team filter. Need to add `.eq('team_id', currentTeam.id)` or equivalent filter so one team's admin doesn't see another team's pending invitations.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/TeamDirectorySection.tsx` | Replace profiles+user_roles queries with team_members join, add `useTeam()` |
| `src/components/dashboard/MyTeamSection.tsx` | Same fix |
| `src/hooks/useTeamActivity.ts` | Filter activity by team member user_ids |
| `src/components/dashboard/TeamInvitationsSection.tsx` | Add team_id filter to invitations query |

No database migration needed — `team_members` already has the correct structure with `team_id`, `user_id`, `role`, and foreign key to profiles.


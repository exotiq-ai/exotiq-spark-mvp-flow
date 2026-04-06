

# Fix Team Directory — Missing Foreign Key

## Problem

The console error says it all:

```
PGRST200: Could not find a relationship between 'team_members' and 'profiles' in the schema cache
```

Four files use PostgREST embedded joins like `.select('user_id, role, profiles(id, full_name, email)')` — but there is **no foreign key** from `team_members.user_id` to `profiles.id`. PostgREST requires an explicit FK to resolve embedded resource syntax. This affects:

- `TeamDirectorySection.tsx` (Team Hub directory tab — the screenshot error)
- `MyTeamSection.tsx` (My Team section)
- `UserManagementSection.tsx` (user management)
- `useTeamMessaging.ts` (messaging member list)

## Fix

### 1. Database migration — Add FK constraint

```sql
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

This is safe because:
- `profiles.id` mirrors `auth.users.id` (created by the `on_auth_user_created` trigger)
- Every `team_members.user_id` should already exist in `profiles`
- If any orphaned rows exist, we clean them first

Pre-check (run before the ALTER):
```sql
DELETE FROM public.team_members
WHERE user_id NOT IN (SELECT id FROM public.profiles);
```

### 2. No application code changes needed

All four files already use the correct PostgREST syntax (`profiles(...)`). Once the FK exists, the joins will work automatically.

## Files Changed

| File | Change |
|------|--------|
| Database migration | Clean orphans + add FK from `team_members.user_id` → `profiles.id` |

## Risk

**Low.** This is a standard FK addition. The data relationship already exists logically — we're just making it explicit for PostgREST. The `ON DELETE CASCADE` ensures if a profile is deleted, the team membership is cleaned up too.


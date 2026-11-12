# Lock down three unused admin functions

## What changes
Only who is allowed to run three old database functions. No data, tables, policies or function bodies change.

- `deactivate_team_member(uuid, uuid, uuid, text)` — backend-only
- `reactivate_team_member(uuid, uuid, uuid, text)` — backend-only
- `migrate_users_to_teams()` — backend-only

The app's two-argument `deactivate_team_member(target_user_id, reason)` and one-argument `reactivate_team_member(target_user_id)` stay exactly as they are.

## Steps
1. Apply the provided migration verbatim (revoke from public/anon/authenticated, grant execute to service_role, skipped if a signature doesn't exist).
2. Run the provided read-only verification query and paste the result back.
   - Expected: `f | f | t` for the three long signatures, `t | t | t` for the two short ones.
3. Check the build log stays clean. Nothing else is touched.

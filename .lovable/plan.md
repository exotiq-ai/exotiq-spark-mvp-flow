

# Fix: Invited Users Get Their Own Team Instead of Joining Inviter's Team

## Root Cause

Two database triggers fire when a new user's profile is created:

1. **`auto_assign_user_role`** — correctly detects pending invitations and skips role assignment
2. **`create_team_for_new_user`** — does NOT check for pending invitations. It only checks `IF NOT EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.id)`, which is always true at this point since `accept-invite` hasn't run yet

Result: Chantara (invited by Denver) got her own team "Chantara's Fleet" + owner role instead of joining "J Davidson's Fleet" as a manager. The invitation is still stuck as `pending`.

## The Fix

### 1. Patch the `create_team_for_new_user` trigger function

Add the same pending-invitation check that `auto_assign_user_role` already uses:

```sql
-- Add at the start of the function, BEFORE the team_members check:
IF EXISTS (
  SELECT 1 FROM user_invitations
  WHERE email = NEW.email AND status = 'pending'
) THEN
  RAISE NOTICE 'User % has pending invitation, skipping team creation';
  RETURN NEW;
END IF;
```

### 2. Fix Chantara's data (one-time cleanup)

- Delete the auto-created team "Chantara's Fleet" (`dc3b263e`)
- Delete her `team_members` row for that team
- Delete her `user_roles` row (admin → should be manager per invitation)
- Delete her auto-created location and location_staff entries
- Manually run the accept-invite logic:
  - Insert `team_members` row: team `c71d6655` (Denver's team), role `manager`
  - Insert `user_roles` row: role `manager` with invitation permissions
  - Mark invitation `55917188` as `accepted`
  - Update her profile with Denver's company name

### 3. Verify the `accept-invite` edge function is deployed

The logs returned empty — need to confirm it's actually deployed and reachable. If not, deploy it.

## Files Changed

| What | Type |
|------|------|
| `create_team_for_new_user` function | DB migration |
| Chantara's data cleanup | DB data fix |
| Edge function deployment verification | Infrastructure |

## Risk

Low — the trigger fix adds a guard clause identical to the one already working in `auto_assign_user_role`. The data cleanup is scoped to one user.


# Fix: invites fail from inside a support session

## What actually happened

Support mode is not the problem. The invite request failed for a plain code bug in the invite function: it looks up your active team by sorting on a `created_at` column on team memberships, and that column does not exist (the real column is `joined_at`). The database rejects the query, and the function falls through to the generic message "Could not determine your team. Please contact support."

Confirmed in the live function logs at 22:45 and 22:46 UTC today:

```text
Team lookup failed: column team_members.created_at does not exist
Error in invite-user function: Could not determine your team.
```

This breaks invites for every account, not just support sessions — anyone inviting through the Team Hub dialog hits it.

Your support session itself is healthy: your membership is active on Denver Exotic Rental Cars with an admin seat, and your home Drive Exotiq membership is correctly deactivated. Once the lookup is fixed, the invite will be created against Denver, which is the correct behavior.

## The fix

1. Correct the team lookup in the invite function to select and order by `joined_at` instead of the non-existent `created_at`.
2. Make the fallback safer: if the lookup errors, log the real database error and return a message that names the cause instead of a generic "contact support".
3. Add a support-session guard: when the caller is a super admin inside a support session, resolve the team from the active grant rather than from membership order, so the invite can never land on the wrong tenant.
4. Stamp the invite email with the tenant's name (Denver Exotic Rental Cars) rather than the inviter's profile company, so the recipient sees the account they're joining.

## Then send Laura's invite

After the fix, invite `laura@denverexoticrentalcars.com` as **Admin** on Denver Exotic Rental Cars, with the full admin permission set, and confirm the invitation row and delivery.

## Technical notes

- File: `supabase/functions/invite-user/index.ts` — `team_members` select/order fix, error surfacing, and grant-based team override using `support_access_grants` (unrevoked, unexpired) for super admin callers.
- No database migration needed; the schema is correct and the code was wrong.
- Role gating stays as-is: an admin inviting an admin is already permitted by the hierarchy check.

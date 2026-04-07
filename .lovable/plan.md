

# Fix Overly Permissive RLS Policies

## Problem

Two policies are flagged because they say "service role" in the name but grant access to **all** users. Service role bypasses RLS entirely, so these policies only affect non-service-role users — meaning they accidentally give every authenticated user full access.

| Table | Policy | Real Impact |
|-------|--------|-------------|
| `demand_intelligence_cache` | ALL with `USING(true) WITH CHECK(true)` | Any user can read/write/delete cached demand data |
| `rari_insights` | INSERT with `WITH CHECK(true)` | Any user can insert fake AI insights |

`onboarding_responses` INSERT is intentional (public signup form) — leave it.

## Fix

**Drop both "service role" policies.** Service role already bypasses RLS, so they serve no purpose. Then add proper scoped policies:

### `demand_intelligence_cache`
- **SELECT**: Team members can read cache for their team's locations
- **INSERT/UPDATE/DELETE**: Not needed for authenticated users — only edge functions (via service role) write to this table

### `rari_insights`
- **INSERT**: Restrict to `auth.uid() = user_id` so users can only insert their own insights (edge functions use service role anyway)

## Migration SQL

```sql
-- 1. demand_intelligence_cache: drop permissive, add team-scoped read
DROP POLICY IF EXISTS "Service role can manage cache" ON demand_intelligence_cache;

CREATE POLICY "Team members can read cache"
ON demand_intelligence_cache FOR SELECT TO authenticated
USING (
  location_id IN (
    SELECT ls.location_id FROM location_staff ls WHERE ls.user_id = auth.uid()
  )
  OR location_id IN (
    SELECT l.id FROM locations l
    JOIN team_members tm ON tm.team_id = l.team_id
    WHERE tm.user_id = auth.uid() AND tm.is_active = true
  )
);

-- 2. rari_insights: drop permissive, add user-scoped insert
DROP POLICY IF EXISTS "Service role can insert insights" ON rari_insights;

CREATE POLICY "Users can insert own insights"
ON rari_insights FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
```

## Files Changed

| File | Change |
|------|--------|
| Database migration | Drop 2 permissive policies, add 2 scoped replacements |

## Risk

**Low.** Edge functions use service role (bypasses RLS). The only change for authenticated users is they lose accidental write access to `demand_intelligence_cache` and can no longer insert insights for other users — both are corrections, not regressions.


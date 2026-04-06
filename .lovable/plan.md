

# Seed Data Cleanup — Inspections

## Findings

| Issue | Count | Tenant Risk |
|-------|-------|-------------|
| Stale seed inspections (draft, no direction, same timestamp) | 24 | None — all belong to demo team `c1de6533...` |
| Orphaned inspections (NULL team_id) | 3 | None — UI filters by `team_id`, so these never render |
| Linked photos/damage items on stale rows | 0 | Safe to delete |

**No data leaks to other tenants.** The `InspectionsTab` query filters by `currentTeam.id`, and RLS policies enforce `user_id` or `team_id` scoping. A new tenant signing up gets a clean empty state — zero inspections.

## Plan

### 1. Migration: Delete stale seed inspections

```sql
-- Remove 24 identical draft seed rows (no direction, no photos, no damage)
DELETE FROM vehicle_inspections
WHERE status = 'draft'
  AND inspection_direction IS NULL
  AND created_at = '2025-11-09 21:41:10.72848+00';

-- Backfill team_id on 3 orphaned inspections so they appear in the demo account UI
UPDATE vehicle_inspections
SET team_id = 'c1de6533-ab44-4973-a123-007a8007b5ba'
WHERE team_id IS NULL
  AND user_id = '99d902d4-5878-4b59-a108-142bafb1c862';
```

Single migration, no app code changes. The 3 real inspections (with actual directions and `completed` status) are preserved and assigned to the demo team so they show up properly.

### 2. No UI changes needed

The `InspectionsTab` already filters by `team_id` correctly. Once the junk rows are gone and the orphaned rows have a `team_id`, the demo account will show 3 meaningful inspections instead of 24 broken ones.

## Files Changed

| File | Change |
|------|--------|
| Database migration | DELETE stale seeds + UPDATE orphaned `team_id` |


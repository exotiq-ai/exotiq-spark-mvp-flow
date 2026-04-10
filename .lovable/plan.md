

# Lovable Cloud Usage Audit & Optimization Report

## Current Usage Snapshot

```text
RESOURCE                    USAGE           NOTES
───────────────────────────────────────────────────────────
STORAGE (vehicle-photos)    327 MB / 1,335 files   97.3% of all storage
  - Rejected photos          87 MB / 348 files     WASTE — never cleaned up
  - Orphaned files           65 MB / 543 files     WASTE — no DB reference
  - Thumbnails               ~506 files            Doubles file count
  - Active photos            ~175 MB               Actual useful storage
STORAGE (other buckets)      9 MB / 24 files       Negligible
DATABASE                    ~11 MB total            Healthy
  - notifications            3,401 rows (1.8 MB)   Oldest: Mar 12 — no purge running
  - unmatched_photos         529 rows               348 rejected still in DB
EDGE FUNCTIONS              check-subscription     Called on EVERY page load (2x)
  - presence writes          user_presence upserts  Every status change
REALTIME                    user_presence channel   Always subscribed globally
```

## Top 5 Waste Areas (Ranked by Impact)

### 1. Rejected + Orphaned Photos — 152 MB recoverable NOW
- **348 rejected photos** (87 MB) sitting in storage with DB rows still present
- **543 orphaned files** (65 MB) in storage with zero DB references (thumbnails of deleted photos, failed uploads, etc.)
- The `cleanup-unmatched-photos` edge function exists but is never called automatically
- **Fix**: Run cleanup once now, then schedule a weekly cron or trigger cleanup after each reject action

### 2. check-subscription Called Too Frequently
- Called **twice** on every auth state change (AuthContext mounts)
- Called again on SubscriptionSection mount
- Each call is ~700ms and hits Stripe API
- **Fix**: Cache result in React Query with 10-min staleTime. Only re-call on login, not on every navigation

### 3. Notifications Table — 3,401 rows, never purged
- `purge_old_notifications()` function exists but no cron job calls it
- Growing unbounded — 3,401 rows in ~1 month
- **Fix**: Schedule daily cron to call `purge_old_notifications()`

### 4. Presence Writes + Global Realtime
- `usePresence` subscribes to `user_presence` table changes globally on every page
- Each visibility change triggers a DB upsert
- **Fix**: Only mount presence hook on Team Hub/messaging pages, not app-wide

### 5. Thumbnail Duplication in Storage
- 506 thumbnail files stored alongside originals — doubles file count
- Each thumbnail is small (~10-30KB) but adds to object count billing
- **Fix**: Consider using Supabase Image Transformation (on-the-fly resize) instead of storing separate thumbnails

---

## Can You Move Photos Outside Lovable Cloud?

**Yes, but with tradeoffs:**

| Option | Effort | Savings | Tradeoff |
|--------|--------|---------|----------|
| **AWS S3 via connector** | Medium | High — all photo storage moves off Cloud | Need to update all upload/download code to use signed URLs through the S3 connector gateway. RLS no longer protects files directly. |
| **Cloudflare R2** | Medium | High — no egress fees | Similar to S3 but need custom edge function proxy. Already documented in your `CLOUD_MIGRATION_ROADMAP.md`. |
| **Keep on Cloud, just clean up waste** | Low | ~45% reduction (152 MB recovered) | No code changes needed for cleanup. |

**Recommendation**: Clean up the 152 MB of waste first (zero code changes, immediate savings). Then evaluate S3/R2 migration only if storage exceeds 1 GB with real data.

---

## What You CAN Change (No Code Required)

1. **Run cleanup-unmatched-photos** — deletes 87 MB of rejected photo files + 348 DB rows
2. **Delete 543 orphaned storage files** — recovers 65 MB (needs a one-time script)
3. **Schedule notification purge cron** — keeps notifications table bounded

## What Requires Code Changes

1. **Cache check-subscription** — wrap in React Query with staleTime (low effort)
2. **Lazy-load presence hook** — only on messaging pages (medium effort)
3. **Move to external storage (S3/R2)** — update `uploadVehiclePhoto`, `deleteVehiclePhoto`, all signed URL logic, edge functions (high effort, do later)
4. **Remove stored thumbnails** — switch to on-the-fly image transforms (medium effort)

---

## Implementation Plan

### Phase 1 — Immediate Cleanup (saves ~152 MB, no code changes)
- Run `cleanup-unmatched-photos` edge function to purge rejected files
- Write a one-time migration to delete orphaned storage files
- Add `pg_cron` job for `purge_old_notifications()` daily
- Add `pg_cron` job for `cleanup-unmatched-photos` weekly

### Phase 2 — Reduce Edge Function Calls
- Wrap `check-subscription` in React Query with 10-min staleTime in AuthContext
- Remove duplicate call from SubscriptionSection (it already gets data from context)

### Phase 3 — Lazy Realtime
- Move `usePresence` from global app layout to Team Hub pages only
- Conditionally subscribe to realtime channels only on pages that need them

### Phase 4 — External Storage (Future)
- Connect AWS S3 or Cloudflare R2 via connector
- Update photo upload pipeline to use signed URLs
- Migrate existing files with a batch script
- Only pursue this when storage exceeds 1 GB of real data


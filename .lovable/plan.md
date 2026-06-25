## Phase 2 — health improvements (updated)

Tightly scoped, each item independently shippable and reversible. Nothing here changes business logic visible to renters; every change either removes waste, adds an index, or instruments something we can't see today.

### Findings driving the plan
- `pg_stat_statements` shows **1,455,453 calls** to `SELECT documents_accepted FROM terms_acceptances WHERE user_id = $1 …` (0.06 ms avg, 85 s total). Matches `ComplianceBanner.tsx` — re-fetches on every mount, no caching. Ditto `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50` — **24,868 calls**, mean 2.5 ms.
- `notification_preferences` has columns only for messaging (mentions, DMs, Slack, digests). No per-type toggles for `late_return`, `pending_pickup`, etc. Dropped from Phase 2.
- The 306k rolled-back transactions is *probably* chatty `terms_acceptances` reads aborted by request cancellation, not real RLS violations. We'll instrument before fixing.
- All hot booking/notification queries already have the right indexes except one: **no composite `notifications(user_id, created_at DESC)`** — `fetchNotifications` does Index-then-Sort instead of an Index-only walk.

### Items

#### 1. Cache the compliance/terms reads (biggest win, zero risk)
File: `src/components/compliance/ComplianceBanner.tsx`
- Replace ad-hoc `useEffect` Supabase call with `useQuery` keyed `['compliance-dpa', user.id, jurisdiction]`, `staleTime: 5 * 60_000`, `refetchOnWindowFocus: false`.
- Worst-case failure: banner shows for up to 5 extra minutes — strictly fail-safe.

File: `src/components/legal/TermsReacceptanceGate.tsx`
- Wrap existing `evaluate()` in `useQuery` keyed `['terms-gate', user.id, teamId, requiredDocs.join(',')]` with `staleTime: 60_000`. Keep the in-flight ref as belt-and-suspenders.
- Mutation on accept calls `queryClient.invalidateQueries(['terms-gate', user.id])` so the dialog closes immediately on success.

#### 2. Add the missing notifications index
Migration:
```sql
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
```
Additive, no row rewrite.

#### 3. Surface what's actually rolling back (instrumentation only)
Migration adds read-only diagnostic helpers (`lovable_rollback_snapshot()`, table-stat peek) as `SECURITY INVOKER` with `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`. No new exposed endpoints; I call them from the read-query tool to compare snapshots and identify the actual chatty/rolling-back tables.

#### 4. Notifications retention
Verify the existing `purge_old_notifications` function body actually deletes. If not, add a thin SECURITY DEFINER function:
```sql
DELETE FROM notifications WHERE created_at < now() - interval '90 days' AND read = true;
```
Forward-only: only already-read, older than 90 days.

#### 5. Tighten the cron token check
Move `CRON_TRIGGER_TOKEN` from inline `cron.job.command` text into Supabase Vault; wrap the cron http_post in a SECURITY DEFINER function that reads from vault. **Gated on explicit go-ahead** since it touches Phase 1 cron — defer to Phase 3 unless you say otherwise.

#### 6. Stale-booking sanitization — REPORT ONLY, never auto-mutate
**Tenant-controlled data; Lovable never decides on the tenant's behalf.**
- Generate a **read-only** per-team report: how many bookings sit in `confirmed`/`active` with `end_date < now() - 30 days`, count per tenant, oldest row date. No code change, no migration, no UI surfacing — just hand you the numbers.
- **Add this finding to the Denver email draft** so J's team sees it explicitly: "We found 50+ bookings from earlier this year still marked confirmed/active that should likely be closed out. We left them untouched — your team owns that decision. Here's a one-click 'mark as completed' workflow you can use, or we can run a bulk close for you on request." Same paragraph applies to every tenant with non-zero stale rows.
- Lovable does **not** modify any tenant booking state automatically as part of Phase 2.

### Out of scope / explicit non-goals
- Per-type notification toggles (needs product input).
- The 148 pre-existing security-linter warnings (real but unchanged for months; per-warning review needed).
- Touching `notification_preferences` schema.
- Re-issuing expired Denver invitations.
- Any automated state change to tenant business records.

### Customer email to J's team (drafted alongside item 6)
Single short message covering: (a) the duplicate-notifications issue is fixed platform-wide and they should see the noise drop immediately, (b) re-acceptance gate fix so non-admin teammates aren't blocked once the owner re-accepts, (c) two expired teammate invites that need re-sending if they still want those people on, (d) the stale-bookings observation framed as "your call, here's the count, here's the one-click workflow." I'll draft the message body in a separate response after Phase 2 ships so you can edit before sending.

### Files touched
- `src/components/compliance/ComplianceBanner.tsx` — wrap reads in `useQuery`.
- `src/components/legal/TermsReacceptanceGate.tsx` — wrap `evaluate()` in `useQuery`.
- Two migrations: new index on `notifications`, read-only diagnostic helpers.
- Possibly one migration to harden `purge_old_notifications` (depending on what we find).
- No tenant-data mutations. No cron edits beyond Phase 1.

### Safety properties
- Every code change is read-side caching only. The worst-case failure mode is a banner showing for up to 5 extra minutes — never a hidden one.
- New index is `IF NOT EXISTS`, additive, no row rewrites.
- Diagnostic functions are `SECURITY INVOKER` and explicitly revoked from `anon`/`authenticated` — unreachable from the public API.
- No schema column adds, no policy changes, no edge-function auth changes, no cron schedule changes (item 5 deferred).
- Each item ships independently; if any one regresses, it's revertable on its own.
- Item 6 makes zero database writes.

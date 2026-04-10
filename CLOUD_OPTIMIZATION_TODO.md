# Cloud Optimization Plan — Admin Testing Checklist

> **Goal:** Reduce cloud resource consumption while staying on Lovable Cloud. Zero functional regressions.  
> **Owner:** Admin  
> **Status:** Phase 1 & 2 Complete  
> **Created:** 2026-03-05  
> **Updated:** 2026-04-10

---

## Priority 1 — Replace Presence Heartbeat ✅ LOW RISK

**Impact:** Eliminates ~120 DB writes/hour/user (biggest single saving)

### Changes
- [ ] Remove 30-second `setInterval` heartbeat in `src/hooks/usePresence.ts`
- [ ] Write `online` only when `visibilitychange` fires (hidden → visible)
- [ ] Write `away` only when `visibilitychange` fires (visible → hidden)
- [ ] Write `offline` only on `beforeunload` (keep existing handler)
- [ ] Increase staleness threshold from 2 minutes → 5 minutes in `fetchPresence()`
- [ ] Consider adding a daily DB cron to mark users offline if `last_seen > 10 minutes`

### Risk Flags
- ⚠️ **Crashed tabs:** If a browser crashes without firing `beforeunload`, the user remains shown as "online" until the staleness threshold kicks in. With the current 2-min threshold this is brief; with 5-min it's longer but acceptable.
- ⚠️ **Typing indicators:** Unaffected — `setTyping()` writes on keypress, not on a timer.

### Files Modified
- `src/hooks/usePresence.ts` (lines 128–182)

### Admin Testing
- [ ] Open messaging module, verify green online dots update when a teammate opens/closes the app
- [ ] Verify typing indicators still appear in real-time during conversation
- [ ] Leave tab idle for 6+ minutes, verify status shows as offline/away (not stuck on online)
- [ ] Force-close browser, verify teammate's status eventually shows offline within 5 minutes

---

## Priority 2 — Remove Subscription Polling ✅ DONE

**Impact:** Eliminates ~60 edge function calls/hour (Stripe API hits) per active user

### Changes
- [x] Removed 60-second `setInterval` polling of `check-subscription` in `AuthContext.tsx`
- [x] Subscription now checked only on session change (login) and after checkout success
- [x] Replaced direct `supabase.functions.invoke('check-subscription')` in SubscriptionSection with `checkSubscription()` from AuthContext (no duplicate call)

### Risk Flags
- ✅ **None.** Subscription status updates on login and after Stripe checkout redirect. Manual refresh available via Settings page.

### Files Modified
- `src/contexts/AuthContext.tsx` (removed 60s interval)
- `src/components/dashboard/settings/SubscriptionSection.tsx` (use AuthContext's checkSubscription)

### Admin Testing
- [ ] Log in — verify subscription badge appears correctly
- [ ] Navigate between pages — confirm NO subscription API calls in Network tab
- [ ] Complete a Stripe checkout — confirm subscription status updates immediately after redirect

---

## Priority 3 — Lazy Realtime Subscriptions ✅ DONE

**Impact:** Reduces global WebSocket traffic by ~60% (4 fewer tables broadcasting globally)

### Changes
- [x] Keep `bookings`, `vehicles`, `payments` in the global FleetContext channel
- [x] Move `damage_claims` subscription to Claims/Pulse page-level hook
- [x] Move `customers` subscription to Customers page-level hook
- [x] Move `vehicle_inspections` subscription to Inspections page-level hook
- [x] Move `maintenance_schedules` subscription to Maintenance page-level hook
- [x] Create `useRealtimeTable(tableName)` utility hook for consistent page-level subscriptions

### Risk Flags
- ⚠️ **Dashboard counters:** The Dashboard/Pulse module displays counts from `damage_claims` and `customers`. After this change, these counts update only when the user navigates to those pages OR when FleetContext does a full refresh (initial load, manual refresh). The data is still accurate on navigation — it just won't live-update in the background while on a different page.
- ⚠️ **Background toasts:** Toast notifications for new damage claims and new customers will stop appearing globally. However, the `notifications` table (which has its own realtime subscription) still fires the notification bell — the toast is redundant.
- ✅ **Bookings, vehicles, payments** remain live everywhere — the most operationally critical data.

### Files Modified
- `src/contexts/FleetContext.tsx` (realtime channel setup)
- New: `src/hooks/useRealtimeTable.ts` (shared utility)
- Page components that consume moved tables

### Admin Testing
- [ ] Have ops user create a booking while admin is on Settings → navigate to Book → confirm booking appears immediately
- [ ] Have ops user file a damage claim → confirm admin sees it when navigating to Claims page (no global toast expected)
- [ ] Check Dashboard counters after navigating from another page — data should be current
- [ ] Verify Pulse module still shows accurate live data when actively viewing it

---

## Priority 4 — Edge Function JWT Audit 🟡 MEDIUM RISK

**Impact:** Prevents unauthenticated cold starts on protected functions

### Current State
All 37 edge functions have `verify_jwt = false` in `config.toml`. Per Lovable Cloud's signing-keys system, `verify_jwt` stays `false` but JWT verification is done in code via `getClaims()`.

### Changes
- [ ] Audit each function to confirm it validates auth in code
- [ ] Categorize functions into public vs. authenticated
- [ ] Add `getClaims()` verification to any authenticated function missing it

### Functions That MUST Remain Public (no JWT check)
| Function | Reason |
|----------|--------|
| `demo-login` | Called before any auth session exists |
| `check-subscription` | Called during auth flow before session is established |
| `create-checkout-session` | May be called from pricing page before login |
| `create-payment-checkout` | Same as above |
| `accept-invite` | Called during signup flow |
| `customer-portal` | Stripe redirect, may not have session |

### Functions That Should Verify Auth in Code
All remaining 31 functions (voice, AI, fleet tools, reporting, notifications, etc.)

### Risk Flags
- ⚠️ **High breakage risk if done incorrectly.** Any function called before auth session is established will return 401 if locked down.
- ✅ **Config stays `verify_jwt = false`** per Lovable Cloud architecture. Changes are code-level only.

### Admin Testing
- [ ] Test demo login flow end-to-end
- [ ] Test Stripe checkout from pricing page (unauthenticated)
- [ ] Test team invite acceptance flow
- [ ] Test all AI features (Rari, voice, demand forecast) while authenticated
- [ ] Test report generation while authenticated

---

## Priority 5 — Storage Cleanup ✅ DONE (Cron Scheduled)

**Impact:** Reduces storage footprint, prevents orphan accumulation

### Changes
- [x] `cleanup-unmatched-photos` edge function scheduled as weekly cron (Sundays 4am UTC)
- [x] `purge_old_notifications()` scheduled as daily cron (3am UTC)
- [ ] Audit `vehicle-photos` bucket for duplicate enhanced/original pairs
- [ ] Consider replacing original storage path on enhancement instead of storing both copies
- [ ] Review `damage-photos` bucket for claims that have been resolved/deleted

### Risk Flags
- ⚠️ **Enhanced photos:** If we delete originals after enhancement, there's no rollback. Recommend keeping both for now, but tracking storage size.
- ✅ **Cleanup function already exists** and is tested — just needs scheduling.

### Admin Testing
- [ ] Upload photos, run cleanup, verify gallery still loads correctly
- [ ] Verify enhanced photos still display after cleanup
- [ ] Check that no active vehicle photos are accidentally deleted

---

## Security Fix — `beforeunload` Anon Key Usage

### Issue
`src/hooks/usePresence.ts` line 159-160 uses `VITE_SUPABASE_PUBLISHABLE_KEY` as the Bearer token in the `beforeunload` fetch. This authenticates as the anon role, not the user, potentially bypassing RLS on `user_presence`.

### Status
- **Known issue**, documented in `LAUNCH_READINESS_TODO.md` as P0
- **Cannot be fully fixed** — `beforeunload` doesn't reliably support async operations with user tokens
- **Mitigation:** Priority 1 (removing heartbeat) reduces the frequency of this handler firing
- **Current RLS:** `user_presence` requires `auth.uid() = user_id` for UPDATE, so the anon-key PATCH silently fails (no security breach, but the offline status doesn't get set)

### Recommendation
- Document as accepted risk
- The visibility-change approach in Priority 1 makes this handler less critical
- Long-term: consider using Supabase Realtime Presence (channel-based, no DB writes) instead

---

## Implementation Notes

| Priority | Dependencies | Can Ship Independently | Rollback Complexity |
|----------|-------------|----------------------|-------------------|
| 1 | None | ✅ Yes | Simple — revert one file |
| 2 | None | ✅ Yes | Simple — revert one line |
| 3 | None (but test after 1 & 2) | ✅ Yes | Medium — multiple files |
| 4 | None | ✅ Yes | Simple — revert code changes |
| 5 | None | ✅ Yes | Simple — stop cron |

- **Priority 1 and 2 can be done in parallel** (different files, no overlap)
- **Priority 3 requires the most testing** since it changes data flow architecture
- **Priority 4 is code-level** but has the highest breakage risk if done incorrectly
- Each priority is independent and can be shipped/rolled back separately

---

## Migration Roadmap

See **[CLOUD_MIGRATION_ROADMAP.md](./CLOUD_MIGRATION_ROADMAP.md)** for the full plan to migrate off Lovable Cloud to an external provider stack.

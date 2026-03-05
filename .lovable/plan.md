

# Cloud Optimization To-Do and Realtime Behavior Analysis

## Answer: Does the Admin See Live Booking Changes?

**Yes, it is immediately live. No manual refresh needed.**

Here is exactly what happens when an operations user creates a booking while the admin is on another module:

1. Ops user inserts a booking via the UI
2. Supabase broadcasts a `postgres_changes` event over the WebSocket
3. The admin's `FleetContext` receives this event (it listens to `bookings` table changes globally, always on)
4. `debouncedRefresh('bookings')` fires after a 500ms debounce window
5. FleetContext re-fetches bookings from the database in the background (no loading spinner, no UI interruption)
6. When the admin navigates to the Book module, the new booking is already in the in-memory state

**This is not heavy on compute for module toggling.** Module navigation does not trigger API calls -- it simply renders a different React component using the same FleetContext data that is already loaded in memory. The "cost" comes from the always-on WebSocket channel and the background re-fetch it triggers, not from the navigation itself.

The only scenario where data would be stale is if the WebSocket silently disconnects (e.g., tab backgrounded for 5+ minutes). The `useRealtimeReconnect` hook handles that case by detecting staleness and forcing a reconnection when the tab becomes visible again.

---

## Plan: Create `CLOUD_OPTIMIZATION_TODO.md`

Create a single markdown file titled "Cloud Optimization Plan -- Admin Testing Checklist" containing the following sections:

### File: `CLOUD_OPTIMIZATION_TODO.md`

**Contents:**

1. **Priority 1 (Low Risk)**: Replace presence heartbeat
   - Remove 30s `setInterval` in `usePresence.ts`
   - Write only on visibility change events
   - Add 5-minute DB staleness threshold
   - Test: messaging online indicators still work, typing indicators still work
   - Risk flag: crashed tabs may show stale "online" status

2. **Priority 2 (Low Risk)**: Add global `staleTime` to QueryClient
   - Set 5-minute default in `App.tsx` QueryClient config
   - Test: data still refreshes after mutations, realtime still invalidates cache
   - Risk flag: none (only 2 hooks use React Query currently)

3. **Priority 3 (Medium Risk)**: Lazy realtime subscriptions
   - Keep `bookings`, `vehicles`, `payments` global in FleetContext
   - Move `damage_claims`, `customers`, `vehicle_inspections`, `maintenance_schedules` to page-level
   - Test: Dashboard counters still accurate, Pulse module still shows live data, toast notifications for moved tables only fire on relevant pages
   - Risk flag: background toasts for damage claims and new customers will stop appearing globally

4. **Priority 4 (Medium Risk)**: Edge function JWT verification
   - Audit all 37 functions, categorize as must-stay-open vs. can-lock-down
   - Functions that MUST stay `verify_jwt = false`: `check-subscription`, `create-checkout-session`, `create-payment-checkout`, `demo-login`, `accept-invite`
   - Test: all auth flows, payment flows, and demo login still work after change
   - Risk flag: any function called before auth session is established will break if locked down

5. **Priority 5 (Low Risk)**: Storage cleanup
   - Schedule `cleanup-unmatched-photos` to run periodically
   - Audit duplicate hero/enhanced photos
   - Test: photo gallery still loads, enhanced photos still display

6. **Security fix**: `usePresence.ts` `beforeunload` handler uses anon key
   - Document as known issue (cannot use authenticated fetch on page unload reliably)
   - Reducing heartbeat frequency in Priority 1 minimizes exposure

7. **Migration roadmap reference**: Link to `CLOUD_MIGRATION_ROADMAP.md` (to be created separately)

### Admin Testing Checklist (included in the file)
- [ ] After Priority 1: Open messaging, verify online dots update when teammate opens/closes app
- [ ] After Priority 1: Verify typing indicators still appear in real-time
- [ ] After Priority 2: Navigate between modules rapidly, confirm no redundant loading spinners
- [ ] After Priority 3: Have ops user create a booking while admin is on Settings -- navigate to Book, confirm booking appears
- [ ] After Priority 3: Have ops user file a damage claim -- confirm admin sees it when navigating to Claims (no global toast expected)
- [ ] After Priority 4: Test demo login, Stripe checkout, team invite acceptance
- [ ] After Priority 5: Upload photos, verify no orphans accumulate

### Implementation Notes
- Each priority is independent and can be shipped/rolled back separately
- Priority 1 and 2 can be done in parallel (different files, no overlap)
- Priority 3 requires the most testing since it changes data flow architecture
- Priority 4 is config-only but has the highest breakage risk if done incorrectly



# Hardened Session & Data Recovery System

## Executive Summary

This plan creates an enterprise-grade session management system that:
1. Keeps users logged in during long work sessions (8+ hours) while staying secure
2. Proactively refreshes sessions when returning from idle/backgrounded tabs
3. Properly logs out users when tokens are truly expired (instead of leaving them stuck)
4. Reconnects real-time channels that silently disconnect during idle
5. Makes the configurable `sessionTimeout` setting actually work (currently it's stored but not enforced)
6. Provides clear recovery paths instead of "stuck loading" states

---

## Root Cause Analysis

**Why the "stuck state" happens:**

```text
Current Flow (BROKEN):
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User logs in, works for a while                                  │
│ 2. User backgrounds tab (goes to lunch, meetings, etc.)             │
│ 3. Supabase JWT expires (default: 1 hour) or websocket disconnects  │
│ 4. User returns to tab                                              │
│ 5. App tries to fetch data with expired token                       │
│ 6. Fetch silently fails OR times out                                │
│ 7. `isRefreshingRef.current` stays TRUE (concurrency guard stuck)   │
│ 8. UI shows "Loading..." forever - user is STUCK                    │
│                                                                     │
│ The session validation code only runs on MOUNT, not on TAB FOCUS    │
│ The `sessionTimeout` setting in Team Settings is stored but IGNORED │
└─────────────────────────────────────────────────────────────────────┘
```

**What should happen:**

```text
Fixed Flow (TARGET):
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User logs in, works for a while                                  │
│ 2. User backgrounds tab                                             │
│ 3. JWT approaches expiry                                            │
│ 4. User returns to tab                                              │
│ 5. Visibility listener fires IMMEDIATELY                            │
│ 6. App calls supabase.auth.refreshSession()                         │
│ 7a. If refresh SUCCEEDS → Session extended, data fetches normally   │
│ 7b. If refresh FAILS → Clean logout + redirect to /auth with toast  │
│                                                                     │
│ For long work sessions: Token is proactively refreshed before       │
│ expiry based on user's configured sessionTimeout preference         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Compatibility with Previous Fixes

**Previous fix (stale cache/refresh loops):**
- ✅ PWA caching excluded HTML from precache → KEEP
- ✅ Preview mode disables service workers → KEEP  
- ✅ Hard Reload button + staleBuildRecovery.ts → KEEP
- ✅ `force` parameter on refreshData() → KEEP & ENHANCE

**This plan ADDS to those fixes without conflicts:**
- New visibility change listener in AuthContext
- Session health pre-check before data fetches
- Real-time channel reconnection on focus
- Actually enforce the sessionTimeout setting

---

## Implementation Phases

### Phase 1: Session Refresh on Tab Focus

**File:** `src/contexts/AuthContext.tsx`

Add a visibility change listener that proactively refreshes the session when users return from idle:

```text
New state/refs to add:
- lastVisibleTimestamp: useRef<number>(Date.now())
- sessionHealth: 'healthy' | 'refreshing' | 'checking' | 'expired'

New effect - visibilitychange listener:
1. Track when tab becomes hidden (lastVisibleTimestamp)
2. When tab becomes visible:
   - Calculate how long tab was hidden
   - If hidden > 60 seconds:
     a. Set sessionHealth = 'refreshing'
     b. Call supabase.auth.refreshSession()
     c. If error (token expired beyond refresh window):
        - Set sessionHealth = 'expired'
        - Show toast: "Your session expired. Please sign in again."
        - Call signOut() → redirects to /auth
     d. If success:
        - Set sessionHealth = 'healthy'
        - Session auto-updates via onAuthStateChange
        - Log: "[Auth] Session refreshed after idle"

Key principle: Use SAME signOut() flow that already exists
              This ensures consistent UX (toast + redirect)
```

**Why this fixes the stuck state:**
Instead of trying to fetch data with an expired token and timing out, we detect the idle period FIRST and either refresh the token or log out cleanly.

---

### Phase 2: Pre-Fetch Session Validation

**File:** `src/contexts/FleetContext.tsx`

Before attempting to fetch data, verify the session is valid:

```text
Modify refreshDataCore() - add at the START:

1. Check if session exists:
   const { data: { session } } = await supabase.auth.getSession();
   
2. If no session:
   - setLoading(false)
   - setError("Session expired. Please sign in again.")
   - Clear isRefreshingRef.current = false
   - Return early (don't attempt network requests)

3. If session exists, check token expiry:
   - Parse session.expires_at
   - If < 5 minutes remaining:
     a. Attempt supabase.auth.refreshSession()
     b. If fails → return early with session expired error
     c. If succeeds → proceed with data fetch

Why: This prevents the "fetch with dead token → timeout → stuck" scenario
```

**Critical fix for the concurrency guard:**
```text
In the catch block AND early-return paths:
- ALWAYS set isRefreshingRef.current = false
- This prevents the guard from getting "stuck" on errors
```

---

### Phase 3: Real-time Channel Reconnection

**File:** `src/contexts/FleetContext.tsx`

Add visibility change handling to detect and reconnect stale real-time channels:

```text
New ref:
- lastRealtimeEventTimestamp: useRef<number>(Date.now())

Modify each postgres_changes callback:
- At the start of each callback, update:
  lastRealtimeEventTimestamp.current = Date.now();

New effect - channel health check on visibility change:
1. Listen for 'visibilitychange' events
2. When document becomes visible:
   - Calculate time since lastRealtimeEventTimestamp
   - If > 5 minutes AND tab was hidden:
     a. Log: "[FleetContext] Realtime channel may be stale, reconnecting..."
     b. Remove current channel: supabase.removeChannel(channelRef.current)
     c. Clear subscribedForRef.current = null
     d. Channel will auto-recreate on next effect cycle

Why: Supabase websockets silently disconnect when tabs are backgrounded
     for extended periods. This forces a clean reconnection.
```

---

### Phase 4: Enforce Session Timeout Setting

The Team Settings UI already lets admins configure `sessionTimeout` (15 min to 8 hours), but it's never enforced. Let's make it work.

**File:** `src/contexts/AuthContext.tsx`

```text
New effect - load and apply session timeout preference:

1. After user is set, fetch their team settings:
   const { data } = await supabase
     .from('user_settings')
     .select('settings')
     .eq('user_id', user.id)
     .eq('category', 'team')
     .maybeSingle();
   
2. Parse sessionTimeout (default: 60 minutes if not set)
   const timeoutMinutes = parseInt(data?.settings?.sessionTimeout || '60');

3. Store in ref: sessionTimeoutMs.current = timeoutMinutes * 60 * 1000

4. Start an inactivity timer:
   - Track last user activity (mousemove, keydown, click, scroll)
   - If no activity for sessionTimeoutMs:
     a. Show warning toast: "Session expiring soon due to inactivity"
     b. Wait 60 more seconds
     c. If still no activity → call signOut()
   
5. For long work sessions (8 hours):
   - The timer only triggers on TRUE inactivity
   - Any user interaction resets the timer
   - Active users are never logged out
```

**Why users can "stay logged in for long work hours":**
- The timeout is based on INACTIVITY, not absolute time
- If someone works actively for 8 hours, the timer keeps resetting
- Only truly idle users get logged out
- Admins can set up to 8-hour timeout for minimal interruption

---

### Phase 5: Enhanced Recovery UI

**File:** `src/components/dashboard/DashboardOverviewEnhanced.tsx`

Make recovery buttons smarter by checking session first:

```text
Modify the "Retry Data" button onClick:

1. First, attempt session refresh:
   const { error } = await supabase.auth.refreshSession();
   
2. If refresh fails:
   - Show toast: "Session expired, redirecting to login..."
   - Navigate to /auth (using window.location.href for reliability)
   - Return (don't retry data)

3. If refresh succeeds:
   - Proceed with refreshData(true)
   
Add a new "Sign Out & Restart" button:
- For cases where users want a completely fresh start
- Calls signOut() → /auth
- More direct than "Clear Cache" for auth-related issues
```

**Modify error messaging:**
```text
Detect error type and show appropriate message:
- Timeout → "Connection timed out. Try refreshing your session."
- 401/403 → "Session expired. Please sign in again." 
- Network → "Network error. Check your connection."
- Generic → Current message
```

---

### Phase 6: Expose Session Health (Optional Enhancement)

**File:** `src/contexts/AuthContext.tsx`

Add to AuthContextType:
```text
sessionHealth: 'healthy' | 'refreshing' | 'expired' | 'idle-warning'
refreshSession: () => Promise<boolean>
```

This allows any component to:
1. Check current session health
2. Manually trigger a session refresh
3. Show appropriate UI based on session state

**File:** `src/components/common/SessionHealthIndicator.tsx` (new, optional)

A subtle indicator in the header that shows:
- Nothing when healthy
- Spinner when refreshing
- Yellow dot when idle > 5 minutes
- Red dot when refresh failed

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add visibility listener, session timeout enforcement, inactivity tracking, expose sessionHealth |
| `src/contexts/FleetContext.tsx` | Pre-flight session check, realtime reconnect on focus, fix concurrency guard |
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | Enhanced retry with session refresh, Sign Out button, better error messages |
| `src/components/common/SessionHealthIndicator.tsx` | **Create** - Optional visual health indicator |

---

## Technical Details

### Token Lifecycle
```text
Supabase JWT defaults:
- Access token: 1 hour
- Refresh token: 1 week
- Auto-refresh: Client SDK refreshes when < 1 minute remaining

The problem: Auto-refresh only works if the app is ACTIVE
When tab is backgrounded, no refresh happens → token expires
```

### Session Timeout Options

The existing Team Settings UI provides these options:
- 15 minutes (high security)
- 30 minutes (default)
- 1 hour
- 2 hours  
- 8 hours (minimal interruption for long work sessions)

**Recommendation for "stay logged in for long work hours":**
Admins should set to 8 hours. The implementation tracks INACTIVITY, so active users won't be interrupted. Only truly idle sessions expire.

---

## Expected Behavior After Implementation

### Scenario 1: Short idle (< 60 seconds)
```text
User returns → No action needed → App works normally
```

### Scenario 2: Medium idle (1-30 minutes, token still refreshable)
```text
User returns → Visibility listener fires → Session refreshes →
Realtime reconnects → Data fetches cleanly
```

### Scenario 3: Long idle (token expired beyond refresh)
```text
User returns → Visibility listener fires → Session refresh fails →
Toast: "Session expired" → Clean redirect to /auth
```

### Scenario 4: True inactivity (exceeds sessionTimeout)
```text
User leaves for hours → Inactivity timer fires →
Warning toast → 60s grace period → signOut() if still idle
```

### Scenario 5: Active 8-hour work session
```text
User works all day → Activity events reset timer continuously →
Token refreshes in background → Never logged out
```

---

## No Breaking Changes

- Uses existing `signOut()` flow (same toast, same redirect)
- Uses existing `refreshData(force: true)` mechanism
- Settings UI already exists (just enforcement is new)
- Recovery UI is enhanced, not replaced
- All existing session verification code stays intact

---

## Validation Checklist

After implementation, test these scenarios:

1. **Basic idle:** Open app, wait 2 minutes idle, interact → Should work normally
2. **Backgrounded tab:** Open app, switch to another tab for 5 minutes, return → Session should refresh automatically
3. **Long idle:** Set timeout to 15 min, leave for 20 min → Should see warning then logout
4. **Token expiry:** Use app, wait > 1 hour (token expires), return → Either refreshes or clean logout
5. **Realtime:** Background tab, have another user make a change, return → Should see update after reconnect
6. **Recovery UI:** Force a timeout error → Retry button should refresh session first
7. **Long work session:** Set 8-hour timeout, use actively for hours → Never interrupted

---

## Summary

This comprehensive plan addresses the root cause of the "stuck loading" state while adding enterprise-grade session management:

1. **Visibility listener** catches idle returns and proactively refreshes
2. **Pre-fetch validation** prevents dead-token requests from timing out
3. **Realtime reconnection** ensures live updates resume after idle
4. **Inactivity enforcement** makes the sessionTimeout setting work
5. **Enhanced recovery UI** provides auth-aware retry and clear escape hatches
6. **Long work session support** via inactivity-based (not time-based) timeouts

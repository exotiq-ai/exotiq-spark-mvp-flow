

# Fix: Unexpected Redirect to Onboarding During Active Session

## Problem Summary

While editing photos in the fleet page, the user `denverexoticrentalcars@gmail.com` is occasionally experiencing unexpected page reloads that redirect them to the onboarding wizard (Step 1 of 4 - Business Profile).

## Root Cause Analysis

**Two issues are causing this behavior:**

### Issue 1: Database State
The user's profile has `onboarding_completed: false` in the database:
```sql
-- Current state
SELECT onboarding_completed FROM profiles 
WHERE email = 'denverexoticrentalcars@gmail.com';
-- Result: false
```

Despite clearly being past onboarding (they're actively using the dashboard to manage their fleet), the flag was never set to `true`.

### Issue 2: Auth Event Handling Race Condition
The `onAuthStateChange` handler in `AuthContext.tsx` triggers `checkOnboardingStatus()` on **every** `SIGNED_IN` event. However, `SIGNED_IN` can be emitted in multiple scenarios:

1. **True fresh login** - User just entered credentials
2. **Session restoration** - Page refresh with valid cached session  
3. **Token refresh** - Session was refreshed (via `refreshSession()` calls)

The code at line 300-345 runs the onboarding check without distinguishing between these scenarios:

```typescript
if (event === 'SIGNED_IN' && session?.user) {
  // ... 
  checkOnboardingStatus(userId);  // Always runs!
}
```

### The Trigger Chain
```text
1. User editing photos on /dashboard
2. Tab hidden for >60 seconds (or token nearing expiry)
3. useSessionHealth.refreshSession() called
4. supabase.auth.refreshSession() may emit SIGNED_IN event
5. checkOnboardingStatus() runs
6. Finds onboarding_completed === false
7. navigate('/onboarding') triggers
8. User sees Step 1 of 4 unexpectedly
```

---

## Solution

### Fix 1: Skip Onboarding Check on Dashboard/Fleet Routes (Code Fix)

The `SIGNED_IN` handler should NOT run `checkOnboardingStatus()` if the user is already on an authenticated route (dashboard, fleet, bookings, etc.). They're clearly past onboarding if they got there.

**File: `src/contexts/AuthContext.tsx`**

Add a guard before calling `checkOnboardingStatus()`:

```typescript
// Inside the SIGNED_IN handler (around line 344)
if (currentPendingToken) {
  await processPendingInvite(userId, currentPendingToken);
  if (seq !== authEventSeqRef.current) return;
  navigate('/dashboard');
} else {
  // NEW GUARD: Only check onboarding if user is on auth page or root
  // If they're already on an authenticated route, don't disrupt their session
  const protectedRoutes = ['/dashboard', '/fleet', '/bookings', '/customers', '/vault', '/pulse'];
  const isOnProtectedRoute = protectedRoutes.some(route => 
    currentPath.startsWith(route)
  );
  
  if (!isOnProtectedRoute) {
    // Only run onboarding check when coming from login/auth flow
    checkOnboardingStatus(userId);
  } else {
    devLog('[Auth] User already on protected route, skipping onboarding check');
  }
}
```

### Fix 2: Update User's Onboarding Status (Data Fix)

Since this user is clearly past onboarding, we should update their profile:

```sql
UPDATE profiles 
SET onboarding_completed = true 
WHERE email = 'denverexoticrentalcars@gmail.com';
```

**Note:** This is a one-time data fix. The code fix (Fix 1) prevents this from happening to other users in similar situations.

### Fix 3: Handle TOKEN_REFRESHED Event Explicitly (Optional Enhancement)

For additional robustness, explicitly handle the `TOKEN_REFRESHED` event to ensure it doesn't accidentally trigger side effects:

```typescript
// Add after the PASSWORD_RECOVERY handler (around line 297)
if (event === 'TOKEN_REFRESHED') {
  devLog('[Auth] Token refreshed, no navigation needed');
  return;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Add route guard before `checkOnboardingStatus()`, handle `TOKEN_REFRESHED` explicitly |

## Database Migration

Update the affected user's onboarding status:

```sql
UPDATE profiles 
SET onboarding_completed = true 
WHERE id = 'fd9bb57e-8ad7-4db9-9f8e-bfba30aac1e2';
```

---

## Expected Behavior After Fix

1. User editing photos on dashboard
2. Session refreshes occur silently (no navigation)
3. Token refresh events are handled gracefully
4. User only sees onboarding wizard on true first-time login with `onboarding_completed = false`
5. User `denverexoticrentalcars@gmail.com` will no longer be redirected

---

## Technical Details

### Why This Happened
- The user likely completed onboarding in a previous version before the `onboarding_completed` flag was properly implemented, leaving their profile in an incomplete state
- Session refresh mechanisms (visibility change handler, near-expiry refresh) can trigger auth events that re-run the onboarding check

### Prevention
- The route guard ensures that users who are clearly authenticated and working within the app are never disrupted
- Explicitly handling `TOKEN_REFRESHED` prevents any ambiguity in the auth event handling


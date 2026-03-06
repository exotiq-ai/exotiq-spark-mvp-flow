

# Fix Magic Link -- Rate Limiting and UX

## Root Cause

The magic link uses `supabase.auth.signInWithOtp()` which hits the `/otp` endpoint. Supabase enforces a rate limit of ~1 request per 60 seconds on this endpoint. The current UI has no cooldown -- users can spam the button and immediately hit 429 errors with a raw Supabase message like "For security purposes, you can only request this after 11 seconds."

Password reset works because it uses `/recover`, a different endpoint with separate rate limits.

## Fixes

### 1. Add Cooldown Timer to Magic Link Button

After a successful send, disable the button for 60 seconds with a visible countdown ("Resend in 42s"). This prevents users from hitting the rate limit.

**File:** `src/pages/Auth.tsx`
- Add `cooldownSeconds` state (starts at 0)
- After successful send, set to 60 and decrement via `setInterval`
- Disable button and show countdown text while `cooldownSeconds > 0`

### 2. Improve Error Message for 429

Catch the specific rate-limit error and show a user-friendly message instead of the raw Supabase text.

**File:** `src/contexts/AuthContext.tsx` (in `signInWithMagicLink`)
- Check if `error.message` contains "security purposes" or `error.status === 429`
- Replace with: "Please wait a moment before requesting another magic link."

### 3. Add Cooldown to Password Reset Too

Apply the same cooldown pattern to the "Send Reset Link" button to prevent the same issue there (auth logs show 429s on `/recover` too from `hello@exotiq.ai`).

**File:** `src/pages/Auth.tsx`
- Same cooldown pattern for `handlePasswordReset`

## Technical Details

### Cooldown Logic (Auth.tsx)

```text
const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);

useEffect(() => {
  if (magicLinkCooldown <= 0) return;
  const timer = setInterval(() => {
    setMagicLinkCooldown(prev => prev - 1);
  }, 1000);
  return () => clearInterval(timer);
}, [magicLinkCooldown]);

// In handleMagicLink, after successful send:
setMagicLinkCooldown(60);

// Button:
<Button disabled={loading || magicLinkCooldown > 0}>
  {magicLinkCooldown > 0 ? `Resend in ${magicLinkCooldown}s` : 'Send Magic Link'}
</Button>
```

### Friendlier 429 Error (AuthContext.tsx)

```text
if (error) {
  const isRateLimit = error.message?.includes('security purposes') 
    || error.status === 429;
  toast({
    title: "Error Sending Magic Link",
    description: isRateLimit 
      ? "Please wait a moment before requesting another link."
      : error.message,
    variant: "destructive"
  });
}
```

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add 60s cooldown timer to magic link and password reset buttons |
| `src/contexts/AuthContext.tsx` | Friendlier error messages for 429 rate limits on `signInWithMagicLink` and `resetPassword` |


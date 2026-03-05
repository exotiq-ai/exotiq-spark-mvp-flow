

# Fix: Weekly Intelligence Digest Edge Function

## Problem
The `weekly-intelligence-digest` function is not registered in `supabase/config.toml`, so it was never deployed. The browser's CORS preflight request gets rejected because there's no function endpoint to respond to it — hence the `net::ERR_FAILED` and "doesn't pass access control check" errors in your screenshot.

## Fix

**1. Add to `supabase/config.toml`:**
```toml
[functions.weekly-intelligence-digest]
verify_jwt = false
```

This is the only change needed. The function code and frontend code are both correct — the function just wasn't registered for deployment.

## Secondary: 406 Errors
The repeated `406` errors visible in the console are from other database queries (likely RLS policy restrictions on tables being queried). These are pre-existing and unrelated to the digest. I can investigate those separately if they're causing issues elsewhere.

## Files Changed
| File | Change |
|------|--------|
| `supabase/config.toml` | Add `weekly-intelligence-digest` entry |


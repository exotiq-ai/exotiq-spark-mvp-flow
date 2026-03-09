

# Fix: Signing Flow — 3 Bugs Blocking End-to-End

## Problems Found

1. **`fill-rental-template` and `send-signed-document` use `auth.getClaims()` which doesn't exist** in the Supabase JS client. The working `generate-signed-pdf` uses `auth.getUser()`. This means template auto-fill silently fails (the UI gracefully falls back to the raw template, so you wouldn't notice — but the auto-fill never actually runs).

2. **Neither `fill-rental-template` nor `send-signed-document` are registered in `supabase/config.toml`**. Without config entries, these functions won't be deployed. The plan called for adding them but it was missed during implementation.

## Fixes

### Fix 1: `fill-rental-template/index.ts` (lines 31-40)
Replace `getClaims` with `getUser` (matching the working pattern from `generate-signed-pdf`):
```typescript
const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
if (authError || !user) { ... }
const userId = user.id;
```

### Fix 2: `send-signed-document/index.ts` (lines 39-47)
Same fix — replace `getClaims` with `getUser`.

### Fix 3: `supabase/config.toml`
Append two entries:
```toml
[functions.fill-rental-template]
verify_jwt = false

[functions.send-signed-document]
verify_jwt = false
```

## What This Unblocks

Once these 3 fixes are applied:
- Clicking "Sign Document" on a booking → calls `fill-rental-template` → auto-fills the uploaded template with booking/customer/vehicle data → opens SigningCeremony with the filled PDF
- Signing completes → `generate-signed-pdf` appends signature page (already working)
- Email delivery via `send-signed-document` becomes functional

No other code changes needed — the UI wiring is already correct with proper fallback handling.


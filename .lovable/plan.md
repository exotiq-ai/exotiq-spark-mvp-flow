## Assessment

This feature was partially built, but the access path is brittle and the dashboard itself is not production-ready.

What I verified:
- `hello@exotiq.ai` exists and is active.
- `hello@exotiq.ai` is present in the `super_admins` table.
- The backend function returns `true` for `hello@exotiq.ai`.
- The browser logs show the race condition: the guard first renders “not super admin” and redirects, then the async check returns `true` after it is too late.
- The Super Admin page does exist and includes a Billing tab, but other tabs use client-side admin APIs that are not available in the browser, so “full super-admin functionality” needs hardening rather than just exposing the route.

Do I know what the issue is? Yes.

The immediate redirect is caused by the super-admin guard treating an initial unknown/auth-loading state as denied access. The backend says you are a super admin, but the UI redirects before that result wins.

## Plan

1. **Fix `/super-admin` access guard**
   - Keep `/super-admin` behind normal authentication first.
   - Reset the admin check whenever the user changes.
   - Do not redirect while auth or the super-admin RPC is still pending.
   - If access fails, show a clear access-denied screen with the signed-in email instead of silently kicking back to dashboard.
   - Remove noisy console logging once stable.

2. **Normalize the super-admin backend model**
   - Add a small migration to make `is_super_admin` check by `auth.users.id` first and fall back to email/profile matching, so future admin inserts are not fragile.
   - Ensure `hello@exotiq.ai` has the expected active super-admin permissions in the canonical table shape.
   - Keep this separate from tenant roles to preserve isolation.

3. **Make the dashboard available without browser-only admin APIs**
   - Replace `supabase.auth.admin.listUsers()` usage in `SuperAdminDashboard.tsx`; that API requires server privileges and is not valid from the browser.
   - Use database-backed views/RPCs for super-admin customer/team summaries instead.
   - Keep the Billing tab focused on tenant/team billing controls, because that is the part needed for the payment-due banner.

4. **Verify the Billing tab end-to-end**
   - Confirm the Billing tab can load all teams visible to super admins.
   - Confirm the dunning RPCs can set and clear banner states.
   - If “Denver Exotic Rentals” is not found by that exact name, surface the actual matching tenant/team names so you can pick the right account.

5. **Add a safe navigation affordance**
   - Add a visible Super Admin entry only for verified super admins, so you do not have to manually type `/super-admin`.
   - Keep it hidden from regular tenant users.

## Expected result

After implementation, signing in as `hello@exotiq.ai` and visiting `/super-admin` should land on the Super Admin Dashboard instead of redirecting. The Billing tab should be usable for setting the payment-due banner on a tenant, with clear errors if a tenant name does not exist or the backend blocks an action.
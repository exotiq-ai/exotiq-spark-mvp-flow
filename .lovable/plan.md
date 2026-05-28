
# Ship: Stage-3 Restriction + Auto-Clear

Two focused additions to the dunning system. No new schema — everything below uses what's already in `teams` + the `auto_clear_billing_dunning_for_email` RPC we shipped last round.

## 1. Stage-3 booking read-only enforcement

Goal: at `restriction` stage, the tenant can still see everything, but can't create new bookings or edit existing ones. Historical data, fleet view, reports, messaging, settings → all stay fully usable. No data loss, nothing destructive.

### New: `PaymentDueGuard.tsx`
- Thin wrapper component. Reads `usePaymentRestricted()` from existing `useBillingDunning` hook.
- When restricted: renders a centered inline notice card (semantic tokens, destructive tone) with:
  - Headline: "Account access is limited"
  - Body: short copy mirroring the banner
  - Primary CTA: "Complete payment" → same `create-checkout-session` invoke as the banner
  - Secondary: "Contact support" mailto
- When not restricted: renders `children` untouched.
- Owners/Admins still see the CTA; non-billing roles see a "Ask your account owner" variant (matches banner behavior).

### Wire it into Bookings create/edit surfaces
Wrap the actual create + edit entry points so read-only is enforced no matter how the user got there (button, deep link, Cmd+K). Read-only specifically means:
- "New booking" button → disabled with tooltip "Payment required to create bookings"
- `EnhancedBookingDialog` open in create or edit mode → guard intercepts and shows the notice instead of the form
- Inline edits on the booking detail page (status changes, payment record edits, reschedule) → disabled with the same tooltip
- Cancel/decline confirmation dialogs → also disabled (they're mutations)
- Calendar drag-to-create/drag-to-reschedule → no-op + toast "Payment required"

Explicitly NOT blocked at Stage 3:
- Viewing bookings list, calendar, detail pages
- Viewing customers, fleet, inspections, reports, messages
- Settings (especially Billing — they need to be able to pay)
- Check-in/check-out flows already in progress? **Open question — see below.**

### Files touched (frontend only, no schema)
**New**
- `src/components/guards/PaymentDueGuard.tsx`

**Edited**
- `src/components/bookings/EnhancedBookingDialog.tsx` (or wherever the create/edit dialog mounts) — wrap form body in guard
- `src/pages/Bookings.tsx` (or equivalent list page) — disable "New booking" CTA when restricted
- `src/components/bookings/BookingCalendar*.tsx` — block drag-create / drag-reschedule
- `src/pages/BookingDetail.tsx` (or equivalent) — disable inline edit affordances
- `src/hooks/useBillingDunning.ts` — already exports `usePaymentRestricted`, no change

## 2. Auto-clear when subscription goes active

Goal: when the tenant successfully pays, the banner disappears on its own — no manual Super Admin click required.

### Hook into existing `check-subscription` edge function
The RPC `auto_clear_billing_dunning_for_email(p_email)` already exists (security definer, service-role only). We just need to call it from `check-subscription` after it confirms `hasActiveSub === true`.

Add at the end of the active-subscription branch in `supabase/functions/check-subscription/index.ts`:

```typescript
if (hasActiveSub) {
  // Fire-and-forget: clear any active dunning stage for this user's team
  try {
    await supabaseClient.rpc('auto_clear_billing_dunning_for_email', { p_email: user.email });
  } catch (e) {
    logStep("auto-clear dunning failed (non-fatal)", { error: String(e) });
  }
}
```

That's it on the backend. The RPC handles the lookup, update, and audit log entry.

### Frontend nudge
`check-subscription` is already called on app load and from the Billing settings page. The success URL we use in `PaymentDueBanner` (`/dashboard/settings?tab=billing&status=active`) already lands them on a page that triggers `check-subscription`. Add a small effect on that page (if not already present) to call `check-subscription` once on mount when `?status=active` is in the URL, then refresh `useBillingDunning`.

### Files touched
**Edited**
- `supabase/functions/check-subscription/index.ts` — single RPC call after active-sub detection
- `src/components/settings/` billing tab (whichever file handles `?status=active`) — ensure `check-subscription` + `useBillingDunning.refresh()` fire on mount when the flag is present

## Out of scope (still)
- Auto-escalation cron (Reminder → Notice → Restriction on a timer)
- Email/SMS dunning
- Hard lockout / blocking Settings or read access
- Stripe webhook → auto-clear (we're piggybacking on `check-subscription` polling, which is sufficient for now since the success redirect triggers it immediately)

## One push-back / open question

**Check-in / check-out at Stage 3.** These are mutations on existing bookings (vehicle handoff, photo capture, signatures). If a tenant has an active rental that's mid-trip when you flip them to Restriction, blocking check-in or check-out would strand a real customer at the curb — which makes *you* the villain, not them.

**My recommendation:** allow check-in/check-out on already-confirmed bookings even at Stage 3. Only block *new* bookings, edits to future bookings, and reschedules. Inspections and photo uploads tied to an in-progress rental stay open. This keeps the pressure on the operator without ever touching an end-customer's trip.

If you want the harder version (block everything including check-in/out), say the word and I'll wire it that way instead — but I'd push back on it.


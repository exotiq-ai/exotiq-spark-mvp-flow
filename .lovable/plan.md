## 1. Fix the marketplace-visibility deposit gate (real bug)

Both branches of `enforce_deposit_source_on_marketplace_visible` are unreachable after the $1,000 backfill — the trigger cannot distinguish an operator's explicit choice from our fallback. Adopt the suggested `deposit_source_confirmed_at` signal.

### Migration
- Add `teams.deposit_source_confirmed_at timestamptz` (nullable).
- Backfill: leave NULL for every existing tenant. The backfilled $1,000 no longer counts as "confirmed" — operators must re-save in the Command Center before flipping visible. Sunset/already-visible tenants: set `deposit_source_confirmed_at = now()` for any team where `marketplace_visible = true` today, so we don't retroactively break live tenants (Exotiq).
- Replace `enforce_deposit_source_on_marketplace_visible()` body:
  - **Teams branch:** on `NEW.marketplace_visible = true AND OLD.marketplace_visible IS DISTINCT FROM true`, require `NEW.deposit_source_confirmed_at IS NOT NULL`. Error message names the CC path: "Set your default security deposit in Command Center → Team Settings before going live."
  - **Vehicles branch:** on `NEW.marketplace_visible = true AND OLD.marketplace_visible IS DISTINCT FROM true`, require `NEW.deposit_override_cents IS NOT NULL OR (SELECT deposit_source_confirmed_at FROM teams WHERE id = NEW.team_id) IS NOT NULL`. Error message: "Set a deposit override on this vehicle, or confirm the tenant default first."
- Keep the `resolve_deposit_cents` $1,000 COALESCE floor untouched — it stays as a runtime safety net; it just no longer satisfies the readiness gate.

### App wiring
- `TeamSettingsSection.tsx` deposit save: include `deposit_source_confirmed_at: new Date().toISOString()` in the same `update()` that writes `default_deposit_cents`. That's the only place operators set the tenant default, so it's the only place that stamps confirmation.
- Add `deposit_source_confirmed_at` to the `Team` type in `TeamContext.tsx` so downstream code (Marketplace Readiness panel, etc.) can surface "deposit default not yet confirmed" as a blocker before the operator hits the trigger.
- Update `MarketplaceReadinessPanel.tsx` to show the deposit-confirmation requirement alongside the existing checks (unblock UX so the failure isn't first seen as a Postgres exception).

### Verify
- Attempt `UPDATE teams SET marketplace_visible=true WHERE slug='gm-luxe'` → rejected (deposit_source_confirmed_at IS NULL). Save the deposit in CC → retry → succeeds.
- Attempt `UPDATE vehicles SET marketplace_visible=true` on a fredo-d-lima vehicle with no override and unconfirmed team default → rejected. Set an override → succeeds. Or confirm team default → succeeds.
- Exotiq (already visible) unaffected by the migration.

## 2. Add deposit expectation line to `receiptConfirmed` email

Single-line addition in `supabase/functions/send-renter-email/templates.ts`, in the small-print block currently at line 373 (the "refundable security deposit hold is placed at pickup" copy — which is now stale post-M6-D1 rev 2).

Replace that line with two sentences using existing variables `{{OPERATOR_NAME}}`:

> {{OPERATOR_NAME}} will email you a secure link about 72 hours before pickup to put a card on file for your refundable damage deposit. It's a hold, not a charge. Free cancellation with a full refund until 72 hours before pickup.

No new template variables needed — `OPERATOR_NAME` is already passed by `rent-payment-webhook` when it invokes `receiptConfirmed`. Redeploy `send-renter-email`.

### Verify
- Trigger a test receipt (existing money-battery hook) → email body contains the 72h deposit sentence naming the operator.

## Out of scope
- T-72h scheduler sweep for `stripe-create-deposit-setup-session` (still owed from prior turn's handoff).
- Extended-authorization MCC enrollment (Stripe ops task).
- The other renter email templates — only `receiptConfirmed` was flagged; approval/reminder/refund copy stays as-is until we see a specific ask.

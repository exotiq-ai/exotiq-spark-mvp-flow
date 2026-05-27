
# Payment-Due Banner & Escalation System

Manual, tenant-scoped payment dunning you control from Super Admin. Three escalating stages, polite-by-default copy, one-click Stripe Checkout for the plan you've already assigned them.

## How it works (tenant POV)

1. You flip a switch on Denver Exotiq from Super Admin → Billing Status.
2. Next time anyone on their team loads the dashboard, a banner appears at the top with a "Choose your plan" or "Complete payment" CTA.
3. Clicking the CTA opens Stripe Checkout in a new tab for the plan you've pre-assigned (no plan picker — fewer decisions, faster conversion).
4. Once Stripe confirms an active subscription, the banner auto-clears on next page load. You can also clear it manually.

## The three stages

| Stage | When you set it | Where it shows | Tone | Behavior |
|---|---|---|---|---|
| **1 — Reminder** | Trial ended, friendly nudge | Dashboard top banner, dismissible per-session | "Your trial has wrapped up — set up billing whenever you're ready." Soft blue/neutral. | Fully dismissible. CTA: "Choose plan". |
| **2 — Notice** | ~1–2 weeks after Stage 1 | Dashboard banner, **not dismissible**, plus a one-time modal on next login | "Payment is past due. Please complete billing to keep your account in good standing." Amber. | Persistent banner. Login modal shows once, then banner stays. |
| **3 — Restriction** | Last resort | Persistent banner + blocks **creating new bookings** (read-only on bookings module) | "Account access is limited until billing is completed." Red. | All historical data + reports still viewable. Read-only on Bookings + Fleet edits. No data loss, nothing destructive. |

Restoring access is one click in Super Admin (or automatic when Stripe subscription becomes `active`).

## Super Admin controls (per tenant)

In `SuperAdminDashboard.tsx`, add a **Billing Status** column + per-tenant drawer with:

- Current stage (None / Reminder / Notice / Restriction) — segmented control
- "Assumed plan" picker (Starter / Pro / Enterprise) — drives the Checkout line item
- Custom message override (optional textarea — falls back to default copy per stage)
- Notes field (internal, e.g. "Texted Ed 5/20, said paying Friday")
- Stripe status badge (No customer / Trialing / Active / Past due / Canceled) — read from `stripe_customers` lookup
- Action buttons: "Open Stripe Checkout as them" (copies a link you can text), "Clear banner"

## Tenant-side UI

- **`DashboardBanner.tsx`**: add a new banner variant `payment-due` that takes precedence over existing banners. Three visual styles keyed off stage. Uses semantic tokens (primary / warning / destructive) — no raw colors.
- **`PaymentDueGuard.tsx`** (new): wraps Bookings create/edit routes; at Stage 3, intercepts and shows a small inline notice + the Checkout CTA instead of the form.
- **Settings → Billing**: highlighted "Choose your plan" card at top when a stage is active, mirroring the banner CTA so they land in the right place if they navigate there directly.

## CTA flow

Reuses existing `stripe-checkout` edge function pattern (see `mem://integrations/stripe-checkout-config`). New thin wrapper edge function `create-tenant-checkout`:

- Auth'd as a team member of the flagged tenant
- Looks up `teams.assumed_plan_price_id` set by Super Admin
- Creates a Stripe Checkout session in `subscription` mode for that price
- Success URL → `/settings/billing?status=active` which triggers a `check-subscription` call to clear the banner
- Cancel URL → back to dashboard, banner stays

No plan picker for the tenant — eliminates "which one do I pick?" friction. If you haven't set an assumed plan, CTA falls back to the existing plan-selection modal.

## Schema (additive, one migration)

New columns on `teams`:
- `billing_dunning_stage` — `text`, nullable, check in `('reminder','notice','restriction')`
- `billing_dunning_set_at` — `timestamptz`
- `billing_dunning_set_by` — `uuid` (super-admin user id)
- `billing_dunning_message` — `text`, nullable (override copy)
- `billing_dunning_notes` — `text`, nullable (internal)
- `assumed_plan_price_id` — `text`, nullable (Stripe price id for Checkout)

New table `billing_dunning_events` (audit trail: stage changes, who set/cleared, when, optional note). Super-admin-only RLS.

Auto-clear trigger: when `check-subscription` flips a team to `active`, set `billing_dunning_stage = null` and log a "auto-cleared by payment" event.

## Copy (drafts — editable per-tenant)

- **Reminder**: "Your free trial has ended — thanks for kicking the tires! Set up billing in a couple of clicks whenever you're ready." → **Choose plan**
- **Notice**: "Heads up — billing is past due. To keep everything running smoothly, please complete payment setup." → **Complete payment**
- **Restriction**: "Account access is limited. Complete billing setup to restore booking and editing." → **Complete payment now**

## Files

**New**
- `supabase/migrations/<timestamp>_billing_dunning.sql`
- `supabase/functions/create-tenant-checkout/index.ts`
- `src/components/dashboard/PaymentDueBanner.tsx`
- `src/components/guards/PaymentDueGuard.tsx`
- `src/components/super-admin/TenantBillingDrawer.tsx`
- `src/hooks/useBillingDunning.ts`

**Edited**
- `src/components/dashboard/DashboardBanner.tsx` — prioritize payment-due variant
- `src/pages/SuperAdminDashboard.tsx` — add Billing Status column + drawer trigger
- `src/components/dashboard/TeamSettingsSection.tsx` (or Billing settings tab) — surface the same CTA
- `src/App.tsx` — wrap Bookings create routes in `PaymentDueGuard`
- `src/contexts/TeamContext.tsx` — expose `billing_dunning_stage` on currentTeam

## Out of scope (call out so we don't scope-creep)

- Automated trial-expiry detection (you wanted manual only)
- Email/SMS dunning sequences (banner-only for now; you'll keep texting)
- Hard account lock / data export gates
- Mid-cycle proration logic
- Replacing the existing trial signup flow

## Notes / recommendations

- **Strong rec: keep Stage 3 read-only, not locked-out.** Customers who can still see their data but can't take new bookings feel pressure without feeling punished. A full lock-out from a vendor they're already annoyed at risks them blaming *you* instead of themselves.
- Stage transitions are **manual only** — no cron escalates them. That matches your "case-by-case, soft touch" intent. We can add auto-escalation later behind a feature flag.
- Restriction stage will need a clear "Contact support" link (mailto you) so it never feels like a dead-end.

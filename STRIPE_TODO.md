# Stripe Connect Integration — TODO

**Last Updated:** April 6, 2026  
**Status:** Phase 1 In Progress — Webhook deployed, secret stored

---

## ✅ COMPLETED

### Webhook Infrastructure
- [x] `stripe-webhook` edge function deployed and live
- [x] `STRIPE_WEBHOOK_SECRET` stored in secrets
- [x] Webhook endpoint verified (returns 405 on GET, ready for signed POSTs)
- [x] Handles: `account.updated`, `checkout.session.completed`, `charge.captured`, `charge.refunded`, `payment_intent.succeeded`, `payment_intent.canceled`

### SaaS Subscription (Exotiq Revenue)
- [x] `create-checkout-session` edge function (uses Product IDs: `prod_Tf6Z*`)
- [x] `check-subscription` edge function (verifies active subscription)
- [x] `customer-portal` edge function (Stripe billing portal redirect)
- [x] Subscription gate in app (redirects unsubscribed tenants)

---

## 🔨 TODO — Tenant Stripe Connect (Connected Accounts)

### Phase 2: Connect Onboarding
- [ ] `stripe-connect-onboarding` edge function — generates Express account + onboarding link
- [ ] `stripe-connect-dashboard` edge function — generates Express Dashboard login link
- [ ] Settings UI: "Connect your Stripe account" button in PaymentMethodsSection
- [ ] Store `stripe_account_id` + `stripe_onboarding_complete` + `stripe_charges_enabled` on `teams` table
- [ ] Database migration: add Stripe Connect columns to `teams`
- [ ] Webhook handler: sync `account.updated` → update team capabilities

### Phase 3: Tenant Payment Processing
- [ ] `create-payment-intent` edge function — create payment on connected account with `application_fee_amount`
- [ ] `capture-payment` edge function — capture held authorization (full or partial)
- [ ] `cancel-payment-intent` edge function — release/void a hold
- [ ] `create-refund` edge function — full or partial refund on connected account
- [ ] Update `RecordPaymentDialog.tsx` — wire to real Stripe intents
- [ ] Update `PaymentTracker.tsx` — show real hold status from Stripe

### Phase 4: Security Deposit Holds
- [ ] Auth hold creation: `capture_method: 'manual'`, 7-day window
- [ ] Partial capture (damage deduction from deposit)
- [ ] Full release (void hold, no charge)
- [ ] Full capture (keep entire deposit)
- [ ] UI: Hold status badges (authorized → captured/released/expired)
- [ ] Webhook: `payment_intent.amount_capturable_updated`, `payment_intent.canceled`

### Phase 5: Marketplace Fee (Future — OTA Flow)
- [ ] `application_fee_amount` = 20% of total booking value
- [ ] Only applies when Exotiq OTA acquires the customer
- [ ] `booking_source` field differentiates: `direct` (0% fee) vs `marketplace` (20% fee)
- [ ] Fee visible to tenant in Express Dashboard
- [ ] Exotiq receives fees in platform Stripe account

---

## 🔧 Stripe Dashboard Configuration

### Webhook Configuration
- **Endpoint URL:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/stripe-webhook`
- **Events subscribed:**
  - `account.updated`
  - `checkout.session.completed`
  - `charge.captured`
  - `charge.refunded`
  - `charge.dispute.created`
  - `payment_intent.succeeded`
  - `payment_intent.amount_capturable_updated`
  - `payout.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- **Connect events:** "Listen to events on Connected accounts" — ENABLED

### Products (live)
- Starter, Professional, Enterprise plans via Product IDs (`prod_Tf6Z*`)

### Connect Settings
- **Platform type:** Stripe Connect Express
- **Country:** US (expand as needed)
- **Payout schedule:** Tenant-controlled via Express Dashboard

---

## 📝 Notes

- All edge functions use Stripe SDK v18.5.0, API version `2025-08-27.basil`
- Subscription verification uses Product IDs (not Price IDs) for stability
- Webhook signing secret stored as `STRIPE_WEBHOOK_SECRET`
- Connected account IDs stored on the `teams` table
- Express Dashboard gives tenants full control of banking, payouts, and tax docs
- See `docs/internal/STRIPE_CONNECT_SOP.md` for full internal documentation
- See `docs/customer/STRIPE_CONNECT_SETUP_GUIDE.md` for customer-facing guide

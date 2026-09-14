# Lovable Handoff — 30-Day Card-Required Trial, Per-Vehicle Billing, Automated Emails

**Date:** 2026-09-14
**Customer-facing contract:** Appendix A of this document. Those six sentences are the contract every screen, email, and the Terms page must match.
**Owner of the build:** Lovable (Supabase, Stripe Billing, edge functions, app UI, command center)
**Owner of Stripe dashboard settings and email copy sign-off:** Gregory (§8, §7)

This is one feature with eight work packages. Ship them in order; each is independently testable. Do not start WP-3 until WP-1 and WP-2 are verified with a Stripe test clock.

---

## 0. Ground rules

- **Stripe is the source of truth for billing state.** The database mirrors it via webhooks. Never compute trial or subscription status from a database default again.
- **The customer never picks a plan.** Tier (Pro/Business) and quantity are derived from the fleet count. Remove the plan picker and the fleet-size prompt from every customer-facing surface.
- **Nothing existing gets locked out.** Teams with `trial_end IS NULL` today are grandfathered. Demo accounts (`is_demo_account = true`) bypass billing entirely. Any team with an active Stripe subscription keeps working. Write the migration so a team with no `billing_status` is treated as grandfathered, not as pending activation.
- **Keep the manual dunning ladder** (`billing_dunning_stage`, `PaymentDueBanner`, super-admin controls) as a fallback. Do not remove it. The automated path clears it when a subscription becomes active (the existing `auto_clear_billing_dunning_for_email` RPC already does this).
- **Idempotent webhooks.** Every handler records `stripe_event_id` in the existing `stripe_webhook_events` table before acting and skips duplicates.
- **No secrets in code or this doc.** Price and product IDs are fine; keys stay in edge function secrets.
- **Do not touch** Stripe Connect (payouts to operators), `rent-checkout`, `rent-payment-webhook`, deposit holds, or anything under `/rent`. This work is Stripe Billing (charging the operator) only.

Definitions used throughout:

- **Active vehicle:** a row in `vehicles` for the team where `archived_at IS NULL AND trashed_at IS NULL`. Status (maintenance, rented, blocked) does not matter. This matches the existing convention in `useLocationFilteredFleet`.
- **Fleet count:** number of active vehicles, floored at 1.
- **Tier from count:** 1–15 → Pro, 16–50 → Business, 51+ → Enterprise (not self-serve; see WP-3 step 6).
- **Prices:** Pro monthly `price_1Tbv4IHO7nC3pJiPH4EbyVlL`, Pro annual `price_1Tbv4JHO7nC3pJiPqaBeoyAX`, Business monthly `price_1Tbv4KHO7nC3pJiPC5emMKgJ`, Business annual `price_1Tbv4LHO7nC3pJiParUQCB7y`. Products `prod_Ub7IM2Skj93HFS` (Pro), `prod_Ub7IlYXU1diSY8` (Business).

---

## WP-1 — Schema: billing state on the team

Add to `public.teams`:

| Column | Type | Notes |
|---|---|---|
| `stripe_customer_id` | text, nullable, unique | Set at activation. Replaces the current "look up Stripe customer by user email" pattern, which ties billing to a person instead of the team. |
| `stripe_subscription_id` | text, nullable, unique | Set at activation. |
| `billing_status` | text, nullable | One of `pending_activation`, `trialing`, `active`, `past_due`, `unpaid`, `canceled`, `grandfathered`. NULL is treated as `grandfathered` everywhere. |
| `billing_interval` | text, nullable | `month` or `year`. Mirrored from Stripe. |
| `billed_tier` | text, nullable | `pro` or `business`. Mirrored from the subscription item's product. |
| `billed_quantity` | integer, nullable | Quantity on the current Stripe subscription item. |
| `current_period_end` | timestamptz, nullable | Mirrored from Stripe. Replaces reliance on `trial_end` after conversion. |
| `annual_offer_shown_at` | timestamptz, nullable | Set when the day-30 annual offer is first shown; used to stop repeating it. |
| `annual_offer_dismissed_at` | timestamptz, nullable | Customer dismissed the banner. |

Changes to existing columns:

- `trial_end` stays and is now **written only by webhooks** from the Stripe subscription's `trial_end`. Drop the `DEFAULT (now() + INTERVAL '14 days')`. New teams get `trial_end = NULL` until activation.
- `trial_start` same treatment.

Backfill migration, in this order:

1. `billing_status = 'grandfathered'` where `trial_end IS NULL` and `billing_status IS NULL`.
2. `billing_status = 'grandfathered'` where `is_demo_account = true`.
3. For teams with `trial_end IS NOT NULL` and no Stripe subscription: leave `billing_status = NULL` (treated as grandfathered, so nothing changes for them today). Gregory will decide per tenant whether to activate them under the new flow (§9). Do not auto-migrate them.
4. For teams whose owner email already has an active or trialing Stripe subscription: populate `stripe_customer_id`, `stripe_subscription_id`, `billing_status`, `billing_interval`, `billed_tier`, `billed_quantity`, `current_period_end` from Stripe via a one-off admin edge function (`admin-billing-backfill`, super-admin only, idempotent, logs what it changed). Run it once, review the log, then it is not called again.

Add a table `billing_email_log` (`id`, `team_id`, `email_type`, `stripe_event_id` nullable, `sent_at`, `recipient`, `resend_message_id`) so every automated email is auditable and never sent twice for the same event.

RLS: the new `teams` columns are readable by team members, writable only by service role. `billing_email_log` is super-admin read, service-role write.

---

## WP-2 — Activation: Stripe Checkout with card, 30-day trial

**Where it lives in the flow.** Signup (`/auth`) → onboarding wizard (`/onboarding`) → **Activate** (new final step) → `/welcome`. A team in `pending_activation` can complete onboarding and view the dashboard, but every write action is blocked with an "Activate your account" prompt (same mechanism as read-only, WP-5). Gregory runs this step live on the demo call.

**Create the team in `pending_activation`.** Wherever the team row is created at signup, set `billing_status = 'pending_activation'`, `trial_end = NULL`.

**Rewrite `create-checkout-session`** (the existing function). New contract:

Request: `{ interval: 'month' | 'year', returnPath?, cancelPath? }`. No `tierId`, no `fleetSize`, no `trial` flag. The server derives everything.

Server logic:

1. Authenticate the user; resolve their current team (owner or admin only, else 403).
2. If `teams.billing_status` is `trialing`, `active`, or `past_due`, return 409 "already activated" with the Customer Portal URL instead.
3. Compute fleet count (floored at 1) and tier from count. If count > 50, return 409 `enterprise_required` and insert a super-admin notification "Team X attempted activation with N vehicles; Enterprise quote needed."
4. Find or create the Stripe customer: if `teams.stripe_customer_id` exists use it, else create one with `email = owner email`, `name = team name`, `metadata.team_id`. Save the id on the team immediately.
5. Trial eligibility: allow the 30-day trial unless this customer already has any subscription with `trial_start` set. (This is the same check the function has today, now keyed on the team's customer id rather than an email lookup.)
6. Create the Checkout session:
   - `mode: 'subscription'`
   - `customer: <id>`
   - `line_items: [{ price: <tier+interval price>, quantity: <fleet count> }]`
   - `payment_method_collection: 'always'` (card is required; this is the whole point)
   - `subscription_data.trial_period_days: 30` when eligible, omitted otherwise
   - `subscription_data.metadata: { team_id, tier, interval, activation_fleet_count }`
   - `metadata: { team_id }` on the session
   - `allow_promotion_codes: true`
   - `consent_collection: { terms_of_service: 'required' }` (Gregory sets the Terms URL in Stripe public business settings, §8). Also record the acceptance in the clickwrap acceptance table per `clickwrap-acceptance-spec.md` when the session completes.
   - `success_url: <origin>/welcome?activated=1&session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: <origin>/onboarding?step=activate&canceled=1`
7. Return `{ url }`.

Trial length is the single constant `TRIAL_DAYS = 30` at the top of the function. Nowhere else.

**Welcome page.** On `?activated=1`, show a confirmation: "You're activated. Your trial ends on {trial_end}. We'll email you 3 days before your first invoice. Cancel anytime in Settings." Then the existing welcome content.

**Onboarding wizard "Activate" step** copy:

> **Activate your account**
> 30-day free trial. Add a card now, pay nothing until {date 30 days out}. Cancel anytime with one click.
> Your fleet: {N} vehicles → {Pro|Business} at ${rate}/vehicle/month. Your invoice always reflects the vehicles in your garage.
> [Activate with monthly billing]  [Activate with annual billing — 2 months free]

Both buttons call `create-checkout-session` with the interval. Default emphasis on monthly. Never show a plan picker or a fleet-size input.

---

## WP-3 — Webhooks: mirror Stripe to the team, recount at renewal

Extend the existing `stripe-webhook` function. All handlers resolve the team by `subscription.metadata.team_id` first, then by `stripe_customer_id`, never by email. Add these events to the endpoint in Stripe (§8).

1. **`checkout.session.completed`** (subscription mode only; leave the existing Connect/rent handling untouched): set `stripe_subscription_id`, `billing_status = subscription.status` (`trialing`), `billing_interval`, `billed_tier`, `billed_quantity`, `trial_start`, `trial_end`, `current_period_end`. Send the **Day 0 acknowledgment email** (WP-4). Write the clickwrap acceptance record.

2. **`customer.subscription.updated`** and **`customer.subscription.created`**: mirror `billing_status`, `billing_interval`, `billed_tier` (from the item's product id), `billed_quantity`, `trial_end`, `current_period_end`, `cancel_at_period_end`. Keep the existing in-app notification. When status transitions to `active` from `trialing`, this is conversion: set nothing extra here; the annual offer is triggered by `invoice.paid` below.

3. **`customer.subscription.trial_will_end`** (Stripe fires this 3 days before trial end): recount the fleet, compute the tier, and send the **Day 27 reminder email** with the projected first invoice (count × rate). Do not change the subscription yet; the recount happens at `invoice.upcoming`.

4. **`invoice.upcoming`** — the renewal recount. This is the most important handler.
   - Only for subscriptions whose `metadata.team_id` resolves.
   - Recount active vehicles (floor 1). Compute tier from count.
   - If count > 50: do **not** change quantity. Cap at 50, insert a super-admin notification "Team X has N vehicles, Enterprise conversation needed," and continue with 50.
   - If `billing_interval = 'month'`: update the subscription item with `{ price: <tier monthly price>, quantity: count }` and `proration_behavior: 'none'`. This takes effect on the invoice about to be generated. The price swap handles tier crossing (15 → 16 and back).
   - If `billing_interval = 'year'`: this is the anniversary. Apply the same update (price for tier, quantity = count) with `proration_behavior: 'none'`. This is where annual **decreases** take effect.
   - If the new quantity or price differs from `billed_quantity` / `billed_tier`, send the **upcoming-invoice email** (WP-4). If nothing changed, send nothing.
   - Mirror `billed_quantity` and `billed_tier`.
   - The `invoice.upcoming` lead time is a Stripe dashboard setting (§8); set it to 3 days. Verify with a test clock that the event fires before the invoice is finalized.

5. **`invoice.paid`**: if this is the first paid invoice with `amount_paid > 0` for the subscription (check `billing_email_log` for a prior `annual_offer` entry and that `billing_interval = 'month'`), trigger the **annual offer**: set `annual_offer_shown_at`, send the annual offer email (WP-4), and insert a command center task (WP-6). Receipts are Stripe's (§8).

6. **`invoice.payment_failed`**: keep the existing in-app notification. Stripe Smart Retries and Stripe's dunning emails handle the customer contact (§8). Mirror `billing_status = 'past_due'`.

7. **`customer.subscription.deleted`**: `billing_status = 'canceled'`. Keep the existing notification.

8. When `billing_status` becomes `unpaid` (Smart Retries exhausted, per §8 the subscription is marked unpaid rather than canceled): the app is read-only (WP-5). When it returns to `active`, read-only lifts automatically.

**Annual mid-term additions — monthly true-up job.** Add a scheduled edge function `billing-annual-trueup` run daily (pg_cron or Supabase scheduled function):
- Select teams with `billing_status IN ('trialing','active','past_due')`, `billing_interval = 'year'`, and whose subscription's monthly anniversary day is today (day-of-month of `current_period_end`, with the usual end-of-month clamp).
- Recount. If count > `billed_quantity`: update the item quantity to the new count with `proration_behavior: 'always_invoice'`. Stripe creates and charges one invoice for the prorated remainder of the term. Mirror `billed_quantity`. Log it.
- If count < `billed_quantity`: do nothing. Decreases apply at the anniversary via `invoice.upcoming`.
- Tier crossing on annual mid-term (15 → 16): keep the current price until the anniversary. Only the quantity changes mid-term. The anniversary recount swaps the price.

**Retire the email-lookup pattern.** `check-subscription` should read `billing_status`, `billed_tier`, `billing_interval`, `current_period_end` from `teams` and only call Stripe as a fallback when `stripe_subscription_id` is set but the mirrored fields are null. Keep its response shape so `AuthContext` does not change. `subscribed` is true when `billing_status IN ('trialing','active','past_due')` or the team is grandfathered with a legacy active subscription.

**`switch-subscription`** now only switches interval (monthly ↔ annual). It derives price from `billed_tier` and quantity from the current fleet count, `proration_behavior: 'create_prorations'`. Remove the `tierId`/`fleetSize` inputs. Switching to annual from the day-30 offer uses this function.

**Customer Portal** (`customer-portal` function): pass a portal configuration (created once, id stored as a function secret or constant) with `subscription_update.enabled = false` (customers must not change quantity or price themselves, or the mirror desyncs), `subscription_cancel.enabled = true` with `mode = 'at_period_end'`, `payment_method_update.enabled = true`, `invoice_history.enabled = true`. Return URL `/dashboard/settings?section=billing`.

---

## WP-4 — Emails (Resend), four templates

All sent by a new edge function `send-billing-email` called from the webhook handlers, recorded in `billing_email_log`, deduped on `(team_id, email_type, stripe_event_id)`. Recipient is the team owner; CC admins. Use the existing Resend setup and brand template from `send-compliance-email`. Copy below is final pending Gregory's sign-off; do not paraphrase.

**1. `activation_ack` — Day 0, on checkout completion**
Subject: Your Exotiq trial is active
> Welcome to Exotiq, {first name}.
> Your 30-day free trial started today and ends on **{trial_end}**. Your card ending in {last4} will not be charged until then.
> On {trial_end} your subscription starts at **${rate}/vehicle/month** for the vehicles in your garage. Your invoice always reflects your fleet: archived vehicles are not billed.
> Change your card or cancel anytime in **Settings → Billing**. Cancel before {trial_end} and you will not be charged.
> Questions? Reply to this email.

**2. `trial_ending` — Day 27, on `customer.subscription.trial_will_end`**
Subject: Your trial ends in 3 days
> Your Exotiq trial ends on **{trial_end}**. On that day we'll charge your card ending in {last4}.
> Your first invoice: **{count} vehicles × ${rate} = ${total}** ({Pro|Business}, {monthly|annual}).
> Want to add or archive vehicles first? Your invoice reflects your garage on {trial_end}.
> To cancel, go to **Settings → Billing**. No charge if you cancel before {trial_end}.

**3. `upcoming_invoice_changed` — only when the count or tier changed since the last invoice**
Subject: Your next Exotiq invoice reflects {count} vehicles
> Your fleet changed since your last invoice. On **{next_invoice_date}** you'll be billed for **{count} vehicles × ${rate} = ${total}** ({Pro|Business}). Last invoice: {prev_count} vehicles.
> Archived vehicles are never billed. Manage your fleet in Exotiq or your billing in **Settings → Billing**.

**4. `annual_offer` — once, on the first paid invoice, monthly customers only**
Subject: Save two months on Exotiq
> Your first Exotiq invoice just went through: **{count} vehicles, ${total}**.
> Switch to annual and pay **${annual_total}** for the year instead of **${monthly_total_x12}**. That's two months free, and your unused days this month are credited.
> [Switch to annual] (deep link to `/dashboard/settings?section=billing&offer=annual`)
> No pressure. Monthly is fine too.

Receipts, failed-payment emails, and retry notices come from Stripe (§8). Do not build them.

---

## WP-5 — App UI: remove the plan picker, show the truth, enforce read-only server-side

**Settings → Billing** (`SubscriptionSection`): replace the plan cards, `PlanSelectionModal`, `BillingToggle`, and the tier vehicle-limit logic with one card:

- Status line: `Trialing · ends {trial_end}` / `Active · {Pro|Business} {monthly|annual}` / `Past due` / `Paused — payment needed`.
- Fleet line: **"{count} active vehicles. Next invoice ${total} on {date}."** Computed client-side from the live fleet count and `billed_tier` rate, with `current_period_end` (or `trial_end` while trialing). Count uses the Active vehicle definition.
- If `billing_interval = 'month'`: a secondary "Switch to annual — 2 months free" button (calls `switch-subscription`). If the `?offer=annual` param is present or `annual_offer_shown_at` is set and not dismissed, render it as a highlighted banner with a dismiss control that sets `annual_offer_dismissed_at`.
- "Manage card, invoices, or cancel" → Customer Portal.
- If `billing_status = 'pending_activation'`: the Activate step from WP-2 rendered here instead.
- Grandfathered teams: show "Legacy plan — contact support" and nothing else. Do not break them.

**Trial banner** (`TrialBanner`, `useTrialStatus`): read `billing_status` and `trial_end` from the team. `onTrial = billing_status === 'trialing'`. `isReadOnly = billing_status IN ('pending_activation','unpaid','canceled')`. Countdown appears at 7 days or less, as today. Remove the `subscription.subscribed` dependency.

**Read-only enforcement must exist server-side.** Today `isReadOnly` is client-only. Add a SQL function `public.team_is_writable(team_id uuid) returns boolean` that returns true when `billing_status IS NULL OR billing_status IN ('grandfathered','trialing','active','past_due')` or `is_demo_account`. Add it as a `WITH CHECK` condition to the INSERT/UPDATE/DELETE policies on the core write tables: `vehicles`, `bookings`, `customers`, `documents`, `expenses`, and any table the client's read-only mode already guards. Read policies are untouched. Test that a team in `unpaid` gets a policy error on insert and a clean 200 on select.

**Vehicle add/archive surfaces:** no billing email, no modal. Optional one-line note under the add-vehicle form: "Billed from your next invoice." Archive confirmation gains one sentence: "Archived vehicles aren't bookable and aren't billed."

**In-app pricing/landing copy** (`PricingData.ts` and the landing pricing components in this repo): replace the FAQ answers with Appendix B verbatim and align hero and card copy with Appendix A. Remove "14-day" and "no credit card required" everywhere. Keep `launchPricingMessage`.

**Remove** `pickTierForFleetSize` usage from customer-facing code, the `assumed_plan_*` inputs from any customer flow (they remain for the super-admin fallback ladder), and the `trial=true` request flag.

---

## WP-6 — Command center (super-admin)

Minimal additions; the full activation funnel is deferred.

- **Tenant list and detail drawer:** add `billing_status`, `trial_end` / `current_period_end`, `billed_tier`, `billed_quantity`, live active-vehicle count, and a "Open in Stripe" link (customer id).
- **Tasks:** on `invoice.paid` first charge (WP-3 step 5), insert a super-admin task "Annual upsell call — {team}. First invoice ${total}, annual would be ${annual_total}." Due same day. Also on `enterprise_required` (activation or renewal with > 50 vehicles) insert "Enterprise quote — {team}, {N} vehicles."
- **Trial health tile:** count of teams by `billing_status`, and a list of `trialing` teams with days left and whether they have ≥ 1 booking created after activation. This is the lightweight activation signal Gregory asked for.
- **Manual dunning ladder:** unchanged. Add a visible note in that panel: "Automated Stripe dunning is active. Use this ladder only for grandfathered or Enterprise accounts."

---

## WP-7 — Tests and acceptance

Use **Stripe test clocks** for every time-based case; do not wait real days.

1. New signup → onboarding → Activate (monthly) with test card `4242…`: team gets `stripe_customer_id`, `stripe_subscription_id`, `billing_status = trialing`, `trial_end` = +30 days; Day 0 email logged once; clickwrap acceptance row written.
2. Activate with a declined card: Checkout blocks; team remains `pending_activation`; no subscription created.
3. Advance test clock to day 27: `trial_ending` email logged once with the correct count and total. Advance again: no duplicate.
4. Add 3 vehicles during trial, archive 1, advance to day 30: `invoice.upcoming` recounts, quantity on the Stripe item equals active count, invoice charged for that amount, `billing_status = active`, `annual_offer` email logged, command center task created, Settings shows the annual banner.
5. Monthly customer at 15 vehicles adds one (16) and reaches renewal: item price switches to Business monthly, quantity 16, `upcoming_invoice_changed` email logged. Archive back to 15 before the following renewal: price returns to Pro, email logged again. No email when the count is unchanged.
6. Annual customer at 10 vehicles adds 2 in month 4: on the monthly anniversary the true-up job raises quantity to 12 with an immediate prorated invoice. Archives 3 in month 6: nothing happens until the anniversary, where quantity becomes 9.
7. Team with 51 active vehicles at renewal: quantity capped at 50, super-admin notification created, invoice still succeeds.
8. Card fails at day 30: `billing_status = past_due`, existing notification fires, Stripe retries per settings; after exhaustion status `unpaid` → team cannot insert a booking (policy error) but can read everything; Settings shows "Paused — payment needed" with the Portal link. Update the card in the Portal → status `active` → writes work again.
9. Cancel in the Portal: `cancel_at_period_end` mirrored, access continues to `current_period_end`, then `canceled` → read-only.
10. Grandfathered team (`trial_end IS NULL`, `billing_status` NULL): no banner, all writes work, Settings shows "Legacy plan." Demo account: same.
11. Activation attempt on an already-activated team returns the Portal URL, not a second Checkout.
12. Existing e2e suites under `tests/e2e/` still pass; `tier1-*` specs especially.
13. Terms page shows the WP-8 clauses, the terms version identifier changed, a new activation writes a clickwrap acceptance row with the new version, and Settings → Billing reaches the Portal cancel flow in one click.

Acceptance is all thirteen green in a Stripe test mode project, plus a screen recording of case 1 and case 4 for Gregory.

---

## WP-8 — Terms page (`app.exotiq.ai/terms`)

The Terms page lives in this app and is the document Stripe Checkout links to via `consent_collection`. Update the billing section so it states, in plain language, each of the following. Keep the existing structure; add or replace the billing clauses only. Bump the terms version identifier so the clickwrap acceptance record captures the new version (per `clickwrap-acceptance-spec.md`).

1. **Free trial and automatic conversion.** The trial is 30 days. A payment method is required to activate. On the last day of the trial the subscription begins automatically and the payment method on file is charged, unless the customer cancels before that date. The trial end date is shown at activation, in Settings, and in the acknowledgment email.
2. **Per-vehicle pricing.** Fees are calculated per vehicle in the customer's fleet at the published per-vehicle rate for the applicable tier. At each billing renewal Exotiq counts the vehicles in the account that are not archived and bills that number, with a minimum of one. Vehicles in maintenance or booked elsewhere count. Archived vehicles do not.
3. **Tier.** Fleets of 1 to 15 vehicles are billed at the Pro rate, 16 to 50 at the Business rate, determined at each renewal. Fleets over 50 require an Enterprise agreement.
4. **Annual plans.** Annual plans are prepaid for twelve months. Vehicles added during the term are charged for the remainder of the term on a prorated basis and invoiced monthly. Vehicles removed during the term reduce the billed quantity at the next annual renewal. No refunds for mid-term reductions.
5. **Rate lock.** The per-vehicle rate in effect at activation applies for the life of the subscription unless the customer cancels.
6. **Cancellation.** The customer may cancel at any time from Settings → Billing. Cancellation takes effect at the end of the current billing period. Cancelling before the trial end date results in no charge.
7. **Failed payments.** If a payment fails Exotiq will retry and notify the customer. If payment is not completed, the account is placed in read-only mode until payment is made. Customer data is not deleted because of non-payment.
8. **Reminders.** Exotiq sends a reminder before the first charge and before any renewal where the billed vehicle count has changed.

Add a "Cancel subscription" link in Settings → Billing that opens the Customer Portal directly on the cancel flow. One click from Settings to the cancel confirmation; no email, no call required.

---

## 8. Stripe dashboard settings — Gregory does these, Lovable verifies

- **Webhook endpoint:** add `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.upcoming`, `invoice.paid`, `invoice.payment_failed`.
- **Billing → Subscriptions and emails → Upcoming renewal events:** send `invoice.upcoming` **3 days** before. Enable Stripe's "email customers about upcoming renewals" for annual subscriptions only (monthly customers get ours, and only when the count changed).
- **Billing → Manage failed payments:** Smart Retries on (up to 4 attempts over ~2 weeks). "Send emails when a payment fails" on. After all retries fail: **mark the subscription as unpaid** (not canceled).
- **Billing → Customer emails:** successful payment receipts on. Refund receipts on.
- **Customer Portal configuration:** as specified in WP-3 (cancel at period end on, payment method update on, subscription updates off). Save the configuration id for Lovable.
- **Settings → Public details:** Terms of Service URL (`app.exotiq.ai/terms`) and Privacy URL set, required for `consent_collection` at Checkout.
- **Coupons:** create the promo codes Gregory wants for demo-close deals (for example `FOUNDER10`). Checkout already allows promotion codes.
- Confirm all of the above in **test mode first**, then mirror to live before cutover.

## 9. Rollout

1. Ship WP-1 through WP-7 to staging against the Stripe **test** project. Run §7.
2. Gregory signs off email copy and the in-app Activate step copy.
3. Gregory updates the exotiq.ai pricing page (separate brief, same copy as Appendix B). It goes live the same day as step 4 so the two sites never disagree on the card.
4. Deploy to production with live Stripe keys. Run the `admin-billing-backfill` once. Review its log.
5. For each currently trialing tenant (has `trial_end`, no subscription), Gregory decides: activate under the new flow on a call (they get a fresh 30 days, that is fine), or leave as is. No bulk action.
6. Watch `billing_email_log` and `stripe_webhook_events` for the first two renewals.

## 10. Out of scope, do not build

- Metered/usage-based Stripe pricing.
- Weekly fleet digest email.
- Full activation funnel with stall alerts.
- Any change to Stripe Connect, renter checkout, deposits, or marketplace payments.
- Trial extension mechanics. The trial is 30 days, one constant.

---

## Appendix A — Customer-facing contract (verbatim)

Every screen, email, FAQ, and the Terms page must agree with these sentences. Do not paraphrase in ways that change meaning.

1. **30-day free trial.** A card is required to activate. You are not charged until day 30. Cancel anytime in Settings with one click.
2. **Priced per vehicle in your fleet.** Pro is $39 per vehicle per month for fleets of 1 to 15. Business is $29 per vehicle per month for fleets of 16 to 50. Fleets over 50 are Enterprise and are quoted.
3. **Your invoice reflects your fleet.** At each renewal we count the vehicles in your garage and bill that number. Archived vehicles are not billed and are not bookable. Vehicles in maintenance or booked elsewhere still count. Minimum one vehicle.
4. **Annual saves two months.** Annual is $390 (Pro) or $290 (Business) per vehicle per year. On annual, vehicles you add mid-term are billed for the remaining term and invoiced once a month. Vehicles you remove reduce the count at your next anniversary. No mid-term refunds.
5. **Launch pricing locks.** Your per-vehicle rate is locked for the life of the subscription. Increases are planned for 2027 for new customers only.
6. **If a payment fails,** we retry, email you, and pause the account to read-only until it is fixed. Nothing is ever deleted.

## Appendix B — FAQ copy for the in-app pricing page (`PricingData.ts` `faqItems`)

Replace the existing items with these. Same answers are used on exotiq.ai so the two sites never disagree.

- **How does the free trial work?** Every account starts with a 30-day free trial. A card is required to activate and is not charged until day 30. Cancel anytime from Settings. If you do nothing, your subscription starts automatically on day 30 at the per-vehicle rate for the vehicles in your fleet.
- **How is pricing calculated?** Per vehicle, per month. Pro is $39/vehicle/month for fleets of 1–15. Business is $29/vehicle/month for fleets of 16–50. At each renewal we count the vehicles in your garage and bill that number. Archived vehicles are not billed. Fleets over 50 are Enterprise; book a call.
- **What if I add or remove vehicles?** Monthly plans adjust at your next invoice. Annual plans bill added vehicles for the remaining term, invoiced monthly; removed vehicles reduce your count at your next anniversary.
- **What happens when my fleet crosses 15 vehicles?** You move to the Business rate automatically at your next renewal, and back to Pro if you drop below 16.
- **Can I switch to annual later?** Yes, anytime from Settings → Billing, with credit for the unused portion of your month. Annual is two months free.
- **What happens after the trial ends?** Your subscription starts automatically on day 30 for the vehicles in your fleet. Cancel before then and you are not charged.
- **What happens if my card fails?** We retry and email you. If it is not resolved, the account pauses to read-only. Nothing is deleted.
- **Is there a long-term contract?** No. Monthly plans cancel anytime, effective at the end of the period. Annual plans are prepaid for twelve months.
- **Is there a setup fee?** No. Onboarding and fleet migration are included on every plan.
- **What about the Drive Exotiq marketplace?** Every paid account is listed on Drive Exotiq as it launches.

---

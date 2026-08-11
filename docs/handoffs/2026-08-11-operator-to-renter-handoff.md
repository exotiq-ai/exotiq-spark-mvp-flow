# Operator → Renter Booking Flow Handoff (2026-08-11)

Audience: the agent maintaining the renter-facing booking app.
Scope: operator-side changes shipped 2026-08-11. No renter API contract changed.

## 1. New column: `bookings.is_historical`

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_team_historical
  ON public.bookings (team_id, is_historical);
```

Set to `true` only for bookings operators log after the fact — either manually
("Log past booking") or via CSV import of past rentals. These rows are written as:

- `status = 'completed'`, dates in the past
- no `confirmation_token`
- no Stripe payment intents, no `platform_fee_cents` / `processing_fee_cents` / `state_fee_cents`
- no renter emails, no Google Calendar sync, no payment-window scheduling

**Required change on the renter side:** add `is_historical = false` to every
renter-facing booking read — availability and conflict detection, marketplace
booking lookups, payment and refund paths, and any counts or analytics rendered
to renters. Historical rows are back-fill records only.

Also: any code that assumes a `completed` booking carries a confirmation token,
a Stripe payment intent, or fee snapshots must tolerate `null` on these rows.

## 2. `pickup_location` may be `"Not recorded"`

Import validation no longer requires `pickup_location`; missing values fall back
to the literal string `"Not recorded"`. This only occurs on historical rows, so
filtering per item 1 removes it. Do not render that string to renters.

## 3. Mileage and rate tiers can change fleet-wide in bulk

Operators can now:

- set tenant-level mileage defaults (`teams.default_mileage_limit`,
  `teams.default_mileage_overage_rate`), inherited by newly added vehicles, and
  push them to every existing vehicle in one action
- bulk-set 3-hour, 6-hour, and multi-day tiers as a percentage of each vehicle's
  own daily rate

No schema change on the public read path — the public vehicle RPC already
returns `default_mileage_limit` and `mileage_overage_rate`. The behavioural note
is that these values can shift across an entire fleet between requests, so avoid
long-lived caching of vehicle mileage and duration-tier pricing.

## Not relevant to the renter app

- Import wizard fixes (React Fragment warning; `daily_rate` derived from
  `total_value ÷ days` when the sheet only supplies a total)
- New operator dashboard entry points (split button for logging past bookings /
  importing bookings, Customers import button)
- Team hub mileage settings UI and the rate tier bulk tool UI

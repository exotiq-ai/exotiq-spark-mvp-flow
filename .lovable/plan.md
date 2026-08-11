# Handoff to Claude — operator-side changes (2026-08-11)

Short answer: only one change touches shared data that the renter booking flow reads. The rest is operator-side only. Below is what to send, plus a proposed written handoff note committed to the repo so it isn't just a chat message.

## Material for the renter flow

1. **New column `bookings.is_historical` (boolean, NOT NULL, default false)**
   - Set true only for bookings logged after the fact by operators (manual "Log past booking" or CSV import). Those rows are written as `completed` with past dates, no confirmation token, no payment intents, no calendar sync, no renter emails.
   - What Claude must do: **exclude `is_historical = true` from anything renter-facing** — availability/conflict checks, marketplace booking lists, payment/refund logic, and any analytics the renter app surfaces. They will never have `confirmation_token`, `platform_fee_cents`, or Stripe IDs, so any code assuming those exist on a completed booking should tolerate nulls.
   - Index available: `idx_bookings_team_historical (team_id, is_historical)`.

2. **`pickup_location` can now be the literal string "Not recorded"** on imported historical bookings (import validation no longer requires it). Renter-facing surfaces should not render that value; it only appears on historical rows, so filtering by item 1 also solves this.

3. **Fleet mileage values can change in bulk.** Operators now set tenant-level mileage defaults and can push them to every vehicle in one action, and can bulk-set 3hr/6hr/multi-day tiers as a percentage of each vehicle's daily rate. The public vehicle RPC already returns `default_mileage_limit` and `mileage_overage_rate` — no schema change, but Claude should assume these values can shift fleet-wide between page loads and not cache them aggressively.

## Not material (no action for Claude)

- Import wizard fixes (Fragment warning, derived `daily_rate` when only a total is supplied).
- New split-button entry points in the operator dashboard, Customers import button.
- Team hub mileage settings UI, rate tier bulk tool UI.

## Proposed deliverable

Create `docs/handoffs/2026-08-11-operator-to-renter-handoff.md` containing the three material items above, with the exact column definition, the filter Claude should apply (`and is_historical = false` on any renter-facing booking read), and a one-line note that no renter API contract changed.

No code changes are proposed here.

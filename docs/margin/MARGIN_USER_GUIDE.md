# Margin — User Guide

Track every dollar that flows through your fleet: what renters owe you, what you owe your vehicle partners, and what's left over.

> Margin lives at **Dashboard → Margin**. Manager, Admin, and Owner roles can view and act.

## 1. The Overview cards

The eight cards at the top of Margin always reflect the **active filters** (date range, locations, vehicles, sources).

| Card | What it means |
|---|---|
| **Gross Booked** | Total booking value (cancelled bookings excluded). |
| **Collected** | Payments actually received from renters. |
| **Outstanding** | What renters still owe (Gross − Collected − Refunds). |
| **Platform Fees** | Marketplace fees withheld on OTA bookings. Direct bookings have no fee. |
| **Expenses** | Vehicle-scoped expenses net of reimbursements. |
| **Pending Payouts** | What you currently owe vehicle partners. |
| **Operator Net** | Your take after fees, expenses, and partner payouts. |
| **Margin %** | Operator Net as a share of Gross Booked. |

Hover the small **ⓘ** next to any card title for the exact formula.

## 2. Adding a vehicle partner

1. Go to **Margin → Partners**.
2. Click **New Partner**.
3. Fill in name, contact, preferred payout method (ACH, check, wire, Stripe, cash, other).
4. Save.

To attach a partner to a vehicle, open **Fleet → the vehicle → Edit**, set **Ownership** to "Partnered", choose the partner, and configure the split:
- **Percentage** — partner gets a share of net after platform fees (e.g. 60% to partner).
- **Flat per day** — partner gets a fixed dollar amount per rental day, capped at net after fees.

## 3. How payouts are generated

The moment a booking on a partnered vehicle is marked **Completed**:
- A payout row is created automatically in `pending` status.
- It captures the booking base, platform fee, and partner share at that moment.

You'll see it appear in **Margin → Partner Payouts**.

> Edits to the booking *after* completion will recompute pending payouts and **flag paid/voided** payouts for review (small ⚠ next to the status).

## 4. Marking a payout paid

**Single row:** click the **⋯** menu on the row → **Mark Paid**.
**Many rows:** tick the checkboxes on the pending rows → **Mark N Paid**.

In the dialog, choose:
- Payout date (defaults to today)
- Method (ACH, check, wire, Stripe, cash, other)
- Reference (optional — ACH batch #, check #, wire confirmation)

Once paid, the row turns green and counts toward **Paid MTD / YTD**.

## 5. Voiding a payout

Use this if a booking was settled off-platform, was a duplicate, or won't actually be paid. From the **⋯** menu choose **Void**, then enter a reason (required for the audit trail).

Voided payouts are excluded from Operator Net, Outstanding, and partner statements' lifetime totals.

## 6. Re-opening a voided payout

Owners and Admins only. From the **⋯** menu on a voided row choose **Re-open**. The payout returns to `pending` and void details are cleared.

## 7. Recomputing a payout

If a booking's amount or dates changed after the payout was generated, the **⚠** flag appears. For **pending** payouts, click **⋯ → Recompute from booking** to refresh the amounts.

Paid and voided payouts are never recomputed silently — re-open or void them manually if needed.

## 8. Partner statements

Click any row in **Margin → Partners** to open that partner's statement:
- Lifetime paid, outstanding, and voided totals.
- Every payout grouped by status with vehicle and booking reference.
- **Export CSV** for accounting.
- **Print / PDF** for a branded statement you can email or save as PDF.

## 9. Tracking expenses

In **Margin → Expenses**, log fuel, maintenance, detailing, tolls, and other vehicle costs. Tie each expense to a vehicle so it appears in that vehicle's P&L and in Operator Net. Reimbursable expenses (e.g. recovered from the renter) net against the expense automatically.

## 10. Reading vehicle P&L

The **Vehicle P&L** table shows each vehicle's gross, expenses, partner payouts, and net for the active range — sortable to find your top and bottom performers.

## 11. CSV exports

- **Partner Payouts → CSV** — every payout that matches your current filters.
- **Partner Statement → Export CSV** — single-partner view.
- **Partner Statement → Print / PDF** — branded printable version.

## 12. Common questions

**Why is Operator Net different from Gross minus what I see paid out?**
Operator Net includes *all* live partner obligations (pending + paid), not just paid. It only excludes voided rows.

**A partner says I underpaid them.**
Open their statement, click **Print / PDF**, and share it. Each line shows the booking reference and the exact math at the time of payout.

**A booking was edited after the partner was paid.**
You'll see a ⚠ on the payout row. Decide whether to:
- Leave it (small rounding, not worth a redo), or
- Void the original and let a fresh pending payout generate, then mark it paid.

**How do I stop generating payouts for an old arrangement?**
Deactivate the partner in **Margin → Partners**. Vehicles keep their assignment but no future payouts are auto-generated.

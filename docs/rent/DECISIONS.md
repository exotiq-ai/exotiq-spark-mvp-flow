# Renter App Decision Register

> All ten decisions were made by Gregory on 2026-07-15 (in-chat). This file is
> the authoritative record. Full context: `docs/rent/RENTER_APP_GOAL.md` §5 and
> `docs/rent/PLAN_REVIEW_2026-07-15.md` §3.

| # | Question | Decision | Date |
|---|---|---|---|
| D1 | Canonical platform fee rule | **10% renter-facing booking fee, charged to the renter as a SEPARATE charge** on their card statement (distinct from the operator's rental charge; Stripe must pipe the two charges separately). Fee base = the operator's **total booking rate (rental rate × duration) only** — excludes extras, deposits, and protection. Hardcoded 20% in `create-payment-checkout`/`stripe-create-hold` is retired. Exact money-flow mechanics (destination charge vs separate charge on platform account, and whether operator-side collection is involved) = **OPEN follow-up for M6**; Gregory to review how the money flows before Stripe work starts. | 2026-07-15 |
| D2 | Canonical `booking_source` for exotiq.rent | **`marketplace`** (`drive_exotiq` becomes legacy alias) | 2026-07-15 |
| D3 | Renter booking lifecycle states | **Yes** — add `requested`, `pending_documents`, `pending_payment`, `declined`, `refunded` via migration. Constraint: every schema/status change must be tracked/documented so Lovable can adapt the Command Center UI if needed; agent may make the changes directly when safe, flag when not. | 2026-07-15 |
| D4 | Confirmation page access control | **Yes** — `bookingRef` + access token in URL from day one; minimal data without token. Renter-facing confirmation must match the booking record in the Command Center. | 2026-07-15 |
| D5 | Protection catalog | **REPRICED site-wide: Standard $89/day, Premium $289/day. Premium selected by default.** Decline requires the renter to read and accept decline terms (terms copy = TODO, to be written separately): renter is responsible for the total cash value of the vehicle for any damages and total loss; renter must carry personal auto insurance and provide it for verification before pickup. Protection revenue is 100% Exotiq's. | 2026-07-15 |
| D6 | Guest vs renter accounts (v1) | **Guest checkout v1.** Renter-entered details flow into the Command Center CRM (`customers`) and booking record. Contracts shaped so a `renters` auth table attaches later. | 2026-07-15 |
| D7 | Demo hosting | **Netlify** at `demo.exotiq.rent`; production `exotiq.rent` untouched. Set up via the Netlify MCP (available in Gregory's Cursor desktop; NOT available in cloud agent VMs — cloud agents need a `NETLIFY_AUTH_TOKEN` secret instead). | 2026-07-15 |
| D8 | Merge `feat/drive-exotiq-booking-flow` into exotiq-rent `main`? | **Yes** | 2026-07-15 |
| D9 | Extras included in platform fee base | **No.** Fee is taken only from the total rental rate before extras. Extras remain 100% operator revenue with no Exotiq fee. | 2026-07-15 |
| D10 | Grant Cursor write access to `exotiq-rent` | **Yes** (granted 2026-07-15; M0 agent active on that repo) | 2026-07-15 |

## Decision log

### 2026-07-15 — All ten decisions recorded (Gregory, in-chat)

Immediate consequences applied or queued:

1. **PR #22 (M3) amended in place** — `public_vehicle_quote`: fee computed on
   `rental_subtotal_cents` explicitly (D1/D9); protection reprice to
   standard 8900c / premium 28900c per day, premium default (D5). Tests updated.
2. **Consistency win:** the DB's existing `fn_snapshot_platform_fee` /
   `compute_rental_base` (rental base only, excludes extras/fees) already
   matches D1+D9 exactly — no change needed there. Only the renter-side quote,
   the retired 20% hardcode (M6), and the exotiq-rent frontend math need
   alignment.
3. **exotiq-rent frontend changes required (for the M0/M4 agent):**
   - `domain/booking/totals.ts`: `platformFeeBaseCents` must be
     `rentalSubtotalCents` only (currently includes extras + operator tax);
     `PROTECTION_DAILY_RATES` → premium 28900, standard 8900.
   - `ProtectStep`: pricing copy for $89/$289; decline consent must present
     decline terms (copy TODO — cash-value responsibility + personal insurance
     verification before pickup).
   - Review/Pay/Confirmation screens: two-party billing already separates
     operator vs Exotiq charges — keep; ensure the Exotiq line reads as a
     booking fee + protection.
4. **M6 flag (money flow):** D1 requires the renter to see two separate
   statement lines. The May 27 handoff's "single hosted Checkout charge"
   model needs rework: likely operator charge (destination charge to
   connected account) + separate Exotiq platform-account charge for
   fee + protection. Gregory reviews money flow before M6 implementation.
5. **TODO (copy):** decline-protection terms document.
6. **D3 tracking rule:** all lifecycle/schema changes get documented in
   `docs/rent/` with a Lovable-facing note so the Command Center UI can adapt.

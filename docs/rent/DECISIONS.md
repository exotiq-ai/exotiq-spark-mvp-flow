# Renter App Decision Register

> Gregory: edit the **Decision** column (or reply in chat) — "default" accepts
> the recommendation. The executing agent records the date and updates the
> affected plan docs when a decision lands. Full context for each item:
> `docs/rent/RENTER_APP_GOAL.md` §5 and `docs/rent/PLAN_REVIEW_2026-07-15.md` §3.

| # | Question | Recommended default | Decision | Date |
|---|---|---|---|---|
| D1 | Canonical platform fee rule | 10% of operator total (rental + extras + operator taxes; excludes deposits & protection), snapshotted per booking from `teams.platform_fee_percent` | PENDING | |
| D2 | Canonical `booking_source` for exotiq.rent | `marketplace` (`drive_exotiq` becomes legacy alias) | PENDING | |
| D3 | Renter booking lifecycle states | Add `requested`, `pending_documents`, `pending_payment`, `declined`, `refunded` via migration | PENDING | |
| D4 | Confirmation page access control | `bookingRef` + access token in URL from day one; minimal data without token | PENDING | |
| D5 | Protection catalog | Premium $89/day + Standard $59/day + decline-with-consent; Exotiq-owned charge | PENDING | |
| D6 | Guest vs renter accounts (v1) | Guest checkout v1; contracts shaped so a `renters` auth table attaches later | PENDING | |
| D7 | Demo hosting | Vercel free tier at `demo.exotiq.rent`; production `exotiq.rent` untouched | PENDING | |
| D8 | Merge `feat/drive-exotiq-booking-flow` into exotiq-rent `main`? | Yes (clean fast-forward; main only holds Coming Soon) | PENDING | |
| D9 | Extras included in platform fee base | Yes (consequence of D1) | PENDING | |
| D10 | Grant Cursor write access to `exotiq-rent` | Yes (required for all renter frontend work) | PENDING | |

## Decision log

_None yet._

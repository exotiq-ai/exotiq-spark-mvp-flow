# Changelog

One line per shipped change, newest first: date (UTC) — what changed — why.

- 2026-11-16 — Dashboard load makes 83 backend requests instead of 110: the signed-in user keeps one identity, role and profile are shared lookups, the subscription check runs once per user, and two blocking user lookups are gone — the dashboard loaded its data twice on every visit.
- 2026-11-16 — Mileage overage: included miles = miles/day × days (booked, or kept when late), shown with the working at check-in and in Record Payment; overage rate is a free $X.XX field; no invented 250 mi / $1.50 / $0.50 fallbacks — check-in compared a whole trip to one day's allowance and overcharged multi-day rentals.
- 2026-11-16 — `.env` is no longer tracked; `.env.example` shows the variables and CI uses placeholders — the tracked file still named the retired Lovable backend, while production takes its values from Netlify.
- 2026-11-14 — Super Admin: a marketplace request whose platform fee is not confirmed shows "Confirm fee to approve"; errors show their real message (`describeError`) — approvals failed with "[object Object]".
- 2026-11-13 — Payment totals count only the operator's own payments; the Exotiq charge is shown on its own line; Stripe Checkout notes the separate EXOTIQ RENT charge — a $2 rental showed a negative balance.
- 2026-11-13 — Add Vehicle accepts a blank Year; signed-in users can delete vehicle-photo files again — save refused a blank year; replaced photos left files behind.
- 2026-11-13 — Backend moved from Lovable Cloud to the owned Supabase project; Command Center hosted on Netlify.

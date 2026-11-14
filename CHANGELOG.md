# Changelog

One line per shipped change, newest first: date (UTC) — what changed — why.

- 2026-11-14 — Super Admin: a marketplace request whose platform fee is not confirmed shows "Confirm fee to approve"; errors show their real message (`describeError`) — approvals failed with "[object Object]".
- 2026-11-13 — Payment totals count only the operator's own payments; the Exotiq charge is shown on its own line; Stripe Checkout notes the separate EXOTIQ RENT charge — a $2 rental showed a negative balance.
- 2026-11-13 — Add Vehicle accepts a blank Year; signed-in users can delete vehicle-photo files again — save refused a blank year; replaced photos left files behind.
- 2026-11-13 — Backend moved from Lovable Cloud to the owned Supabase project; Command Center hosted on Netlify.

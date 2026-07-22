# Marketplace Testing — Regroup

## Where Exotiq stands (verified now)

- Tenant `Exotiq` (`c1de6533-…`):
  - `marketplace_visible: true`, `marketplace_request_status: approved`, `marketplace_test_mode: true`
  - Stripe Connect `acct_1TvnfgQfNJmCrgjR` — charges ✅ / payouts ✅ / onboarding complete ✅
- Fleet: 55 vehicles, 54 marketplace_visible, 49 visible + available.
- `rent-public-media` edge function previously verified returning HTTP 200 + signed URLs w/ anon key.
- ID verification (Stripe Identity) live end-to-end; verified badges piped from `customers.identity_status`.

**Bottom line:** Yes — marketplace is ready for the Claude/renter-side agent to start integrating against. Public catalog + media + Stripe payouts + identity are all green on Exotiq.

## Recommended pre-handoff checks (no code changes, just verifying)

Before Claude wires the booking flow, I want to confirm these four things are actually working end-to-end so the renter agent doesn't hit a wall mid-integration. Each is a read/probe, not a change:

1. **Public catalog RPC** — call the M3 public RPCs (`list_marketplace_vehicles`, `get_marketplace_vehicle`) with the anon key and confirm they return Exotiq's 49 available vehicles with slugs, hero image URLs, and pricing.
2. **Signed media URLs at scale** — confirm `rent-public-media` returns valid signed URLs for a sample of 5 vehicles (not just the one previously tested), and that URLs are usable from an unauthenticated fetch.
3. **Booking creation path for a renter** — trace which edge function / RPC a marketplace renter will call to create a booking, and confirm: (a) it accepts an unauthenticated or renter-JWT caller, (b) it enforces the 20% marketplace application fee on the connected account, (c) it writes with `booking_source = 'marketplace'` so the fee trigger fires.
4. **Double-booking guard on the renter path** — the client-side overlap check exists in the operator app; confirm the marketplace booking entry point also runs it (or documents that the operator confirms before capture).

## Known items to flag to Claude (not blockers, just "know before you build")

- Marketplace application fee is **20%** (hardcoded in `create-payment-checkout` and `stripe-create-hold`). FLAGGED.md F-BUG-2 notes this diverges from the margin trigger — fine for testing, needs a policy decision before real GA.
- `marketplace_test_mode: true` on Exotiq bypasses the 5-photo readiness gate. Only Exotiq's fleet should be treated as "showable to real renters"; other tenants will fail readiness until they hit 5 photos/vehicle + Stripe onboarding.
- ID verification is required to book — renter flow must send users through the `identity-create-session` → Stripe hosted URL → webhook path before payment capture.
- No DB-level exclusion constraint on booking overlaps yet (FLAGGED F-BUG-1-DB). Fine for controlled testing; call out to Claude so the renter UI doesn't rely on Postgres to reject overlaps.

## Suggested next step

I run the 4 verification probes above (read-only, ~5 min), report back green/red per item, and then you hand off to Claude with a short "what's live, what to call, what to avoid" note. I can draft that handoff note as the final step.

Approve this and I'll switch to build mode just to execute the read-only probes and produce the handoff note — no schema, edge function, or UI changes.

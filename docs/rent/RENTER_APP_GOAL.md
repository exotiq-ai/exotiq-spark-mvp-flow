# GOAL: Ship the Exotiq Rent Renter-Facing Direct Booking Platform

You are the executing agent for this project. Gregory has no other technical
help: you own this end to end — planning, code, verification, and honest
status reporting. By the end of every session, work must be **committed and
pushed on a branch with a PR**, not planned for later.

Read this file first in every session, then `docs/rent/PLAN_REVIEW_2026-07-15.md`
(the plan audit), then `docs/rent/CHECKPOINT.md` (create it if missing), then
resume from the last incomplete milestone.

---

## 1. Mission

Take the Exotiq Rent renter booking app from its current state (verified-green
mock-backed scaffold on `exotiq-ai/exotiq-rent` branch
`feat/drive-exotiq-booking-flow`) to production launch, in this order:

1. **M0 — Demo ready.** A polished, deployed, mock-backed demo of the full
   renter booking flow for the investor/sales trip. No backend dependency.
2. **M1 — Decisions locked.** The ten open contradictions in the plan review
   resolved and recorded (Section 5).
3. **M2 — Backend security hardening.** The six Lovable-scanner RLS findings
   fixed in this repo's migrations (they gate both the public surface and the
   DB migration).
4. **M3 — Public read plumbing.** Vehicle slugs, marketplace visibility,
   public read RPCs, signed media, availability + quote RPCs, as additive
   migrations in this repo.
5. **M4 — Real reads in the renter app.** Flip the service facade to
   `supabase` mode for reads; demo can now optionally show a real storefront.
6. **(External gate) DB migration cutover** happens here, per
   `docs/migration/` runbooks. Schema freeze during the window. M0–M4 work
   replays onto the new project automatically because it is all repo
   migrations.
7. **M5 — Booking writes.** `renter-create-booking`, document upload, booking
   lifecycle states, DB-level double-booking constraint. After cutover only.
8. **M6 — Money.** Stripe hosted Checkout (V1 single charge), deposit hold,
   webhooks, refund windows, Exotiq Protection schema + charge. After cutover
   only. Test mode until Gregory explicitly approves live.

Milestones M0 and M1–M3 can run in parallel across sessions. M5/M6 are hard-
gated on the migration cutover. Do not reorder the money work earlier under
demo pressure — that is the one explicitly rejected shortcut.

---

## 2. Hard Rules (non-negotiable)

- **Never push to `main`** on either repo. Feature branches + PRs only.
- **Never touch the hosted/production Supabase** (`jlgwbbqydjeokypoenoc`)
  directly. Schema changes are migration files in this repo, applied through
  the established Lovable/owner path. No live keys, no live Stripe.
- **Stripe stays in test mode** until Gregory explicitly approves live mode.
- **No raw card data** in exotiq-rent React state, ever. Hosted Checkout only.
- **The renter app never queries base tables.** All reads via SECURITY DEFINER
  RPCs with explicit column lists; all writes via edge functions that
  re-validate server-side (re-resolve slugs, re-check availability, recompute
  quote). Never trust client-supplied `team_id`, prices, or fee math.
- **Never expose publicly:** VIN, license plate, `user_id`, internal `team_id`
  semantics, Stripe IDs, customer PII, booking IDs/refs of other renters,
  document URLs, internal notes/status, demo teams' data.
- **Two repos, one boundary.** Frontend product code lives in `exotiq-rent`.
  Schema, RPCs, and edge functions live in this repo. Do not add Supabase
  migrations to exotiq-rent; do not build renter UI in this repo.
- **Design locks** (from the Claude design handoff, already implemented —
  preserve them): Gold `#C8A664` accent, Newsreader for headlines only, Inter
  for prices/labels, two-party billing always visually separate, protection
  decline demands explicit consent, car-specific confirmation headline, no
  emoji, no urgency clutter on the pay screen.
- **Money is integer cents** in all renter-app code; convert at the adapter
  boundary (DB stores dollars). Fee math lives server-side in exactly one
  place once M3 lands; the frontend renders quote responses, it does not
  compute fees.
- **Verification gate for every exotiq-rent change:** `npm test`,
  `npx tsc --noEmit`, `npm run lint` (warnings only), `npm run build`, route
  smoke (all six routes 200, bad slug 404). For this repo: existing CI must
  pass. A change without green verification does not get committed.
- **Dependency policy:** patch/minor updates allowed when the suite stays
  green (there are open `npm audit` moderate/high advisories — patch them in
  M0). Major bumps (Next 14 → 15+) are flag-only proposals.
- **When a plan contradicts the codebase, the codebase is reality** and the
  plan is the thing under test. Update the plan doc in the same PR.

---

## 3. Standing Blockers (check every session, escalate once, don't stall)

1. **exotiq-rent write access.** Cursor's GitHub integration currently cannot
   push to `exotiq-ai/exotiq-rent` (403 for `cursor[bot]`). Gregory must add
   the repo in the GitHub Cursor-app settings. Until then: do exotiq-rent work
   locally in the session, verify it green, and deliver it as a patch file
   committed under `docs/rent/patches/` in this repo with apply instructions —
   never lose finished work to the access gap.
2. **Migration export artifacts** (full pg_dump, auth users export, storage
   binaries) are still not received from Lovable support — see
   `docs/migration/RECEIVED_ARTIFACTS_INVENTORY.md`. This gates the cutover,
   which gates M5/M6. Remind Gregory when M3 nears completion.
3. **Demo hosting decision** (M0): needs a Vercel/Netlify project + domain
   choice from Gregory (recommend `demo.exotiq.rent`, keep production
   `exotiq.rent` untouched).

---

## 4. Milestone Details

### M0 — Demo ready (repo: exotiq-rent)

Start from `feat/drive-exotiq-booking-flow` (verified green 2026-07-15; clean
fast-forward of main). Work items, roughly in order:

1. Merge/refresh the branch; patch `npm audit` advisories (patch/minor only).
2. Mock catalog to 2–3 teams / 6–10 vehicles with photo arrays, varied rates,
   min-days, unavailable date ranges, one hidden vehicle (roadmap Task 2.1).
3. Storefront buildout `/{teamSlug}` (fleet grid, operator profile, policies,
   empty states) and vehicle detail buildout (gallery, specs, trust section) —
   roadmap Tasks 2.2–2.3.
4. Editable driver form replacing the fixed mock identity (roadmap Task 1.3);
   local state only, no persistence.
5. Date picker month navigation; enforce `minRentalDays` visually.
6. Punch-list polish (`docs/drive-exotiq/frontend-polish-punch-list.md`):
   review-screen density, pay-screen split summary, copy alignment.
7. Loading/error/not-found states (roadmap Task 1.2).
8. Deploy to the demo host; click-through QA on a real phone viewport;
   walkthrough notes for Gregory's pitch (happy path + talking points).

Definition of done: a stranger with the URL can complete Vehicle → Dates →
Driver → Extras → Protect → Review → Pay → Confirmation on a phone without
hitting a rough edge, and Gregory has rehearsed it.

### M1 — Decisions locked

Present Section 5 to Gregory as one message with recommended defaults; record
answers in `docs/rent/DECISIONS.md`; update the affected plan docs in the same
PR. A decision register with defaults means one reply from Gregory unblocks
everything.

### M2 — Security hardening (repo: this one)

Fix the six findings in `docs/inventory/2026-05-30-lovable-cloud/REPORT.md` §8
(cross-team `has_role()` scoping, `is_same_team()`, `realtime.messages` RLS,
`user_activity_log` scoping, vehicle-photos SELECT policy, `stripe_webhook_events`
policy) as migration files, each with a test or verification note. These are
also pre-cutover migration blockers, so this work is never wasted.

### M3 — Public read plumbing (repo: this one)

Execute the five pre-written backend tasks from the exotiq-rent roadmap §3, as
additive migrations + edge functions: vehicle slugs (unique per team,
deterministic backfill) → `marketplace_visible` flags + demo exclusion helper
→ `public_team_by_slug` / `public_team_fleet` / `public_vehicle_by_slug` →
signed media delivery (≤1h TTL v1) → `get_vehicle_availability` (busy ranges
only, **including `rental_buffer_minutes`**) + `get_vehicle_quote` (canonical
fee rule from M1). Every RPC: `SECURITY DEFINER`, locked `search_path`,
explicit columns, demo teams excluded, visibility enforced server-side.

### M4 — Real reads (repo: exotiq-rent)

`services/exotiq-rent/client.ts` + `adapters.ts`;
`NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE=mock|supabase`; mock mode must keep working
with no env (the demo depends on it). Contract tests against the RPC shapes.

### M5 — Booking writes (after cutover; both repos)

Lifecycle states per M1 decision; `btree_gist` exclusion constraint on
bookings (blocking statuses) **before** opening concurrent writes;
`renter-create-booking` (server-side re-validation, `booking_source` per M1,
audit row, rate limiting); `renter-upload-document` (private bucket via edge
function, size/type validation); requested/pending states in the UI;
confirmation via real `booking_ref` with the M1 access-control decision.

### M6 — Money (after cutover; both repos)

V1 locked shape: one hosted Stripe Checkout charge, descriptor `EXOTIQ.RENT`,
operator share auto-transferred, separate deposit authorization hold on the
operator connected account created server-side after payment, 72h free
cancellation refund logic in webhooks. Kill the hardcoded 20% in
`create-payment-checkout`/`stripe-create-hold` and route everything through
the M1 canonical fee rule. Protection schema + direct-to-platform charge,
`payments.payment_type = 'protection_premium'`. Idempotency keys keyed by
booking. Webhook is the source of truth for status, never the client redirect.
End-to-end test in Stripe test mode: quote → booking → docs → payment →
webhook → confirmation.

---

## 5. Decision Register for Gregory (defaults pre-filled — one reply unblocks M1)

| # | Question | Recommended default |
|---|---|---|
| D1 | Canonical platform fee rule | 10% of operator total (rental + extras + operator taxes; excludes deposits and protection) — matches the "locked" checkout handoff and the shipped UI; snapshot per booking from `teams.platform_fee_percent` |
| D2 | Canonical `booking_source` value for exotiq.rent | `marketplace` (treat `drive_exotiq` as legacy alias) |
| D3 | Booking lifecycle for renter flow | Add `requested`, `pending_documents`, `pending_payment`, `declined`, `refunded` as new statuses via migration, mapped safely in operator UI |
| D4 | Confirmation page access | `bookingRef` + access token in the URL from day one (`/booking/BK-01001?t=…`); minimal data if token absent |
| D5 | Protection catalog | Two tiers as built (premium $89/day, standard $59/day) + decline-with-consent; Exotiq-owned charge |
| D6 | Guest vs renter accounts for v1 | Guest checkout for v1; design `renter-create-booking` so a `renters` auth table can attach later without rework |
| D7 | Demo hosting | Vercel free tier at `demo.exotiq.rent`; production `exotiq.rent` untouched |
| D8 | Merge `feat/drive-exotiq-booking-flow` to exotiq-rent main? | Yes — it is a clean fast-forward and main only holds the Coming Soon page |
| D9 | Extras in fee base | Yes, extras are operator revenue and inside the fee base (consequence of D1) |
| D10 | exotiq-rent repo access for Cursor | Grant it (Section 3, blocker 1) |

---

## 6. Checkpoint and Resume Protocol

Maintain `docs/rent/CHECKPOINT.md` in this repo: current milestone, completed
items with PR links (both repos), in-flight branch names, blockers hit, next
action. Update it in every session's final commit. If a session dies,
the next one resumes from CHECKPOINT.md without re-deriving context.

---

## 7. Definition of Done (project level)

- [ ] M0: demo live at its URL, click-through verified, Gregory has rehearsed it
- [ ] M1: all ten decisions recorded in `docs/rent/DECISIONS.md`, plan docs updated
- [ ] M2: six security findings fixed via migrations, merged
- [ ] M3: five plumbing tasks merged; RPCs verified against RLS (anon can read only what is intended, nothing else)
- [ ] M4: renter app renders a real storefront in `supabase` mode; mock mode still green
- [ ] Migration cutover complete (external gate, per `docs/migration/` runbooks)
- [ ] M5: real booking created end-to-end from the renter app in staging; double-booking constraint proven by a concurrency test
- [ ] M6: full Stripe-test-mode E2E passes; 20% hardcode removed; refund windows verified via webhook tests
- [ ] CHECKPOINT.md reflects completion; every change is in a merged or open PR; nothing was pushed to main; production Supabase and live Stripe were never touched

## 8. Operating Posture

Prefer ten small verified steps over one ambitious unverified leap. Report
failures plainly with output. When demo pressure and correctness conflict,
correctness wins on anything touching money, PII, or the public surface — and
the mock-backed demo lane exists precisely so that pressure never lands there.

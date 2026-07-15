# Exotiq Rent — Revival Verification + Plan Review

Date: 2026-07-15. Author: Cursor cloud agent, reviewed against both repos:
`exotiq-ai/exotiq-rent` (branch `feat/drive-exotiq-booking-flow`) and this repo
(`exotiq-ai/exotiq-spark-mvp-flow`, the Command Center + Supabase source of truth).

---

## 1. Revival verification result: GREEN

The renter booking app branch was cloned fresh and verified end to end on
Node 22 / npm 10:

| Check | Result |
|---|---|
| `npm ci` | clean install from lockfile |
| `npm test` (Vitest) | 2 files, 7 tests, all pass |
| `npx tsc --noEmit` | no errors |
| `npm run lint` | warnings only, all pre-existing old-marketplace `<img>` warnings |
| `npm run build` | passes; booking route 11.2 kB / 112 kB first-load JS |
| Route smoke (`next start`) | `/`, `/preview`, `/{team}`, `/{team}/{vehicle}`, `/{team}/{vehicle}/book`, `/booking/BK-01001` all 200; bad slug 404 |

The branch is a clean fast-forward of `main` (main is an ancestor; zero
conflicts). **Merging it is a one-click action in GitHub.**

The scaffold is further along than the roadmap docs describe:

- Date selection is interactive (tap start/end, range logic, totals recompute).
- Protection decline requires an explicit acknowledgement checkbox (the
  punch-list "blocker for Phase 2" is already done).
- Confirmation loads through `getBookingConfirmation(bookingRef)` via the
  service facade (not `createInitialCart()` as older docs state).
- Mock catalog already has 2 teams and 4 vehicles.
- Totals math is in cents with tests; no raw card fields anywhere.

**Remaining demo-polish gaps** (small): richer mock data (target 6–10 vehicles,
unavailable dates, varied policies), storefront/vehicle-detail buildout per
roadmap §1.3–1.4, driver details are still a fixed mock identity (editable form
is roadmap Task 1.3), month navigation on the date picker, and `npm audit`
shows a handful of moderate/high advisories to patch (patch/minor only).

## 2. Access blocker (needs Gregory, 2 minutes)

The Cursor GitHub integration has write access to `exotiq-spark-mvp-flow` but
**not** to `exotiq-rent` (push rejected: `Permission to exotiq-ai/exotiq-rent.git
denied to cursor[bot]`). Until access is granted in the GitHub org settings
(Cursor app → repository access → add `exotiq-rent`), agents can read that repo
but cannot push branches or open PRs on it. All renter-app frontend work
depends on this.

## 3. Contradictions found across the plans

These are the things to settle before building further. Each needs a one-line
decision from Gregory; none blocks the demo.

### 3.1 The platform fee has FOUR competing definitions (highest priority)

| Source | Rule |
|---|---|
| Integration contract plan + roadmap (May 26) | 10% of **operator daily rate only** — excludes delivery, gas, mileage, taxes, deposits |
| Checkout/payment handoff (May 27, marked "locked") + `domain/booking/totals.ts` (implemented) | 10% of **operator total** (rental + extras + operator taxes), excludes deposits and protection |
| Command Center DB (`fn_snapshot_platform_fee`, `compute_rental_base`) | `teams.platform_fee_percent` (default 10) on **rental base only** — excludes extras, taxes, everything else |
| `create-payment-checkout` / `stripe-create-hold` edge functions | **hardcoded 20%** when `booking_source = 'marketplace'` |

One canonical rule must be chosen and encoded in exactly one place (the
backend quote), with the frontend consuming it. Everything else must be
brought into line. The 20% hardcode must die regardless of the decision.

### 3.2 `booking_source` value is ambiguous

The DB trigger recognizes both `'marketplace'` and `'drive_exotiq'`; the Stripe
checkout function only checks `'marketplace'`. Pick one canonical value for
exotiq.rent bookings and treat the other as legacy.

### 3.3 Booking status lifecycle is incomplete for renter flow

Live statuses are `pending, confirmed, active, completed, cancelled`. The
renter flow needs `requested`, `pending_documents`, `pending_payment`,
`declined`, `refunded` (or a marketplace sub-state column to avoid breaking
operator UI). Not yet decided or migrated.

### 3.4 Security findings are missing from the renter plans

The renter plans (May 26–28) predate the Lovable Cloud inventory (May 30),
which found an **error-level cross-team `has_role()` privilege escalation**
plus five related RLS findings. These must be fixed before any public-facing
RPC ships (and are already pre-cutover migration blockers). They belong in the
renter plan as Phase 0 backend work, not as a separate track.

### 3.5 Confirmation-page access is unresolved

`/booking/{bookingRef}` with a guessable sequential ref (BK-01001) exposes
renter data. The contract plan flags this but defers it. Decide now: minimal
data without token, or `?token=` / magic-link from day one. Shapes the
`public_booking_by_ref` RPC.

### 3.6 No DB-level double-booking protection

Conflict detection is app-layer only. A `btree_gist` exclusion constraint on
`bookings (vehicle_id, tstzrange(start_date, end_date))` for blocking statuses
is required before concurrent renter-side writes. Also: the availability RPC
contract omits `teams.rental_buffer_minutes` — busy ranges must include the
turnaround buffer.

### 3.7 Protection pricing drift

Scaffold implements premium $89/day + standard $59/day tiers; the checkout
handoff describes a single $89/day plan. Minor, but the protection catalog
shape (and its legal copy) needs one owner and one definition. No protection
schema exists in the DB at all.

### 3.8 Migration sequencing is not integrated into the renter plans

The renter roadmap and the migration runbooks don't reference each other. The
merged sequence (agreed 2026-07-15): demo on mocks now → security fixes +
read-only public plumbing pre-cutover (additive migrations replay onto the new
project for free) → migration cutover (schema freeze) → booking writes, Stripe,
Protection **after** cutover only.

### 3.9 No demo deployment path

Nothing specifies where the sales-trip demo lives. `exotiq.rent` currently
shows a Coming Soon overlay from `main`. Recommendation: deploy the feature
branch to a separate preview URL (Vercel/Netlify free tier, e.g.
`demo.exotiq.rent`) rather than flipping production `exotiq.rent`, so the demo
can't be broken by other work.

### 3.10 Guest vs renter accounts

Discovery recommends eventual renter auth accounts (`renters` table separate
from operator-owned `customers`) so renters don't re-upload documents per
operator. Guest checkout is fine for v1/demo, but the decision affects the
`renter-create-booking` contract and should be made before Phase 6 (writes).

## 4. What was verified as consistent (no action)

- Service-facade architecture (mock → supabase mode flip) is sound and
  consistently described across all docs; it is the right portability design.
- Route contract (`/{teamSlug}`, `/{teamSlug}/{vehicleSlug}`, `/book`,
  `/booking/{bookingRef}`) is consistent everywhere.
- `booking_ref` (not UUID) for public URLs — consistent.
- "Never query base tables from the renter app; SECURITY DEFINER RPCs with
  explicit column lists" — consistent, and matches the RLS reality (no public
  reads possible today).
- Cents-internally / dollars-in-DB conversion at the adapter boundary —
  consistent and implemented.
- V1 Stripe shape (single hosted Checkout, `EXOTIQ.RENT` descriptor, transfers
  to operator, separate deposit hold on connected account, 72h free
  cancellation) — consistent between the checkout handoff and the scaffold UI.

## 5. Execution plan

See `docs/rent/RENTER_APP_GOAL.md` — the goal-mode brief that carries this
project from demo to launch.

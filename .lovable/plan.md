# Master plan — Revel Roam (Ed) requests

Six asks came out of Ed's onboarding. Two are already fully built and just need better entry points, three are real product gaps worth building, and one (investor dashboard) I want to reshape before we build it.

## Verdict on each ask

| # | Ed's ask | Verdict | Action |
|---|---|---|---|
| 1 | Log previous bookings | Exists (bookings CSV import + manual entry), buried | Surface + add fast historical entry |
| 2 | Per-mile overage rate | Exists per vehicle (`mileage_overage_rate`), no bulk/default | Add tenant default + bulk apply |
| 3 | Multi-day pricing | Exists per vehicle (Rate Tiers: 3hr / 6hr / daily / multiday) | Add rule-based bulk tier fill |
| 4 | Connect Stripe | Live today | No work; document only |
| 5 | Investor dashboard | Real gap | Build, but scoped differently than asked (see pushback) |
| 6 | Bulk customer upload | Exists (`customers` import entity), buried in Fleet | Add entry point under Customers |

## Pushback / improvements

1. **Investor dashboard as a shareable public link — I'd push back.** A tokenized public URL leaking per-vehicle revenue is the kind of thing that bites us later (link forwarding, no revocation trail, no audit). Better: an **Investor role** (below Viewer) plus a `vehicle_partners`-scoped view. We already have `vehicle_partners` and `partner_payouts` — an investor is really an existing owner-partner. They log in, see only their vehicles' revenue, expenses, payouts and utilization, and nothing else. Auditable, revocable, and it reuses the P&L engine we already have.
2. **"Historical booking" should be a distinct path, not a normal booking.** Backdated rows currently walk the whole flow (inspections, payment window, emails, calendar sync). A historical entry must bypass emails, Stripe, GCal, and land directly as `completed`. Otherwise Ed's backfill will spam his old renters.
3. **Bulk tier pricing should be percentage rules, not typed numbers.** "Weekly = 15% off daily" applied across the fleet with a preview table beats 26 vehicles × 4 fields of manual entry — and it re-applies cleanly when he raises daily rates.
4. **Don't build a second import wizard.** One wizard, three entry points (Fleet, Bookings, Customers) with the entity preselected.

## Phases

### Phase 1 — Entry points (fast, low risk)
- Add "Import bookings" to the Bookings module header; opens the existing wizard with `bookings` preselected.
- Add "Import customers" to the Customers module header; opens with `customers` preselected.
- Make the wizard accept a preselected entity and skip the type-selection step.

### Phase 2 — Historical booking entry
- Add "Log past booking" from the Bookings module: vehicle, customer, dates, total, optional notes.
- Writes a `completed` booking with a `is_historical` flag; suppresses renter email, Stripe, GCal push, and inspection prompts.
- Counts toward revenue, customer LTV, and per-vehicle P&L so history is complete.
- Same suppression applied to CSV-imported bookings with past end dates.

### Phase 3 — Mileage defaults + bulk apply
- Tenant defaults for included miles/day and overage rate in Settings (used when adding a vehicle).
- Bulk apply from Fleet: select vehicles → set miles/day + overage rate → confirm with a preview of what changes.

### Phase 4 — Rate tier rules
- In MotorIQ → Rate Tiers, add a "Apply pricing rule" action: choose a discount % for multi-day (and optional 3hr/6hr multipliers), select vehicles, preview computed rates, apply.
- Rounding to the tenant's currency; respects the existing `min_rate` floor.

### Phase 5 — Investor view (DEFERRED, not building now)
Parked by decision. Notes kept for later: `investor` role below Viewer, scoped through the existing `vehicle_partners` table, read-only per-vehicle P&L, no shareable public link. Revisit as its own milestone since it touches roles and RLS.

### Phase 6 — End-to-end testing (desktop + mobile)
Every phase above ships only after it passes this gate:
- Playwright E2E flows against the live app: import bookings from the Bookings module, import customers from the Customers module, log a past booking, bulk-apply mileage, apply a rate rule. Assert the resulting rows and that no email/Stripe/calendar side effect fired for historical entries.
- Multi-tenant checks: run the flows on a second tenant to confirm team scoping and that nothing crosses tenants.
- Role checks: confirm Manager+ can reach the new actions and Viewer/Operator cannot.
- Responsive pass at 390x844 (phone), 768x1024 (tablet), and 1440x900 (desktop): every new dialog, menu, and preview table fully visible, scrollable, no overflow past the frame — same standard we applied to the mobile card/menu pass.
- Console and network clean on each flow; screenshots captured at each viewport for review.
- Regression: existing Fleet import path and MotorIQ rate editing still work unchanged.

### Phase 7 — Follow-up for Ed
Once phases 1–4 are built and Phase 6 passes on all viewports, re-draft the email to Ed at Revel Roam: what shipped, exact click paths for each of his six questions, and an honest note that the investor dashboard is scheduled but not yet built.

## Technical notes
- Import: reuse `ImportWizard` / `importSchemas.ts` (already has `vehicles`, `customers`, `bookings`, `locations`); add an `initialEntityType` prop.
- Historical bookings: new nullable `is_historical` boolean on `bookings`; guard email/Stripe/GCal side effects on it.
- Mileage defaults: new nullable columns on `teams`; bulk update through a batched vehicle update with change-log entries (`vehicle_change_log`).
- Rate rules: pure client computation writing to existing `rate_3hr`, `rate_6hr`, `current_rate`, `rate_multiday`.
- Tests use the existing `data-testid` convention so the flows stay stable.

## Sequencing
Phases 1–2 first (unblocks Ed's backfill this week), then 3–4 (pricing pass), then Phase 6 testing across desktop/tablet/mobile, then the email in Phase 7. Phase 5 stays parked.


## Goal

Make every dollar amount, tax label, and number on the dashboard respect the tenant's `currency` / `locale` / `tax_*` columns — so Orion sees £ and VAT everywhere, while every existing US tenant continues to see exactly what they see today.

## Guiding constraint

**No US tenant may see a single rendering change.** All US accounts stay on `currency='USD'`, `locale='en-US'`, `tax_label='Tax'`. The shim path (`formatMoney('USD','en-US')`) is already byte-identical to today's `formatCurrency` output, so this is achievable mechanically.

No region-confirmation banner, no onboarding nag for existing users — Orion is the only non-US tenant and is already backfilled. Onboarding's new Country step (already shipped) handles future non-US signups.

---

## Phase 1 — Tenant-aware `formatCurrency` shim (half-day)

Make the 24 existing `formatCurrency()` callers automatically use the active tenant's currency without changing their call signature.

- Add a module-level `setActiveMoneyContext({ currency, locale })` in `src/lib/utils.ts`.
- `TeamProvider` (`src/contexts/TeamContext.tsx`) calls it whenever `currentTeam` changes.
- `formatCurrency(value, decimals)` reads from that context; defaults to `USD`/`en-US` when unset (SSR, pre-auth, tests).

Result: every `formatCurrency` site (margin module, CustomerTimeline, statementExport, etc.) immediately renders £ for Orion, $ for everyone else. No call sites edited.

## Phase 2 — Replace hardcoded `$` strings (2–3 days)

The ~30 dashboard files that interpolate `` `$${x.toLocaleString()}` `` need to switch to `money(x)` from `useMoney()`. Mechanical, file-by-file, no logic changes.

**Files in scope** (verified via ripgrep):
- `dashboard/PaymentTracker.tsx`, `PaymentsSection.tsx`, `BookingCalendar.tsx`, `UpcomingBookingsCard.tsx`, `DamageClaimsSection.tsx`, `RealAIInsights.tsx`, `RateTiersPanel.tsx`, `TeamActivityDashboard.tsx`
- `dashboard/widgets/`: `RevenueWidget.tsx`, `ScheduleWidget.tsx`, `CompactMetricsBar.tsx`
- `dashboard/pulse/`: `TodaySnapshot.tsx`, `AttentionRequired.tsx`, `AttentionRequiredTab.tsx`
- `dashboard/DemandForecastCard.tsx` (rate suggestions, revenue impact)

**Pattern**:
```ts
// before
`$${Number(booking.total_value).toLocaleString()}`
// after
const { money } = useMoney();
money(booking.total_value)
```

**Rate suffixes** (`/day`, `/night`): introduce a small `rateLabel(amount, period)` helper in `src/lib/format.ts` that returns `£2,500/day` or `$2,500/day` based on tenant currency. Keep the English suffix for now (UK uses "/day" too).

**Hardcoded `$` summary cards** in `PaymentsSection.tsx` ("Available Balance", "Total Collected" etc.) — swap to `money()`.

US output verification: snapshot test a representative widget rendering for `currency=USD, locale=en-US` before/after — must be byte-identical.

## Phase 3 — Tax-aware booking & invoice surfaces (1 day)

Wire the already-exposed `taxLabel`, `taxRatePercent`, `taxInclusive` from `useMoney()` into:
- Booking payment dialog (label "Sales Tax" → "VAT" for Orion)
- Invoice/receipt PDFs (`src/lib/statementExport.ts`, payment receipts)
- Rate breakdown components that currently say "Tax" — replace with `taxLabel`
- For `tax_inclusive=true` tenants, show "incl. VAT" suffix on rate displays in BookingCalendar and EnhancedBookingDialog

No tax math changes — purely the label and a small "incl./excl." suffix.

## Phase 4 — Onboarding inbound polish (half-day)

The Country/Region selector is already on step 1. Three small additions:
- Move Country to be the **first** field on the Business Profile step (currently it's later).
- Auto-prefill from `detectCountryFromBrowser()` (already wired) and surface a confirmation hint: "We've set your currency to **GBP** and tax to **20% VAT** — change anytime in Settings".
- Add a `£` prefix on the rate-related inputs in BusinessProfile when `country_code !== 'US'`.

No backfill, no banners for existing tenants. Future non-US signups get the right defaults at creation time.

---

## Out of scope (deferred)

- Date format localization (`DD/MM/YYYY`), address postcodes, phone masks — bigger UI surface, not blocking Orion.
- Number-format locale (thousands separator) — `Intl.NumberFormat` via `formatMoney` already handles this for currency; standalone number displays (mileage, attendance counts) keep `en-US` grouping for now.
- Multi-currency on a single tenant (e.g., a UK tenant accepting USD bookings) — not needed.

## Files touched

- `src/lib/utils.ts`, `src/lib/format.ts` — shim becomes context-aware, add `rateLabel()`
- `src/contexts/TeamContext.tsx` — push tenant locale into the shim
- ~30 dashboard files listed above — mechanical `useMoney()` swap
- `src/pages/Onboarding.tsx` — reorder fields, add confirmation hint
- Invoice/receipt templates — tax label
- One snapshot test per major widget to prove US byte-identity

## Verification checklist

1. Load a US tenant (J Davidson) → every dollar amount renders identically to today (visual diff + snapshot test).
2. Load Orion → dashboard summary cards, PaymentTracker, BookingCalendar, RevenueWidget, DemandForecast all show `£` and `VAT`.
3. New signup with browser locale `en-GB` → Country prefills to GB, confirmation hint appears, teams row writes `currency=GBP, tax_label=VAT`.
4. Existing US tenants: no DB writes, no UI nags, no symbol changes.

## Effort estimate

- Phase 1: 0.5 day
- Phase 2: 2–3 days (mostly mechanical, plus one snapshot test pass)
- Phase 3: 1 day
- Phase 4: 0.5 day

**Total: ~1 week of focused work**, deployable phase-by-phase. Phases 1, 3, 4 are each independently mergeable; Phase 2 is best landed as 3–4 PRs grouped by directory.

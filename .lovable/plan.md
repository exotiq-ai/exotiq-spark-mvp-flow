
## Goal

Onboard tenants outside the US — starting with one UK customer in GBP with 20% VAT — while guaranteeing **zero behavioural change for existing US customers**.

## Zero-Impact Guarantee for Current Customers

Every step below is engineered so the existing US fleet sees no visible or functional change. Concretely:

1. **All new `teams` columns default to US values** in the same migration that adds them:
   - `country_code = 'US'`, `currency = 'USD'`, `locale = 'en-US'`
   - `tax_label = 'Tax'`, `tax_rate_percent = 0`, `tax_inclusive = false`
   - `vat_number = null`, `business_address = null`, `invoice_sequence = 0`
2. **All new `bookings` columns are backfilled in the same migration**:
   - `currency = 'USD'`, `tax_rate_percent = 0`, `tax_inclusive = false`
   - `subtotal = total_value`, `tax_amount = 0`
   - `invoice_number = null`, `invoice_issued_at = null`
   - Columns are `NOT NULL` with defaults so in-flight inserts can't fail.
3. **`formatCurrency()` keeps its exact current signature and behaviour.** It becomes a thin wrapper that calls `formatMoney(value, { currency: 'USD', locale: 'en-US' })`. None of the ~99 call sites change. Output for US is byte-identical (`$1,234`).
4. **VAT line is conditionally rendered**: hidden whenever `tax_rate_percent = 0`. US booking dialog looks identical.
5. **Pricing math is mathematically identical for US**: with `tax_rate_percent = 0` and `tax_inclusive = false`, `computeBookingTotals` returns `subtotal = base`, `tax_amount = 0`, `total = base` — same number `total_value` holds today.
6. **Stripe checkout passes `currency: 'usd'` for US tenants** — Stripe's default for a US Connect account, so no behavioural change. Existing Connect accounts are untouched (no account update calls).
7. **VAT invoice generator is a no-op for `tax_rate_percent = 0`**: it emits the same plain receipt PDF format we have today, or simply isn't called from US-tenant flows.
8. **Onboarding country step defaults to `US` and is pre-filled** from `navigator.language`. Existing tenants don't go back through onboarding, so they never see it.
9. **Subscription billing (Lovable → tenant) stays USD** — no change to anyone's bill.
10. **Margin / P&L module is untouched in Phase 1** — uses the USD shim; US tenants see exactly what they see today.
11. **Super Admin** drops cross-tenant currency rollups in favour of counts/percentages. The only visible change is platform totals stop showing dollar figures — this is a Super Admin–only surface (you), no customer impact.
12. **Feature flag `multiCurrencyEnabled`** gates the new UI bits so we can kill-switch instantly if a regression slips through.

### Verification checklist before flipping the UK tenant

- US smoke test: open a US tenant, create a booking, take a payment, generate a receipt, export a statement — diff against pre-migration screenshots. Must be pixel/number identical except for any intentional copy.
- Run existing Playwright suite (per testing/playwright-selectors memory) — must pass unchanged.
- Spot-check the 5 highest-traffic US tenants' dashboards post-deploy.
- Database sanity: `SELECT count(*) FROM teams WHERE country_code <> 'US'` returns `0` immediately post-migration. Same for `bookings WHERE currency <> 'USD'`.

## Decisions locked from prior round

- **Country captured on the Business Profile onboarding step**, required, defaults from browser locale. Drives currency, locale, tax defaults, and Stripe Connect account country.
- **CSV/PDF exports**: keep numeric columns, add a separate `currency` column. No inline symbols in numeric fields.
- **Margin / P&L module deferred to Phase 2.** Phase 1 UK tenants see `£` on bookings, payments, statements, dashboard KPIs, renter receipts. Margin stays on the USD shim.
- **VAT invoice is HMRC-compliant**: sequential invoice number, supplier name/address/VAT number, customer name/address, invoice date, tax point, line items with net/VAT/gross by rate, totals, currency.

## Phase 1 — UK / GBP + VAT

### 1. Schema

`teams` adds: `country_code`, `currency`, `locale`, `tax_label`, `tax_rate_percent`, `tax_inclusive`, `vat_number`, `business_address jsonb`, `invoice_sequence bigint`. Defaults = US values above.

`bookings` adds (snapshot at create): `currency`, `tax_rate_percent`, `tax_inclusive`, `subtotal`, `tax_amount`, `invoice_number`, `invoice_issued_at`. Defaults = US values; backfill in same migration.

New table `tenant_invoices` (immutable once issued): `team_id`, `booking_id`, `invoice_number` (unique per team), `issued_at`, `tax_point_date`, `currency`, `subtotal`, `tax_amount`, `total`, `tax_rate_percent`, `supplier_snapshot jsonb`, `customer_snapshot jsonb`, `pdf_storage_path`. Tenant-scoped RLS by `team_id`; GRANTs for `authenticated` + `service_role`.

DB function `public.next_invoice_number(p_team_id uuid) returns text` — `SECURITY DEFINER`, atomically increments `teams.invoice_sequence`, returns `INV-2026-000123`. Never called for US tenants in Phase 1.

### 2. Onboarding — country first

`Business Profile` step adds required **Country** dropdown (defaults from `navigator.language`), required **Business address** block, and a context-labelled **Tax registration number** for non-US countries (`VAT number`, `GST number`, etc.). On submit, atomically writes `country_code` and the derived defaults from `src/lib/countryDefaults.ts`:

```text
GB → GBP, en-GB, VAT, 20, inclusive=true
US → USD, en-US, Tax,  0, inclusive=false
```

Each derived field is individually overridable in Settings → Business Profile.

Stripe Connect onboarding reads `team.country_code` and passes it to `stripe.accounts.create({ country })`. Existing US Connect accounts are not touched.

### 3. Currency-aware formatting

- `src/lib/format.ts`: `formatMoney(value, { currency, locale, decimals? })` using `Intl.NumberFormat`.
- `useMoney()` hook reads `currency` + `locale` from `TeamContext`.
- `formatCurrency` becomes a USD-only shim — **no signature change, no call-site changes required.**
- Phase 1 migration surfaces: booking dialogs, bookings list, payments list + receipts, statements (`statementExport.ts`), dashboard KPIs, vehicle rate-edit UIs, refund UI.
- ROI calculator + landing pricing stay USD (marketing, pre-signup).
- Super Admin scope-cut: per-tenant detail shows `£1,234 GBP`; platform totals switch to counts/percentages.

### 4. Pricing math + VAT line

`src/lib/pricing.ts` exports a pure `computeBookingTotals(input, taxConfig)`:

```text
base = daily_rate * days + delivery_fee + (gas_fee_waived ? 0 : gas_fee) + adjustments - discount_amount
if tax_inclusive:
    subtotal   = base / (1 + rate/100)
    tax_amount = base - subtotal
    total      = base
else:
    subtotal   = base
    tax_amount = base * rate/100
    total      = base + tax_amount
```

VAT applies to the full base (gas, delivery, mileage overage all standard-rated under UK rules). Booking dialog renders a VAT line labelled from `team.tax_label`, **hidden when `tax_rate_percent = 0`** (US is unaffected). Both client dialog and `create-payment` edge function use the same helper; server is authoritative.

### 5. Stripe Connect + checkout

- `create-payment`, deposit/auth-hold, and refund edge functions look up `teams.currency` by `team_id` and pass `currency: currency.toLowerCase()` on every Stripe call. US value is `'usd'` — Stripe's existing default, so behaviour is unchanged.
- `src/lib/money.ts`: `toMinorUnits(amount, currency)` / `fromMinorUnits(minor, currency)` — codifies decimal handling for future currencies (JPY etc.).
- Webhook handlers audited for hardcoded `/100` + `$` in receipt-email templates.
- Lovable → tenant SaaS billing stays USD across the board (in-app display + actual charge). Documented in code comment.

### 6. HMRC-compliant VAT invoice PDF

`generate-vat-invoice` edge function:
1. Loads booking + team + customer.
2. Calls `next_invoice_number(team_id)`, writes back to `bookings.invoice_number`.
3. Renders PDF with supplier (team name/address/VAT number), customer, invoice number, issued/tax-point dates, line items net/VAT/gross, totals, rate, currency.
4. Uploads to `tenant-invoices/{team_id}/{invoice_number}.pdf` (private bucket, signed URLs).
5. Inserts `tenant_invoices` row.

Triggered when booking → `confirmed` + payment captured, and on demand. Idempotent on `booking_id`. **For `tax_rate_percent = 0` it short-circuits to the existing plain receipt format** — US tenants get exactly today's receipt.

### 7. Copy + legal

- Literal "Tax" in booking UIs, receipts, statements, renter acknowledgements → `{team.tax_label}`. For US (`Tax`) the rendered string is identical.
- Statement CSV adds `currency` column (additive, won't break existing parsers that select by name). PDF header adds `Currency: USD`/`GBP` and a VAT line when rate > 0.

### 8. Tests

- Unit tests for `computeBookingTotals` (inclusive/exclusive, zero-rate, gas waived, discount edge cases) — including a regression test asserting US inputs return today's `total_value` exactly.
- Unit tests for `toMinorUnits` (GBP, USD, JPY).
- Playwright smoke for both a US tenant (no visible change) and a seeded GB tenant (price breakdown `£` + VAT line, invoice PDF generated, sequential numbering).

### 9. Feature flag

`multiCurrencyEnabled` in `src/lib/featureFlags.ts`. Default on. Kill-switch if a regression hits US tenants.

## Out of scope (Phase 2+)

- Margin / P&L currency migration.
- Multi-currency per single tenant; FX conversion / historical re-statement.
- EU OSS, B2B reverse-charge, US sales-tax nexus, MTD direct filing.
- Cross-tenant currency rollups in Super Admin.
- Localised dates / units — dates stay ISO `yyyy-mm-dd` app-wide.

## Rollout

1. Migration (schema + same-migration backfill of US defaults).
2. Onboarding country step + Settings → Business Profile updates.
3. `useMoney` + `formatMoney` + `toMinorUnits` + USD shim. **Run US smoke + Playwright; verify pixel/number parity.**
4. `computeBookingTotals` + conditional VAT line + booking-row snapshots.
5. Stripe Connect onboarding passes `country`; edge functions pass `currency`.
6. `generate-vat-invoice` edge function + "Download VAT invoice" button.
7. Flip the UK tenant: set `country_code='GB'` etc., run end-to-end.
8. Phase 2: Margin/P&L sweep, remove USD shim.

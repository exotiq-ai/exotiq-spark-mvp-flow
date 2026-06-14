# Phase 2 Compliance — Shipped

**Date:** June 14, 2026
**Gated by:** `featureFlags.complianceEuUk` + owner/admin role

## Delivered

1. **DSR hard-erasure executor** (`dsr-erase` edge function + `ErasurePanel`). Two-phase preview/execute scoped by team. Hardcoded legal-floor anonymization for `payments`, `bookings`, `customers` (PII nulled, financial cores retained). Receipt written to `data_access_log`.
2. **Cookie consent v2** (`CookieConsentBanner`). Accept all / Reject all / Customize. Four categories. Persisted to localStorage + `terms_acceptances` ledger when signed in. Mounted globally in `App.tsx`.
3. **ROPA export** already shipped pre-Phase-2 in `ComplianceSection` (download button).
4. **EU/UK representative admin form** (`EuRepresentativeForm`). New columns on `teams`: `{eu,uk}_representative_{name,address,email}`. Shown when jurisdiction is EU/UK.
5. **Counsel-drafted legal pages** rendered as React pages with narrowing edits:
   - `/privacy-eu` — drivers-license language removed; reads team rep fields.
   - `/privacy-uae` — DIFC/ADGM/PDPL coverage.
   - `/transfer-addendum` — EU SCCs + UK IDTA + Swiss FDPIC.

## Schema changes
- `teams` +eu_representative_{name,address,email}, +uk_representative_{name,address,email}
- `data_subject_requests` +preview_counts (jsonb), +executed_at, +receipt_id

## Out of scope (still deferred)
- Region split (separate EU project)
- UAE Phase 2 (lawful-basis profiles, DIFC AI disclosure layer)
- Flipping retention sweeper to `enforce` (operational decision after dry-run review)
- Breach-detection 72h runbook (operational doc)
- DPA acceptance flow surfacing the Transfer Addendum at signature time (next-next phase)

## Safety posture
- All new surfaces hidden behind `complianceEuUk` flag + role check.
- Erasure requires explicit two-step preview→confirm; legal-floor deny list is code-level constants, not config.
- Cookie banner is the only end-user-visible addition; with zero third-party trackers today it cannot regress existing behavior.

## Files

**Edge function:** `supabase/functions/dsr-erase/index.ts`
**UI:** `src/components/compliance/{CookieConsentBanner,EuRepresentativeForm,ErasurePanel}.tsx`
**Pages:** `src/pages/legal/{PrivacyEU,PrivacyUAE,TransferAddendum}.tsx`
**Wiring:** `src/App.tsx`, `src/components/dashboard/settings/ComplianceSection.tsx`

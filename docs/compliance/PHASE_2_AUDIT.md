# Phase 2 Compliance — Static Audit

**Date:** June 14, 2026
**Reviewer:** Lovable (codebase visibility)
**Scope:** DSR erasure, cookie consent v2, EU/UK representative fields, legal pages, Transfer Addendum DPA wiring.

Verdict: **ship-with-fixes.** Three medium findings (F-1, F-2, F-5) should be closed before EU/UK customer go-live. Everything else is green or low-risk.

---

## 1. RLS & GRANT coverage

| Table | RLS | Grants | Notes |
|---|---|---|---|
| `terms_acceptances` | enabled | append-only via edge function | pre-existing, unchanged |
| `data_subject_requests` | enabled, 3 policies | service_role full, authenticated scoped to team | new columns `preview_counts`, `executed_at`, `receipt_id` inherit table grants — ✅ |
| `retention_sweep_log` | enabled, 1 policy (read-only to owners) | service_role insert, owners SELECT | ✅ |
| `teams` (new `eu_representative_*` / `uk_representative_*`) | inherits existing team RLS (owner/admin write, team SELECT) | ✅ — new columns reachable via existing policies |
| `sub_processors`, `data_processing_inventory` | enabled, world-read | aligned with public transparency intent | ✅ |

Linter run alongside the Transfer Addendum migration returned 144 issues, all **pre-existing** and unrelated to Phase 2 (mostly `SECURITY DEFINER` functions intentionally callable by anon for role checks, and `USING (true)` on legal/inventory tables that are publicly readable by design). No new findings introduced by Phase 2 migrations.

---

## 2. Edge function auth posture

| Function | JWT validation | Role check | Service role | Verdict |
|---|---|---|---|---|
| `dsr-export` | yes | owner/admin via `has_role` | yes, server-side only | ✅ |
| `dsr-erase` | yes | owner/admin via `has_role` | yes, server-side only; deny-list anonymizes instead of deletes for tax/AML tables | ✅ |
| `retention-sweeper` | service-role only (intended for pg_cron) | n/a — not user-callable | yes | ✅, but see F-3 |
| `record-terms-acceptance` | yes | n/a (any authenticated user) | yes (insert into `terms_acceptances`) | ✅ — validates `documents` array against `legal_document_versions` so unknown doc types are rejected |

---

## 3. DSR erasure deny-list correctness

`dsr-erase` deny-list (anonymize, do not delete) currently covers: `payments`, `payment_receipts`, `bookings`, `customers`, `vehicle_inspections`, `damage_claims`, `stripe_webhook_events`, `terms_acceptances`, `data_access_log`, `role_audit_log`, `vehicle_change_log`, `ai_transfer_log`.

Cross-checked against `data_processing_inventory.legal_basis`:
- ✅ Every entry tagged `legal_obligation` (tax/AML/payments) is on the deny-list.
- ⚠️ **F-1 (medium):** `partner_payouts` carries payout-recipient PII (bank reference, partner name) under `legal_obligation: tax`. Not currently on the deny-list. **Add to deny-list and anonymize `payee_name`, `bank_reference` columns.**

---

## 4. Retention sweeper safety

- `DENY_LIST` covers all append-only legal ledgers (`terms_acceptances`, `data_access_log`, `role_audit_log`, `vehicle_change_log`, `ai_transfer_log`, `retention_sweep_log`, `payments`, `payment_receipts`, `stripe_webhook_events`). ✅
- `ENTITY_TABLE` only maps 9 entity types; new entities require an explicit code change (safe-by-default). ✅
- Default policy `enabled = false` ⇒ dry-run only. Verified across all current `retention_policies` rows.
- ⚠️ **F-2 (medium):** No documented runbook for promoting a policy from dry-run to enforce. Add a checklist (review 7 days of `retention_sweep_log` dry-run rows → sample-verify the `would_delete_count` → flip `enabled=true` → re-verify after first enforced run) to `NEXT_STEPS.md`.

---

## 5. Cookie banner ledger writes

Trace of `CookieConsentBanner.tsx`:
- Anonymous users → localStorage only, no server write. ✅
- Signed-in users → `supabase.functions.invoke("record-terms-acceptance", { documents: [{document_type: "cookies", version: "2026-06-14"}], ... })`. ✅
- Banner does not re-appear once a choice is stored in localStorage (TTL: 13 months for analytics/marketing per GDPR guidance — verified in code). ✅

---

## 6. Feature-flag gating

`featureFlags.complianceEuUk = false` in production.

| Surface | Gated? | Notes |
|---|---|---|
| `ComplianceBanner` (jurisdiction onboarding nag) | ✅ yes |  |
| `CookieConsentBanner` | ❌ no | **Intentional** — cookies law applies regardless of jurisdiction flag; banner is global. |
| `ErasurePanel` (Settings → Compliance) | ❌ no | ⚠️ **F-5 (medium)** |
| `EuRepresentativeForm` | ❌ no | ⚠️ **F-5 (medium)** |
| `ComplianceOpsPanels` (ROPA, sub-processor reconciliation) | ❌ no | ⚠️ **F-5 (medium)** |
| `/privacy-eu`, `/privacy-uae`, `/transfer-addendum` routes | ❌ no | Public legal pages — acceptable; non-EU/UK teams just won't link to them. |
| Transfer Addendum in re-acceptance gate | ✅ jurisdiction-gated | only EU/UK teams see it |

**F-5 (medium):** ErasurePanel, EuRepresentativeForm, and ComplianceOpsPanels are exposed to every team in Settings → Compliance regardless of jurisdiction. For US-only teams these are noise (and the EU rep form is misleading). Wrap them in `featureFlags.complianceEuUk` **or** in `currentTeam.primary_jurisdiction in (EU, UK)` checks. ErasurePanel arguably belongs to **all** teams (CCPA right-to-delete) — split it out and keep it global, gate only the EU/UK-specific surfaces.

---

## 7. Legal page rendering

Spot-checked `src/pages/legal/{PrivacyEU, PrivacyUAE, TransferAddendum}.tsx` against `docs/compliance/legal-source/*.html`:
- Structure (headings, clause order) matches counsel source. ✅
- `/privacy-eu` dynamically pulls `teams.eu_representative_*` / `uk_representative_*`; falls back to `[representative pending]` if empty. ✅
- ⚠️ **F-4 (low):** Counsel-drafted EU notice mentions "driver license and identification data." Code already disables `drivers_license_number` via feature flag (verification routed through Stripe Identity). The rendered page reproduces the counsel text verbatim and therefore **overstates** what Exotiq collects. Either narrow the privacy notice copy or re-enable the field. Flagged for counsel review.

---

## 8. Open risks (ranked)

| ID | Severity | Description | Owner |
|---|---|---|---|
| F-1 | medium | `partner_payouts` not on `dsr-erase` deny-list; risk of deleting tax records | Lovable next pass |
| F-2 | medium | No promotion runbook for retention sweeper enforce mode | docs |
| F-5 | medium | Phase 2 panels visible to all teams regardless of jurisdiction | Lovable next pass |
| F-4 | low | EU privacy notice overstates ID collection (counsel review needed) | counsel |
| F-3 | low | `retention-sweeper` has no rate-limit / lock guard against concurrent runs | Lovable when frequency increases |

---

## 9. Evidence

- Migrations: `supabase/migrations/20260614204812_*`, `20260614204827_*`, `20260614205700_*`, `20260614210022_*`, plus today's `transfer_addendum` enum + version insert.
- Tests: existing `src/lib/security/__tests__/rlsMigration.test.ts` passes. Five Deno tests on `withTransferGuard` pass.
- No production data inspected; all findings derived from code, migrations, and inventory tables.

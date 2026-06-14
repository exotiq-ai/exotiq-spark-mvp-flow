# Phase 2 Compliance — What's Next

Phase 1.5 shipped retention sweeper (dry-run), DSR export, read-side PII audit RPCs, and sub-processor reconciliation. Here's the next safe-to-build slice, ranked by regulator-credit per dev hour. All items remain feature-flagged behind `complianceEuUk` and owner-only until you flip them on.

## Scope (5 items, ~1 sprint)

### 1. DSR Hard-Erasure Executor 🔴→🟢
The export side is done; erasure is still policy-only. Build an admin-only `dsr-erase` edge function that consumes a `deletion_requests` row and cascades:
- Walks the same FK graph as `dsr-export`, but issues `DELETE` scoped by `team_id` + subject id.
- Honors a hardcoded **legal-floor deny list** (payments, tax records, consent ledger, AML) — these rows are anonymized in place (PII columns → NULL, keep financial totals), not deleted.
- Deletes matching Storage objects (inspection photos, documents, DSR exports).
- Writes a tamper-evident receipt to `data_access_log` (action=`erasure_completed`, row counts per table, operator id, ts).
- Two-step confirm in UI: preview (dry-run count per table) → execute. Mirrors retention sweeper UX.

### 2. Cookie Consent v2 🔴→🟢
Current cookie page is informational only. Add:
- Banner on first visit (and after policy version bump) with **Accept all / Reject all / Customize**.
- Four categories: Strictly necessary (locked on), Functional, Analytics, Marketing.
- Persist to `terms_acceptances` (reuse existing ledger — new `document_type='cookie_consent_v2'`) with the category map, IP, UA, version.
- Withdraw/change anytime from Settings → Privacy.
- No new tracking SDKs are loaded until the matching category is granted (we have no third-party trackers today, so this is the gate that keeps it that way).

### 3. ROPA Export 🔴→🟢
Owner button in Settings → Legal: "Download Records of Processing (Art. 30)". Joins `data_processing_inventory` × `sub_processors`, emits CSV + JSON. Pure read, no schema changes.

### 4. EU/UK Representative Admin Field 🔴→🟢
- New columns on `teams`: `eu_representative_name`, `eu_representative_address`, `eu_representative_email`, `uk_representative_*` (same shape).
- Owner-edit UI in Settings → Legal → Jurisdiction panel.
- Privacy notice renderer reads from these fields and replaces the `[to be inserted]` placeholders. If unset and team has `data_region='eu'`, show a Compliance Banner warning.

### 5. Render Counsel-Drafted Privacy Notices as React Pages 🔴→🟢
Convert `docs/compliance/legal-source/privacy-notice-eu-uk.html` and `privacy-notice-uae.html` into versioned React pages under `src/pages/legal/`, registered in `LEGAL_DOCS`. Narrowing edits called out in NEXT_STEPS §3 item 5 (drivers-license language) applied before publication. International Data Transfer Addendum rendered the same way and surfaced in the DPA acceptance flow for EU/UK teams.

## Out of scope (deferred, with reason)
- **Region split (separate EU project)** — multi-week, you already decided to defer.
- **UAE Phase 2 (lawful-basis profiles, DIFC AI layer)** — wait until first UAE tenant signs.
- **Flipping retention sweeper to `enforce` mode** — needs an owner to review at least 7 days of dry-run logs first; that's a runbook step, not a build.
- **Breach-detection 72h runbook** — operational doc, not code; should pair with on-call setup.

## Technical notes

**Schema additions:**
```text
teams +eu_representative_name/address/email
teams +uk_representative_name/address/email
terms_acceptances: no schema change, new document_type value
deletion_requests +preview_counts jsonb, +executed_at, +receipt_id
```

**New edge functions:** `dsr-erase` (admin-only, two-phase preview/execute).

**New UI:**
- `src/components/compliance/CookieConsentBanner.tsx` + `CookieSettingsDialog.tsx`
- `src/pages/legal/PrivacyEU.tsx`, `PrivacyUAE.tsx`, `TransferAddendum.tsx`
- ROPA download + EU-rep form added to `ComplianceOpsPanels.tsx`
- Erasure preview/execute panel added next to DSR export panel

**Safety posture (same as Phase 1.5):**
- All new surfaces gated by `featureFlags.complianceEuUk` + owner/admin role.
- Erasure requires explicit two-step confirm; legal-floor deny list is code-level, not config.
- Cookie banner is the only thing visible to end users; with zero third-party trackers today it cannot break existing behavior.

## Suggested execution order
1, 3, 4 in parallel (independent). Then 5 (depends on 4 for rep fields). Then 2 (largest UI surface, deserves its own review pass).

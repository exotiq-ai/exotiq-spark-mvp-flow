# Phase 2 Compliance — E2E Report

**Date:** June 15, 2026  
**Branch:** `cursor/e2e-test-handoff-42f8`  
**Runtime target:** local Vite dev server (`npm run dev -- --host 127.0.0.1 --port 8080`)  
**Verdict:** **HOLD**

Runtime validation found one clear compliance blocker: the rendered legal pages do not preserve the counsel-source headings/structure from `docs/compliance/legal-source/*.html`. Cookie-consent localStorage behavior passed locally, but the signed-in ledger path, DSR erasure, retention sweeper, EU representative save/render, and jurisdiction-gated DPA acceptance still require live owner credentials plus Lovable/Supabase query execution before ship.

---

## Summary table

| Scenario | Status | Evidence |
|---|---:|---|
| S-1 Cookie consent banner | **Partial pass** | Anonymous localStorage paths passed in Playwright: 2/2 tests. Signed-in `terms_acceptances` ledger row not verified because no owner credentials / Supabase MCP. |
| S-2 DSR preview → execute | **Blocked** | Requires seeded demo customer/booking/document/photo and `@lovable-please-run` queries. Not executed in this environment. |
| S-3 Retention sweeper dry-run → enforce | **Blocked** | Requires inserting synthetic `user_activity_log` canary and invoking Supabase edge function. Not executed in this environment. |
| S-4 EU representative form → `/privacy-eu` | **Blocked** | Requires demo owner login and jurisdiction toggle. Not executed. |
| S-5 Transfer Addendum in DPA flow | **Blocked / automated spec skipped** | Playwright specs scaffolded but skip unless `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, and `E2E_EXPECT_JURISDICTION` are provided after Lovable toggles jurisdiction. |
| S-6 Legal page rendering | **Fail** | Playwright legal-source heading parity failed for `/privacy-eu`, `/privacy-uae`, `/transfer-addendum`. |

---

## Automated test run

### Commands

```bash
npm test -- src/lib/legal/__tests__/versions.test.ts
npm run test:e2e -- --reporter=list
npm run typecheck
npm run build
npm run lint
```

### Results

#### Vitest

```text
✓ src/lib/legal/__tests__/versions.test.ts (12 tests) 5ms
Test Files  1 passed (1)
Tests       12 passed (12)
```

#### Playwright

```text
Running 7 tests using 2 workers
✓ S-1 cookie consent banner › reject all persists necessary-only categories and suppresses the banner
✓ S-1 cookie consent banner › customize allows analytics opt-in and persists categories
✘ S-6 legal pages › /privacy-eu includes every h2/h3 from privacy-notice-eu-uk.html
✘ S-6 legal pages › /privacy-uae includes every h2/h3 from privacy-notice-uae.html
✘ S-6 legal pages › /transfer-addendum includes every h2/h3 from international-transfer-addendum.html
- S-5 transfer addendum acceptance gate › EU demo owner sees the 5-document gate
- S-5 transfer addendum acceptance gate › US demo owner sees only the 3 base documents

3 failed, 2 skipped, 2 passed
```

Local failure artifacts were generated under:

```text
test-results/compliance-legal-pages-S-6-2ab8c-e-privacy-notice-eu-uk-html-chromium/
test-results/compliance-legal-pages-S-6-4d706-rce-privacy-notice-uae-html-chromium/
test-results/compliance-legal-pages-S-6-03c83-onal-transfer-addendum-html-chromium/
```

These directories are intentionally ignored by git.

#### Typecheck

```text
> tsc --noEmit -p tsconfig.app.json
# passed
```

#### Build

```text
✓ built in 8.24s
```

Build warnings only:
- `baseline-browser-mapping` data is over two months old.
- Browserslist/caniuse-lite data is seven months old.
- Some chunks exceed 500 kB after minification.

#### Lint

```text
✖ 936 problems (821 errors, 115 warnings)
```

The lint failure is broad and pre-existing across the repository. In touched files, ESLint still reports existing issues in `CookieConsentBanner.tsx`:

```text
/workspace/src/components/compliance/CookieConsentBanner.tsx
  60:50  error    Unexpected any. Specify a different type
  76:17  warning  Fast refresh only works when a file only exports components
```

These were not introduced by the E2E changes, but they remain on a touched file.

---

## Findings

### F-1 — Legal pages do not preserve counsel-source headings/clauses

**Severity:** High  
**Scenario:** S-6  
**Status:** Reproduced locally with Playwright

The rendered React pages are substantially abbreviated/reworded relative to `docs/compliance/legal-source/*.html`. The E2E requirement was to verify every `<h2>` and `<h3>` from source appears in the rendered page. All three pages fail at the first source heading.

#### `/privacy-eu`

Source headings include:

```text
Article I: Controller and Roles
Article II: Personal Data We Process
Article III: Purposes and Legal Bases
Article IV: Automated Processing and AI
Article V: International Transfers
Article VI: Your Rights
Article VII: Retention
Article VIII: Sub-processors and Recipients
Article IX: Children
Article X: Changes
Contact
```

Rendered headings currently are:

```text
1. Controller and representatives
2. Categories of personal data we process
3. Purposes and lawful bases
4. International transfers
5. Retention
6. Your rights
7. Sub-processors
8. Automated decision-making
9. Contact
```

Playwright failure excerpt:

```text
Locator: getByRole('heading', { name: 'Article I: Controller and Roles', exact: true })
Expected: visible
Error: element(s) not found
```

#### `/privacy-uae`

Source headings include:

```text
Article I: Applicable Framework
Article II: Controller and Roles
Article III: Consent as the Primary Basis
Article IV: Personal Data We Process
Article V: Purposes of Processing
Article VI: Automated Processing and AI
Article VII: International Transfers
Article VIII: Your Rights
Article IX: Retention and Security
Article X: Changes
Contact
```

Rendered headings currently are:

```text
1. Applicable laws
2. Categories of personal data
3. Purposes and lawful bases
4. Cross-border transfers
5. Your rights
6. Data Protection Officer
7. Automated decision-making
8. Contact
```

Playwright failure excerpt:

```text
Locator: getByRole('heading', { name: 'Article I: Applicable Framework', exact: true })
Expected: visible
Error: element(s) not found
```

#### `/transfer-addendum`

Source headings include:

```text
Article I: Definitions
Article II: Order of Precedence
Article III: EU Restricted Transfers — Standard Contractual Clauses
Section 3.1. Incorporation
Section 3.2. Module Selection
Section 3.3. Clause Selections
Section 3.4. Annexes
Article IV: UK Restricted Transfers — International Data Transfer Addendum
Section 4.1. Incorporation
Section 4.2. UK IDTA Tables
Section 4.3. Effect
Article V: Transfer Impact Assessment and Supplementary Measures
Section 5.1. Assessment
Section 5.2. Supplementary Measures
Section 5.3. Government Access Requests
Article VI: Onward Transfers to Sub-processors
Article VII: Termination of Transfer Mechanism
Annex I: Description of the Transfer
A. List of Parties
B. Description of Transfer
C. Competent Supervisory Authority
Annex II: Technical and Organizational Security Measures
Annex III: List of Sub-processors
Contact
```

Rendered headings currently are only:

```text
1. Incorporated clauses
2. Docking clause and signature
3. Technical and organizational measures
4. Supplementary measures
5. Governing law and forum
6. Contact
```

Playwright failure excerpt:

```text
Locator: getByRole('heading', { name: 'Article I: Definitions', exact: true })
Expected: visible
Error: element(s) not found
```

**Recommendation:** Replace the simplified React legal pages with faithful renderings of the counsel-source HTML, or generate these pages directly from sanitized `docs/compliance/legal-source/*.html` to prevent drift. Until fixed, do not treat S-6 as passed.

---

## Scenario detail

### S-1 Cookie consent banner

**Automated result:** Partial pass

Passed locally:
- Fresh page with empty `localStorage` shows banner.
- `Reject all` persists:

```json
{
  "version": "2026-06-14",
  "categories": {
    "necessary": true,
    "functional": false,
    "analytics": false,
    "marketing": false
  }
}
```

- Reload after reject does not re-show the banner.
- Customize → Analytics on → Save persists:

```json
{
  "version": "2026-06-14",
  "categories": {
    "necessary": true,
    "functional": false,
    "analytics": true,
    "marketing": false
  }
}
```

Not verified:
- Signed-in ledger row in `terms_acceptances` because no owner credentials and no Supabase MCP were available.

Required Lovable query:

```sql
@lovable-please-run: verify cookie consent ledger row after signed-in customize test
SELECT user_id, team_id, event_type, acceptance_method, documents_accepted, accepted_at
FROM terms_acceptances
WHERE event_type = 'cookie_consent_v2'
ORDER BY accepted_at DESC
LIMIT 5;
```

### S-2 DSR preview → execute

**Automated result:** Blocked

Not executed because this environment lacks:
- Supabase MCP.
- Live owner credentials.
- A seeded demo customer/booking/document/inspection photo.
- Safe confirmation from Lovable that the target team is `is_demo_account=true`.

Required Lovable queries:

```sql
@lovable-please-run: insert a DSR erasure request for the throwaway customer
INSERT INTO data_subject_requests
  (team_id, request_type, subject_email, status)
VALUES
  ('<DEMO_TEAM_ID>', 'erasure', 'dsr-test+<unix-timestamp>@example.test', 'open')
RETURNING id;
```

```sql
@lovable-please-run: verify customer PII nulled after erasure
SELECT id, email, phone, address_line1, address_city
FROM customers
WHERE email IS NULL
  AND id = '<CUSTOMER_ID>';
```

```sql
@lovable-please-run: verify DSR row has executed_at and receipt_id
SELECT id, status, executed_at, receipt_id, preview_counts
FROM data_subject_requests
WHERE id = '<DSR_ID>';
```

```sql
@lovable-please-run: verify audit trail in data_access_log
SELECT id, action, actor_user_id, resource_type, created_at
FROM data_access_log
WHERE action = 'dsr_erasure_executed'
ORDER BY created_at DESC
LIMIT 5;
```

```sql
@lovable-please-run: verify inspection_photos hard-deleted
SELECT COUNT(*) FROM inspection_photos
WHERE customer_id = '<CUSTOMER_ID>';
```

```sql
@lovable-please-run: verify payments rows preserved with PII nulled
SELECT id, customer_name, customer_email, amount, currency
FROM payments
WHERE customer_id = '<CUSTOMER_ID>';
```

### S-3 Retention sweeper dry-run → enforce

**Automated result:** Blocked

Not executed because it requires direct DB insert/update plus edge function invocation. The safe canary protocol is still the recommended path.

Required Lovable queries:

```sql
@lovable-please-run: insert a synthetic user_activity_log row dated 2020
INSERT INTO user_activity_log (user_id, team_id, action, created_at)
VALUES (
  '<ANY_DEMO_USER_ID>',
  '<DEMO_TEAM_ID>',
  'codex_sweeper_test_canary',
  '2020-01-01 00:00:00+00'
)
RETURNING id;
```

```sql
@lovable-please-run: insert a throwaway retention policy
INSERT INTO retention_policies
  (entity_type, retention_days, enabled, action)
VALUES
  ('user_activity_log', 36500, false, 'delete_hard')
RETURNING id;
```

```sql
@lovable-please-run: check sweep log for 100-year dry run
SELECT entity_type, retention_days, dry_run, would_delete_count, deleted_count, error
FROM retention_sweep_log
WHERE entity_type = 'user_activity_log'
ORDER BY created_at DESC
LIMIT 3;
```

```sql
@lovable-please-run: narrow canary retention window
UPDATE retention_policies
SET retention_days = 1
WHERE id = '<POLICY_ID>';
```

```sql
@lovable-please-run: enable the canary policy for enforce run
UPDATE retention_policies
SET enabled = true
WHERE id = '<POLICY_ID>';
```

```sql
@lovable-please-run: confirm canary row deleted
SELECT id
FROM user_activity_log
WHERE id = '<CANARY_ROW_ID>';
```

### S-4 EU representative form

**Automated result:** Blocked

Not executed because it needs demo owner login and the Lovable jurisdiction toggle.

Required setup:

```sql
@lovable-please-run: flip demo team to EU jurisdiction for S-4/S-5
UPDATE teams
SET primary_jurisdiction = 'EU'
WHERE is_demo_account = true
  AND id = '<DEMO_TEAM_ID>';

SELECT id, name, primary_jurisdiction, is_demo_account
FROM teams
WHERE id = '<DEMO_TEAM_ID>';
```

### S-5 Transfer Addendum in DPA flow

**Automated result:** Blocked / specs scaffolded and skipped

Playwright specs exist in `tests/e2e/compliance/terms-reacceptance-gate.spec.ts`, but they intentionally skip unless all are present:
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`
- `E2E_EXPECT_JURISDICTION=EU` or `US`

Required Lovable query after EU acceptance:

```sql
@lovable-please-run: verify EU terms acceptance has all 5 docs
SELECT user_id, team_id, event_type, documents_accepted, accepted_at
FROM terms_acceptances
WHERE team_id = '<DEMO_TEAM_ID>'
  AND event_type = 'terms_update'
ORDER BY accepted_at DESC
LIMIT 1;
```

Required jurisdiction reset:

```sql
@lovable-please-run: reset demo team to US jurisdiction for S-5 US branch
UPDATE teams
SET primary_jurisdiction = 'US'
WHERE id = '<DEMO_TEAM_ID>';
```

---

## Test infrastructure changes made

Added:
- `@playwright/test` dev dependency.
- `package-lock.json` generated by npm.
- `playwright.config.ts`.
- `npm run test:e2e`.
- `tests/e2e/compliance/cookie-consent.spec.ts`.
- `tests/e2e/compliance/legal-pages.spec.ts`.
- `tests/e2e/compliance/terms-reacceptance-gate.spec.ts`.

Extended:
- `src/lib/legal/__tests__/versions.test.ts` with exact EU/UK/US doc-count assertions, `buildDocumentsPayload` shape coverage, and EU/UK consent-statement parity.

Added selector hooks:
- `CookieConsentBanner.tsx`
  - `cookie-consent-banner`
  - `cookie-customize`
  - `cookie-reject-all`
  - `cookie-accept-all`
  - `cookie-functional-toggle`
  - `cookie-analytics-toggle`
  - `cookie-marketing-toggle`
  - `cookie-save-preferences`
- `TermsReacceptanceGate.tsx`
  - `terms-reacceptance-gate`
  - `terms-gate-doc-terms`
  - `terms-gate-doc-privacy`
  - `terms-gate-doc-aup`
  - `terms-gate-doc-dpa`
  - `terms-gate-doc-transfer_addendum`
  - `terms-gate-checkbox`
  - `terms-gate-accept`

Updated `.gitignore`:
- `test-results`
- `playwright-report`

---

## Cleanup checklist

No destructive live data test was executed in this run, so there are no seeded rows from this environment to clean up. If Lovable executes S-2/S-3/S-4/S-5 later, run:

```sql
@lovable-please-run: delete throwaway DSR customers
DELETE FROM customers
WHERE email LIKE 'dsr-test+%@example.test';
```

```sql
@lovable-please-run: delete associated DSR requests
DELETE FROM data_subject_requests
WHERE subject_email LIKE 'dsr-test+%@example.test';
```

```sql
@lovable-please-run: delete throwaway retention policy
DELETE FROM retention_policies
WHERE id = '<POLICY_ID>';
```

```sql
@lovable-please-run: verify retention canary absent
SELECT id
FROM user_activity_log
WHERE action = 'codex_sweeper_test_canary';
```

```sql
@lovable-please-run: reset demo team jurisdiction
UPDATE teams
SET primary_jurisdiction = NULL
WHERE id = '<DEMO_TEAM_ID>'
  AND is_demo_account = true;
```

```sql
@lovable-please-run: clear EU representative test values
UPDATE teams
SET eu_representative_name = NULL,
    eu_representative_email = NULL,
    eu_representative_address = NULL
WHERE id = '<DEMO_TEAM_ID>';
```

---

## Ship recommendation

**Hold until:**

1. S-6 is fixed by making `/privacy-eu`, `/privacy-uae`, and `/transfer-addendum` faithful to the counsel-source HTML (or by intentionally updating counsel-source and audit docs to match the abbreviated React content).
2. Lovable executes the required S-2/S-3/S-4/S-5 setup and verification queries against a confirmed demo team.
3. The signed-in cookie ledger row is verified in `terms_acceptances`.

After those are complete, rerun:

```bash
npm test -- src/lib/legal/__tests__/versions.test.ts
npm run test:e2e -- --reporter=list
npm run typecheck
npm run build
```

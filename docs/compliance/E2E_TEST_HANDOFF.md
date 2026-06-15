# Phase 2 Compliance — E2E Test Handoff for Codex 5.5

---

## 0. Context

**Project:** Exotiq — multi-tenant luxury fleet/booking SaaS
**Repo:** `https://github.com/exotiq-ai/exotiq-spark-mvp-flow`
**Branch at handoff:** `main`
**Date:** June 15, 2026
**From:** Lovable (in-repo + Supabase MCP access)
**To:** Codex 5.5 (full repo read/write access, **no Supabase MCP**)
**Companion docs:** [`PHASE_2_AUDIT.md`](./PHASE_2_AUDIT.md) · [`NEXT_STEPS.md`](./NEXT_STEPS.md) · [`exotiq-international-compliance-roadmap.md`](./exotiq-international-compliance-roadmap.md)

### Phase 2 scope (shipped this week)

Phase 2 of the international compliance roadmap delivered five interconnected features: (1) **DSR hard-erasure** via the `dsr-erase` Supabase edge function with a two-step preview→execute flow and a legal-floor anonymization layer that preserves tax/AML rows; (2) **cookie consent banner v2** with Accept / Reject all / Customize controls, localStorage persistence keyed to the live document version, and an immutable ledger write to `terms_acceptances` for signed-in users; (3) **EU/UK Art. 27 representative** fields on `teams` with an admin form and dynamic rendering into `/privacy-eu`; (4) three new legal pages (`/privacy-eu`, `/privacy-uae`, `/transfer-addendum`) rendered from counsel-drafted HTML in `docs/compliance/legal-source/`; and (5) **Transfer Addendum wired into the DPA acceptance gate** — EU/UK teams now face a five-document re-acceptance modal (Terms, Privacy, AUP, DPA, Transfer Addendum) enforced by `TermsReacceptanceGate` before they can use the app. The static audit is in `PHASE_2_AUDIT.md`; your job is the **runtime validation** Lovable cannot do credibly from inside.

### Supabase MCP constraint — read this first

**You do not have Supabase MCP access.** You cannot run ad-hoc SQL directly. For any DB inspection you must use one of these three paths:

1. **App UI** — Admin → Terms Acceptances, Settings → Compliance → erasure panel, retention-sweep log.
2. **Temporary debug edge function** — you may author a short-lived `supabase/functions/debug-probe/index.ts` that runs a `SELECT` under service-role and returns JSON; invoke it once, paste the result into your report, then delete the function and commit the deletion.
3. **`@lovable-please-run:` tag** — anywhere in your report prefix the SQL with the tag and a one-sentence purpose. Lovable will execute via MCP and paste results back. Pre-written queries are provided in each scenario below; copy them verbatim.

Never run destructive operations as the live-preview user. Use `is_demo_account = true` teams or seed a throwaway team. Do not assume Lovable will run any query not explicitly tagged.

---

## 1. Pre-flight: jurisdiction setup (run these before S-4 and S-5)

Both S-4 and S-5 require a demo team with `primary_jurisdiction='EU'`. Bundle all jurisdiction writes into a single Lovable request so they are ready before you start.

```
@lovable-please-run: flip demo team to EU jurisdiction for S-4 and S-5
UPDATE teams
SET primary_jurisdiction = 'EU'
WHERE is_demo_account = true
  AND id = '<DEMO_TEAM_ID>';   -- replace with actual demo team id

-- Confirm
SELECT id, name, primary_jurisdiction, is_demo_account
FROM teams
WHERE is_demo_account = true;
```

For S-5 you will also need a second team (or the same team reset) with `primary_jurisdiction='US'`:

```
@lovable-please-run: reset demo team to US jurisdiction for S-5 step 5
UPDATE teams SET primary_jurisdiction = 'US'
WHERE id = '<DEMO_TEAM_ID>';
```

---

## 2. Test scenarios (priority order)

### S-1: Cookie consent banner

**Goal:** Banner appears on first visit; choices persist correctly; ledger row written for signed-in users.

1. Open the published URL (`https://app.exotiq.ai`) in a fresh incognito window (no prior `localStorage`).
2. Verify the cookie banner renders at the bottom of the screen.
3. **Reject all** → reload → banner does NOT re-appear.
   - Open DevTools → Application → Local Storage.
   - Key: `exotiq.cookie_consent.v2`
   - Expected value (JSON): `{ "version": "2026-06-14", "decided_at": "<iso>", "categories": { "necessary": true, "functional": false, "analytics": false, "marketing": false } }`
4. Clear localStorage. Sign in as owner of a demo team. Reload to trigger banner again.
5. **Customize → toggle analytics on → Save preferences.**
   - Verify `categories.analytics === true` in `exotiq.cookie_consent.v2`.
   - Verify a new row appears in **Admin → Terms Acceptances** with:
     - `event_type = "cookie_consent_v2"`
     - `acceptance_method = "banner"`
     - `documents_accepted = [{ "document_type": "cookies", "version": "2026-06-14", "categories": { "necessary": true, "functional": false, "analytics": true, "marketing": false } }]`
6. Reload — banner must NOT re-appear (version matches stored value).

**Code references:**
- `src/components/compliance/CookieConsentBanner.tsx` — localStorage key `exotiq.cookie_consent.v2` (line 26); `recordLedger` (line 56); `event_type: "cookie_consent_v2"` (line 63).
- Version is driven by `LEGAL_DOCS.cookies.version` in `src/lib/legal/versions.ts` (line 48) — currently `"2026-06-14"`.

**Pass criteria:** All six steps above. Banner absence after choice. Ledger row visible in Admin UI. No console errors.

---

### S-2: DSR preview → execute round-trip *(highest risk)*

**Goal:** The erasure edge function anonymizes PII correctly, preserves legal-floor rows, and writes an audit trail.

#### 2a. Seed

Create a throwaway customer in the demo team:
- Email: `dsr-test+<unix-timestamp>@example.test`
- Create one booking against that customer.
- Attach one document to the booking.
- Upload one inspection photo against that customer/booking.

#### 2b. Preview

In **Settings → Compliance → Hard erasure (Art. 17)**:
1. Confirm an erasure request row appears for the customer email you seeded (you must first create the DSR request — there is currently no self-service form; ask Lovable to insert the row):

```
@lovable-please-run: insert a DSR erasure request for the throwaway customer
INSERT INTO data_subject_requests
  (team_id, request_type, subject_email, status)
VALUES
  ('<DEMO_TEAM_ID>', 'erasure', 'dsr-test+<unix-timestamp>@example.test', 'open')
RETURNING id;
-- note the returned id as <DSR_ID>
```

2. In the Erasure panel, click **Preview** on the row. Capture the displayed row counts per table from the toast.
3. The `preview_counts` column should now be populated on the `data_subject_requests` row.

#### 2c. Execute

4. Click **Execute** → the `AlertDialog` appears showing total row count and table count.
5. Confirm by clicking **Erase**.

#### 2d. Verification queries

```
@lovable-please-run: verify customer PII nulled after erasure
SELECT id, email, phone, address_line1, address_city
FROM customers
WHERE email IS NULL
  AND id = '<CUSTOMER_ID>';
-- expect: email/phone/address_* are NULL, row still exists
```

```
@lovable-please-run: verify DSR row has executed_at and receipt_id
SELECT id, status, executed_at, receipt_id, preview_counts
FROM data_subject_requests
WHERE id = '<DSR_ID>';
-- expect: executed_at IS NOT NULL, receipt_id IS NOT NULL, status = 'completed'
```

```
@lovable-please-run: verify audit trail in data_access_log
SELECT id, action, actor_user_id, resource_type, created_at
FROM data_access_log
WHERE action = 'dsr_erasure_executed'
ORDER BY created_at DESC
LIMIT 5;
-- expect: at least one row with our DSR execution
```

```
@lovable-please-run: verify inspection_photos hard-deleted
SELECT COUNT(*) FROM inspection_photos
WHERE customer_id = '<CUSTOMER_ID>';
-- expect: 0
```

```
@lovable-please-run: verify payments rows preserved (PII nulled, not deleted)
SELECT id, customer_name, customer_email, amount, currency
FROM payments
WHERE customer_id = '<CUSTOMER_ID>';
-- expect: customer_name and customer_email are NULL; amount/currency retained
```

**Pass criteria:** Customer row anonymized (not deleted). Inspection photos deleted. Payments preserved with PII nulled. `executed_at` and `receipt_id` populated. `data_access_log` row with `action='dsr_erasure_executed'`.

---

### S-3: Retention sweeper dry-run → enforce

**Goal:** Confirm the sweeper correctly logs dry-run vs enforce, and only deletes rows scoped by the throwaway policy.

> **Safety rules for this scenario:** Do NOT use `entity_type` values `messages`, `team_messages`, or `notifications` — they are production-critical. Do NOT use `retention_days=0` against any real table (it would delete all rows). The protocol below uses a **synthetic row with a forced old `created_at`** and a narrow `retention_days` window so only that synthetic row is in scope.

#### 3a. Setup

```
@lovable-please-run: insert a synthetic user_activity_log row dated 2020
INSERT INTO user_activity_log (user_id, team_id, action, created_at)
VALUES (
  '<ANY_DEMO_USER_ID>',
  '<DEMO_TEAM_ID>',
  'codex_sweeper_test_canary',
  '2020-01-01 00:00:00+00'
)
RETURNING id;
-- note as <CANARY_ROW_ID>
```

```
@lovable-please-run: insert a throwaway retention policy (dry-run safe)
INSERT INTO retention_policies
  (entity_type, retention_days, enabled, action)
VALUES
  ('user_activity_log', 36500, false, 'delete_hard')
RETURNING id;
-- note as <POLICY_ID>
```

#### 3b. Phase 1 — dry-run, 100-year window (nothing in scope)

Trigger the `retention-sweeper` edge function (Lovable can invoke via MCP, or wait for cron). Then:

```
@lovable-please-run: check sweep log for phase 1 (expect would_delete=0)
SELECT entity_type, retention_days, dry_run, would_delete_count, deleted_count, error
FROM retention_sweep_log
WHERE entity_type = 'user_activity_log'
ORDER BY created_at DESC LIMIT 3;
-- expect: dry_run=true, would_delete_count=0, deleted_count=0
```

#### 3c. Phase 2 — dry-run, 1-day window (canary row in scope)

```
@lovable-please-run: narrow the window so the canary row is in scope
UPDATE retention_policies
SET retention_days = 1
WHERE id = '<POLICY_ID>';
```

Re-trigger sweeper. Then:

```
@lovable-please-run: check sweep log for phase 2 (expect would_delete=1, deleted=0)
SELECT entity_type, retention_days, dry_run, would_delete_count, deleted_count
FROM retention_sweep_log
WHERE entity_type = 'user_activity_log'
ORDER BY created_at DESC LIMIT 3;
-- expect: dry_run=true, would_delete_count=1 (or more if old rows exist), deleted_count=0
```

#### 3d. Phase 3 — enforce (canary row deleted)

```
@lovable-please-run: enable the policy for enforce run
UPDATE retention_policies SET enabled = true WHERE id = '<POLICY_ID>';
```

Re-trigger sweeper. Then:

```
@lovable-please-run: check sweep log for phase 3 (expect deleted_count >= 1)
SELECT entity_type, retention_days, dry_run, would_delete_count, deleted_count
FROM retention_sweep_log
WHERE entity_type = 'user_activity_log'
ORDER BY created_at DESC LIMIT 3;
-- expect: dry_run=false, deleted_count >= 1
```

Confirm the canary row is gone:

```
@lovable-please-run: confirm canary row deleted
SELECT id FROM user_activity_log WHERE id = '<CANARY_ROW_ID>';
-- expect: 0 rows
```

#### 3e. Cleanup

```
@lovable-please-run: remove throwaway retention policy
DELETE FROM retention_policies WHERE id = '<POLICY_ID>';
```

**Pass criteria:** Phase 1 — `would_delete_count=0`. Phase 2 — `dry_run=true`, `would_delete_count≥1`, `deleted_count=0`. Phase 3 — `dry_run=false`, `deleted_count≥1`, canary row absent. Log row written for each trigger.

---

### S-4: EU representative form → privacy notice render

1. Confirm `teams.primary_jurisdiction='EU'` is set on the demo team (done in pre-flight above).
2. Sign in as owner → **Settings → Compliance → Appointed representatives**.
3. Under "EU representative (GDPR Art. 27)", fill:
   - Name: `Test EU Rep`
   - Email: `eu-rep@example.test`
   - Postal address: `1 Test Street, Brussels, Belgium`
4. Click **Save EU**.
5. Open `/privacy-eu` in a new tab.
6. Locate the Article 27 representative block. Verify it renders the saved name, email, and address — not the placeholder `[representative pending]` or similar.
7. Check browser console for errors.

**Code references:**
- `src/components/compliance/EuRepresentativeForm.tsx` — saves to `teams.eu_representative_name/address/email` (lines 45–48).
- `src/pages/legal/PrivacyEU.tsx` — renders from team data.

**Pass criteria:** Form persists. Page renders dynamic fields. No `[to be inserted]` placeholders. No console errors.

---

### S-5: Transfer Addendum in DPA acceptance gate

1. Ensure demo team has `primary_jurisdiction='EU'` (pre-flight).
2. Sign in as owner of the EU demo team.
3. The `TermsReacceptanceGate` must show (since `transfer_addendum` version `"2026-06-14"` was added today and no historical acceptance for it exists). The modal must list **5 documents**:
   - Terms and Conditions
   - Privacy Policy
   - Acceptable Use Policy
   - Data Processing Agreement
   - International Data Transfer Addendum (SCCs / UK IDTA)
4. Close the tab without accepting → reload → gate must re-appear (non-dismissable).
5. Check the checkbox and click **Accept and continue**.
6. Verify the `terms_acceptances` row contains `documents_accepted` with all 5 doc types:

```
@lovable-please-run: verify EU terms acceptance has all 5 docs
SELECT user_id, team_id, event_type, documents_accepted, accepted_at
FROM terms_acceptances
WHERE team_id = '<DEMO_TEAM_ID>'
  AND event_type = 'terms_update'
ORDER BY accepted_at DESC LIMIT 1;
-- expect: documents_accepted array includes document_type values:
-- "terms", "privacy", "aup", "dpa", "transfer_addendum"
```

7. Ask Lovable to reset `primary_jurisdiction='US'` on the team (or use a second test team).
8. Sign out and sign back in as that team's owner.
9. The gate must appear showing only **3 documents**: Terms, Privacy, AUP.
10. Accept → verify `terms_acceptances` row contains only 3 doc types.

**Code references:**
- `src/lib/legal/versions.ts` — `requiredDocsForJurisdiction("EU")` returns `["terms","privacy","aup","dpa","transfer_addendum"]` (lines 77–87).
- `src/components/legal/TermsReacceptanceGate.tsx` — gate logic (lines 73–75); `record-terms-acceptance` edge function invocation (line 89).
- `CONSENT_STATEMENT_WITH_DPA` used for EU/UK acceptance rows (lines 92–93 of `versions.ts`).

**Pass criteria:** EU flow = 5 docs. US flow = 3 docs. No DPA/addendum leak into US. Gate re-appears on reload without acceptance.

---

### S-6: Legal page rendering — visual diff

1. Open each of `/privacy-eu`, `/privacy-uae`, `/transfer-addendum` in the browser.
2. Open the corresponding source HTML:
   - `/privacy-eu` → `docs/compliance/legal-source/privacy-notice-eu-uk.html`
   - `/privacy-uae` → `docs/compliance/legal-source/privacy-notice-uae.html`
   - `/transfer-addendum` → `docs/compliance/legal-source/international-transfer-addendum.html`
3. For each page: extract every `<h2>` and `<h3>` from the source HTML and confirm the heading text appears in the rendered React page.
4. Spot-check three complete paragraphs per page for fidelity — any deletion or rewording of substantive text is a **finding**, not a blocker.
5. Confirm no `[to be inserted]` or `[placeholder]` strings appear in the rendered output.

**Pass criteria:** No missing headings. No unreplaced placeholders. Minor formatting differences (whitespace, capitalization) acceptable if clause text is intact.

---

## 3. Test infrastructure

### Playwright — must be installed by Codex

Playwright is **not yet in the repository**. Codex should:

1. Install: `npm install -D @playwright/test`
2. Install browsers: `npx playwright install chromium`
3. Create `playwright.config.ts` at the repo root. Target the Vite dev server:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

4. Scaffold `tests/e2e/compliance/` directory with specs for S-1, S-5, and S-6 (the deterministic, UI-driven scenarios). S-2 and S-3 are too DB-coupled to automate without MCP — leave them as manual checklists in the report.
5. Add `data-testid` attributes where selectors are missing rather than relying on text matchers. List every testid you add in your report so Lovable can land them upstream.

Dev server start: `npm run dev` (Vite; listens on `http://localhost:5173` by default).

### Vitest — extend the existing file, do not overwrite

The file `src/lib/legal/__tests__/versions.test.ts` already exists and covers:
- `requiredDocsForJurisdiction` for US / null / undefined, EU, UK, UAE.
- `consentStatementForJurisdiction` for EU/UK and US.
- `LEGAL_DOCS.transfer_addendum` url and version.

**Extend it with (do not overwrite existing tests):**

```ts
// Count assertions — verifies the exact cardinality Codex tested in the browser
it("EU requires exactly 5 documents", () => {
  expect(requiredDocsForJurisdiction("EU")).toHaveLength(5);
});
it("UK requires exactly 5 documents", () => {
  expect(requiredDocsForJurisdiction("UK")).toHaveLength(5);
});
it("US requires exactly 3 documents", () => {
  expect(requiredDocsForJurisdiction("US")).toHaveLength(3);
});

// buildDocumentsPayload shape
import { buildDocumentsPayload } from "../versions";
it("buildDocumentsPayload produces correct shape for EU", () => {
  const payload = buildDocumentsPayload(requiredDocsForJurisdiction("EU"));
  expect(payload).toHaveLength(5);
  const types = payload.map((d) => d.document_type);
  expect(types).toContain("transfer_addendum");
  payload.forEach((d) => {
    expect(d.document_type).toBeTruthy();
    expect(d.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// UK consent statement parity (UK must be identical to EU)
it("UK and EU consent statements are identical", () => {
  expect(consentStatementForJurisdiction("UK")).toBe(
    consentStatementForJurisdiction("EU")
  );
});
```

### Demo teams

`teams.is_demo_account = true` teams are the safe seedbed — no production data risk. All throwaway customers, DSR requests, and retention-policy rows must be scoped to a demo team.

### Feature flag note

`featureFlags.complianceEuUk` is `false` in production (per audit finding F-5). Several Phase 2 panels (`ErasurePanel`, `EuRepresentativeForm`, `RetentionSweepsPanel`) are **not** gated behind the flag and are visible to non-EU teams. Note this in your report but do not treat it as a blocker for E2E testing.

---

## 4. What Codex should produce

1. **`docs/compliance/PHASE_2_E2E_REPORT.md`** containing:
   - Top-of-doc verdict: **ship / hold / fix-then-ship** with a one-sentence rationale.
   - Per-scenario pass/fail table with evidence (screenshots, toast text, JSON excerpts, SQL results pasted from Lovable).
   - A "Missing testids" sub-section listing every `data-testid` Codex added.
   - A "Supabase queries for Lovable" sub-section with every `@lovable-please-run` block (even if pasted inline in the scenario above — duplicate them here for easy scanning).
   - A "Findings" sub-section for any Phase 2 bugs discovered.
   - The cleanup checklist (see §5 below), marked completed or pending.

2. **Playwright specs** under `tests/e2e/compliance/` for S-1, S-5, and S-6. S-2 and S-3 remain manual.

3. **Extended Vitest cases** appended to `src/lib/legal/__tests__/versions.test.ts` (extend, do not overwrite).

4. **`playwright.config.ts`** and `@playwright/test` devDependency in `package.json`.

---

## 5. Cleanup checklist

At the end of the test run, complete these steps and mark them in the report:

| # | Action | SQL / Step |
|---|--------|-----------|
| C-1 | Delete throwaway customer | `DELETE FROM customers WHERE email LIKE 'dsr-test+%@example.test';` |
| C-2 | Delete associated DSR request | `DELETE FROM data_subject_requests WHERE subject_email LIKE 'dsr-test+%@example.test';` |
| C-3 | Delete throwaway retention policy | `DELETE FROM retention_policies WHERE id = '<POLICY_ID>';` |
| C-4 | Confirm canary `user_activity_log` row absent | `SELECT id FROM user_activity_log WHERE action = 'codex_sweeper_test_canary';` |
| C-5 | Reset demo team jurisdiction to neutral | `UPDATE teams SET primary_jurisdiction = NULL WHERE id = '<DEMO_TEAM_ID>' AND is_demo_account = true;` |
| C-6 | Clear EU rep test values | `UPDATE teams SET eu_representative_name=NULL, eu_representative_email=NULL, eu_representative_address=NULL WHERE id = '<DEMO_TEAM_ID>';` |

Tag each cleanup SQL with `@lovable-please-run:` in your report so Lovable can execute and confirm.

---

## 6. What Codex should NOT do

- Modify `dsr-erase/index.ts` deny-list, `retention-sweeper/index.ts` `DENY_LIST`, or default values in `src/lib/featureFlags.ts`. These are policy decisions. If you believe one is wrong, raise it as a finding.
- Run the retention sweeper against `entity_type` values `messages`, `team_messages`, or `notifications` — they are production-critical. Use the `user_activity_log` protocol in S-3.
- Use `retention_days=0` against any entity with a real table mapping (it selects all rows platform-wide regardless of team).
- Touch anything under `src/components/super-admin/`.
- Patch edge functions (`supabase/functions/`) — raise findings; don't fix.
- Make database schema changes (migrations). Any schema gap is a finding.

---

## 7. Quick reference

| Item | Value |
|------|-------|
| Published URL | `https://app.exotiq.ai` |
| Dev server | `npm run dev` → `http://localhost:5173` |
| Cookie LS key | `exotiq.cookie_consent.v2` |
| Cookie version | `"2026-06-14"` |
| Cookie event_type | `"cookie_consent_v2"` |
| EU required docs | `["terms","privacy","aup","dpa","transfer_addendum"]` (5) |
| US required docs | `["terms","privacy","aup"]` (3) |
| Vitest target | `src/lib/legal/__tests__/versions.test.ts` (extend) |
| Playwright target | `tests/e2e/compliance/` (create) |
| Demo team flag | `teams.is_demo_account = true` |
| How to request a query | Prefix SQL with `@lovable-please-run: <purpose>` |

Good hunting.

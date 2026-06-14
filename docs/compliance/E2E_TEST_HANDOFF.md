# Phase 2 Compliance — E2E Test Handoff for Codex 5.5

**Date:** June 14, 2026
**From:** Lovable (in-repo + Supabase MCP access)
**To:** Codex 5.5 (repo access, **no Supabase MCP**)
**Companion docs:** [`PHASE_2_AUDIT.md`](./PHASE_2_AUDIT.md), [`NEXT_STEPS.md`](./NEXT_STEPS.md), [`exotiq-international-compliance-roadmap.md`](./exotiq-international-compliance-roadmap.md)

---

## 0. Context

Exotiq is a multi-tenant fleet/booking SaaS on Vite + React + Lovable Cloud (Supabase). Phase 2 of the international compliance roadmap shipped this week:

- **DSR hard-erasure** via `dsr-erase` edge function with two-step preview→execute and legal-floor anonymization for tax/AML rows.
- **Cookie consent v2** banner + ledger writes to `terms_acceptances`.
- **EU/UK representative** fields on `teams` + admin form + render into `/privacy-eu`.
- **Legal pages** (`/privacy-eu`, `/privacy-uae`, `/transfer-addendum`) rendered from counsel HTML in `docs/compliance/legal-source/`.
- **Transfer Addendum wired into the DPA flow** — EU/UK teams' re-acceptance gate now requires both `dpa` and `transfer_addendum` in addition to terms/privacy/AUP.

Static audit findings are in `PHASE_2_AUDIT.md`. Your job is the **runtime** validation Lovable can't do credibly from inside.

### Hard constraints
- **You do not have Supabase MCP.** Do not write code that assumes you can run ad-hoc SQL. For any DB inspection: read via the app UI (Admin → Terms Acceptances, Settings → Compliance), inspect via a temporary debug edge function you author, or request Lovable run a specific `SELECT` and paste the result back.
- **Never run destructive ops as the live preview user.** Use `is_demo_account = true` teams or seed a throwaway team. If you need a query run, write it in your report and tag `@lovable-please-run`.
- **Do not modify** `dsr-erase` deny-list, `retention-sweeper` `DENY_LIST`, or default values of `featureFlags.complianceEuUk` — those are policy decisions. If you think one is wrong, raise it as a finding in your report.

---

## 1. Test scenarios (priority order)

### S-1: Cookie consent banner
1. Open the published URL in a fresh incognito window.
2. Verify the banner appears on first load.
3. **Reject all** → reload → banner does NOT re-appear. Check `localStorage.exotiq_cookie_consent` shows only `necessary: true`.
4. **Customize → toggle analytics on → save.** Verify localStorage reflects the choice.
5. Repeat #4 while signed in as an owner of a demo team. Verify a new row appears in Admin → Terms Acceptances with `documents_accepted` containing `{document_type: "cookies", version: "2026-06-14"}` and `event_type: "reacceptance"` or similar.
6. **Pass criteria:** all four above + banner does not reappear within 13 months (verify TTL in code, do not wait).

### S-2: DSR preview → execute round-trip *(highest risk)*
1. Seed: as owner of a demo team, create one throwaway customer with email `dsr-test+<timestamp>@example.test`. Create one booking, attach one document, upload one inspection photo against that customer.
2. Settings → Compliance → Erasure → enter the customer email → **Preview**. Capture row counts per table.
3. Confirm `data_subject_requests` row created with `mode='preview'` (request Lovable to verify).
4. Click **Execute** → two-step confirmation dialog appears → confirm.
5. Re-query (via UI or Lovable):
   - `customers` row: `email`, `phone`, `address_*` columns are NULL, row still exists (FK preservation).
   - `bookings` row: still exists; `notes`, `pickup_address`, `dropoff_address` NULL; `customer_id` retained.
   - `documents` rows: deleted.
   - `inspection_photos` rows: deleted; storage object purged (check via Lovable).
   - `payments` rows: preserved with `customer_name`, `customer_email` nulled.
6. Verify `data_subject_requests.executed_at` populated, `receipt_id` UUID present, audit row in `data_access_log` with `action='dsr_erasure_executed'`.
7. **Pass criteria:** anonymization (not deletion) on deny-listed tables; hard delete elsewhere; audit trail present.

### S-3: Retention sweeper dry-run → enforce
1. **Do not touch existing policies.** Ask Lovable to insert a throwaway policy:
   ```
   INSERT INTO retention_policies (entity_type, retention_days, enabled, action)
   VALUES ('notifications', 0, false, 'delete_hard');
   ```
2. Trigger `retention-sweeper` (Lovable can invoke it manually or wait for the daily cron).
3. Verify a `retention_sweep_log` row exists with `dry_run=true, would_delete_count > 0, deleted_count = 0`.
4. Ask Lovable to flip `enabled=true` on the throwaway policy. Re-trigger.
5. Verify a new `retention_sweep_log` row with `dry_run=false, deleted_count` matching the previous `would_delete_count` (within ±10 for new arrivals).
6. **Cleanup:** ask Lovable to delete the throwaway policy.
7. **Pass criteria:** dry-run never deletes; enforce mode deletes only the intended entity; log row written each time.

### S-4: EU representative form → privacy notice render
1. As owner of an EU-jurisdiction demo team (ask Lovable to set `teams.primary_jurisdiction='EU'` on the demo team), open Settings → Compliance → EU/UK Representative.
2. Fill all fields, save.
3. Open `/privacy-eu` in the same session. Verify the rendered Article 27 representative block contains the saved name/address/email (not `[representative pending]`).
4. **Pass criteria:** form persists, page renders dynamic fields, no console errors.

### S-5: Transfer Addendum in DPA flow *(delivered alongside this handoff)*
1. Demo team with `primary_jurisdiction='EU'`. Sign in as owner.
2. Re-acceptance gate must appear (since `transfer_addendum` was added today and no historical acceptance exists). Verify the modal lists **5 documents**: Terms, Privacy, AUP, DPA, Transfer Addendum.
3. Close the tab without accepting → reload → gate re-appears.
4. Accept. Verify `terms_acceptances` row contains `documents_accepted` with all 5 doc types.
5. Switch test team to `primary_jurisdiction='US'`. Sign in as that team's owner (or create a second test team). Confirm the gate shows only **3 documents** (Terms, Privacy, AUP).
6. **Pass criteria:** jurisdiction-aware required-doc list; no leak of DPA/addendum into US flow.

### S-6: Legal page rendering — visual diff
1. Open each of `/privacy-eu`, `/privacy-uae`, `/transfer-addendum`.
2. Open the corresponding HTML in `docs/compliance/legal-source/`.
3. For each page, verify every `<h2>` and `<h3>` from the source appears in the rendered React page. Spot-check three full paragraphs per page for fidelity.
4. **Pass criteria:** no missing clauses; minor formatting differences acceptable; any deletion/rewording of a clause is a finding.

---

## 2. Test infrastructure

- **Playwright** is already configured. Selectors use `data-testid` (see `mem://testing/playwright-selectors`). Add testids where missing rather than relying on text matchers — list them in your report so Lovable can land them.
- **Vitest** for unit tests. The Transfer Addendum wiring should get coverage at `src/lib/legal/__tests__/versions.test.ts` asserting `requiredDocsForJurisdiction("EU")` includes both `dpa` and `transfer_addendum`, while `requiredDocsForJurisdiction("US")` does not.
- **Demo teams** (`teams.is_demo_account = true`) are the safe seedbed.
- **Feature flag:** `featureFlags.complianceEuUk` is `false` in prod. Per audit finding F-5, several Phase 2 panels are NOT gated — note when running S-4 that the EU rep form is visible to non-EU teams (audit calls this out; do not treat as a blocker for E2E, but record in your report).

---

## 3. Deliverables

1. **`docs/compliance/PHASE_2_E2E_REPORT.md`** with:
   - Top-of-doc verdict: **ship / hold / fix-then-ship**.
   - Per-scenario pass/fail table with evidence (screenshots, log excerpts, SQL results).
   - A "Lovable to-do" section enumerating: missing testids, queries you need Lovable to run, any Phase 2 bugs you found.
2. **New Playwright specs** under `tests/e2e/compliance/` for S-1, S-5, and S-6 (the deterministic, UI-driven ones). S-2 and S-3 are too DB-coupled to automate cleanly without MCP — leave them as a manual checklist for now.
3. **Vitest** for the Transfer Addendum helper.

---

## 4. Out of scope (don't touch)

- UAE Phase 2 features (lawful-basis profiles, DIFC AI disclosure). Roadmap item, not yet built.
- Region-split / EU-local hosting (deferred by product).
- Anything in `src/components/super-admin/`.
- Edge function changes (raise findings, don't patch).

---

## 5. Quick reference

- **Preview URL:** ask Lovable; it rotates per session.
- **Published URL:** `https://app.exotiq.ai`.
- **Demo team seed:** ask Lovable — they can create a fresh demo team with one command.
- **How to ask Lovable to run a query:** in your report, prefix the SQL with `@lovable-please-run:` and a one-sentence purpose.

Good hunting.

# Plan: Phase 2 Compliance Close-Out

**Status (June 14, 2026):** ✅ Items 1 & 2 complete. ➡️ Item 3 handed off to Codex 5.5.

- Item 1 (Transfer Addendum → DPA flow): shipped. `transfer_addendum` doc type added, jurisdiction-aware required-doc helper landed, migration registered v2026-06-14, 7 vitest cases green.
- Item 2 (static audit): see `docs/compliance/PHASE_2_AUDIT.md` — verdict ship-with-fixes, three medium findings (F-1 partner_payouts deny-list, F-2 retention runbook, F-5 panel jurisdiction-gating).
- Item 3 (E2E handoff): see `docs/compliance/E2E_TEST_HANDOFF.md` — Codex 5.5 owns runtime validation, produces `PHASE_2_E2E_REPORT.md`.

Phase 2 is closed pending (a) Codex E2E sign-off and (b) Lovable next-pass on F-1 and F-5.

---

## Original plan (for reference)

Three deliverables. I execute 1 and 2; Codex 5.5 picks up 3.

---

## 1. Wire Transfer Addendum into DPA acceptance flow

**Goal:** EU/UK teams cannot accept the DPA without simultaneously accepting the International Data Transfer Addendum (SCCs / UK IDTA). Non-EU/UK teams are unaffected.

**Files touched:**
- `src/lib/legal/versions.ts` — add `"transfer_addendum"` to `LegalDocType`, register in `LEGAL_DOCS` with url `/transfer-addendum`, version `2026-06-14`. Export a helper `requiredDocsForJurisdiction(jurisdiction)` returning `REQUIRED_AT_SIGNUP` plus `["dpa","transfer_addendum"]` when jurisdiction is `EU` or `UK`.
- `src/lib/legal/changelog.ts` — add changelog entry so the re-acceptance gate shows "What's changed" copy.
- `src/components/legal/TermsReacceptanceGate.tsx` — replace the hard-coded `REQUIRED_AT_SIGNUP` with `requiredDocsForJurisdiction(currentTeam.primary_jurisdiction)`. Existing acceptance-ledger logic already handles arbitrary doc lists — no other change needed.
- `src/App.tsx` — confirm `/transfer-addendum` route already exists (it does; rendered last turn).
- `supabase/migrations/<new>.sql` — insert a row into `legal_document_versions` for `transfer_addendum@2026-06-14` so the edge function `record-terms-acceptance` accepts it.

**Safety posture:**
- Gated on `currentTeam.primary_jurisdiction` — US/UAE/unset teams see zero behaviour change.
- Re-uses the existing append-only `terms_acceptances` ledger; no new tables.
- Owner/admin only can accept on behalf of team (existing gate logic).

**Verification I'll run:**
- Read `record-terms-acceptance` edge function to confirm it doesn't reject unknown doc types.
- Vitest: extend existing legal-versions test (if present) or add one asserting `requiredDocsForJurisdiction("EU")` includes the addendum.
- Manual: open preview as an EU team, confirm the modal lists 5 docs; switch to a US team, confirm 3.

---

## 2. Static Phase 2 audit

**Output:** `docs/compliance/PHASE_2_AUDIT.md` — a findings doc that maps every Phase 2 deliverable to evidence in the codebase and flags anything ambiguous.

**Sections:**
1. **RLS & GRANT coverage** — verify `data_subject_requests`, `retention_sweep_log`, `terms_acceptances`, `teams` (new representative columns) have correct RLS + grants. Run `supabase--linter` and triage findings.
2. **Edge function auth posture** — `dsr-erase`, `dsr-export`, `retention-sweeper`: confirm JWT validation, owner/admin role check, service-role usage only inside the function.
3. **DSR erasure deny-list correctness** — diff `dsr-erase` deny-list against `data_processing_inventory.legal_basis` rows tagged as legal-floor (tax/AML/payments). Flag any inventory entry that *should* be on the deny-list but isn't.
4. **Retention sweeper safety** — confirm `DENY_LIST` covers every append-only ledger; confirm `enabled=false` is the default on all current `retention_policies` rows.
5. **Cookie banner ledger writes** — trace `CookieConsentBanner.tsx` → `terms_acceptances` insert path; confirm anonymous (logged-out) consent is stored in localStorage only, never attempted server-side.
6. **Feature-flag gating** — grep for `complianceEuUk` across new components; confirm no Phase 2 surface is reachable when the flag is off.
7. **Legal page rendering** — confirm `/privacy-eu`, `/privacy-uae`, `/transfer-addendum` render the counsel HTML faithfully; flag any spot where the React page diverges from `legal-source/*.html` content.
8. **Open risks** — enumerated, ranked by severity.

**Tools used:** `code--view`, `rg`, `supabase--linter`, `supabase--read_query`. No code changes from this step — pure audit doc.

---

## 3. Codex 5.5 E2E handoff

**Output:** `docs/compliance/E2E_TEST_HANDOFF.md` — scoped runtime test brief for Codex.

**Contents:**

### Context block
- Project name, repo location, branch, current date.
- One-paragraph summary of Phase 2 scope (DSR erasure, cookie consent v2, EU/UK reps, legal pages, transfer addendum DPA wiring).
- Explicit note: **Codex does not have Supabase MCP access.** All DB inspection must be via the app UI, a temporary debug edge function Codex authors, or by reading migration SQL. Codex should request Lovable to run any direct DB query.

### Test surface (in priority order)
1. **Cookie consent banner**
   - Fresh incognito → banner appears on `/`.
   - "Reject all" → localStorage shows only `necessary: true`; no `terms_acceptances` row.
   - "Customize" → toggle analytics on, save → localStorage reflects; signed-in user gets a new `terms_acceptances` row with `documents_accepted: [{document_type: "cookies", ...}]`.
   - Pass criteria: banner does not re-appear after a choice; ledger row visible in Admin → Terms Acceptances.

2. **DSR preview → execute round-trip**
   - Seed: create a throwaway customer in the demo team with one booking, one document, one inspection photo.
   - Owner runs `ErasurePanel` preview → counts match seeded rows.
   - Execute → confirms two-step dialog → re-query: `customers.email` is null, `bookings` row still present but PII-stripped, `inspection_photos` rows deleted, `payments` rows preserved with PII nulled.
   - Pass criteria: `data_subject_requests.executed_at` set, `receipt_id` populated, audit row in `data_access_log`.

3. **Retention sweeper dry-run vs enforce**
   - Codex should NOT flip a production policy. Instead: create a throwaway `retention_policies` row for `notifications` with `retention_days=0, enabled=false` → call sweeper → confirm `retention_sweep_log` row with `dry_run=true, would_delete_count>0, deleted_count=0`.
   - Then `enabled=true` → re-run → confirm rows actually deleted, `deleted_count` matches.
   - Cleanup: remove the throwaway policy.

4. **EU representative form**
   - As owner of an EU team: fill `EuRepresentativeForm`, save → verify `/privacy-eu` renders the saved name/address/email inline (no `[to be inserted]`).

5. **Transfer Addendum in DPA flow** (delivered by me in step 1)
   - Set test team `primary_jurisdiction='EU'` → log in as owner → re-acceptance gate shows 5 docs including Transfer Addendum.
   - Decline-then-reload: gate re-appears.
   - Accept → `terms_acceptances` row contains both `dpa` and `transfer_addendum`.
   - Repeat with `primary_jurisdiction='US'` → only 3 docs shown.

6. **Legal page rendering**
   - Visual diff `/privacy-eu`, `/privacy-uae`, `/transfer-addendum` against `docs/compliance/legal-source/*.html`. Flag any missing clauses.

### Test infrastructure notes
- Playwright is set up; selectors use `data-testid` per `mem://testing/playwright-selectors`. Codex should add testids where missing rather than rely on text matchers.
- Vitest for unit-level (versions helper, deny-list helper).
- Demo team toggle (`teams.is_demo_account`) is the safe seedbed — no production data risk.

### What Codex should produce
- A test report at `docs/compliance/PHASE_2_E2E_REPORT.md` with pass/fail per scenario, screenshots/log excerpts, and a top-of-doc verdict (ship / hold / fix-then-ship).
- New Playwright specs under `tests/e2e/compliance/` for any scenario worth automating.
- A short list of Supabase queries Codex needs Lovable to run (Codex writes them; Lovable executes via MCP and pastes results back).

### What Codex should NOT do
- Touch `dsr-erase` deny-list, `retention-sweeper` `DENY_LIST`, or feature-flag defaults — those are policy decisions, not test artifacts.
- Run the sweeper against any policy whose `entity_type` is in the production-critical set (`messages`, `team_messages`, `notifications` if older than ~30 days). Use a throwaway policy with a fresh `entity_type` or restrict by a temporary timestamp.

---

## Order of execution

1. Write/migrate Transfer Addendum wiring (item 1).
2. Run audit, produce `PHASE_2_AUDIT.md` (item 2).
3. Write `E2E_TEST_HANDOFF.md` (item 3).
4. Update `.lovable/plan.md` to mark Phase 2 closed pending E2E sign-off.

Estimated work: ~45 minutes of tool calls. One migration (legal_document_versions insert) requires your approval.

# International Compliance — Gap Analysis vs. Claude's Plan & Next Steps

**Prepared:** June 14, 2026
**Reviewer:** Lovable (with full codebase visibility)
**Source plans:** [`exotiq-international-compliance-prompt.md`](./exotiq-international-compliance-prompt.md), [`exotiq-international-compliance-roadmap.md`](./exotiq-international-compliance-roadmap.md)
**Counsel-drafted source legal text (reference):** [`legal-source/`](./legal-source/)

---

## How to read this

Claude's plan is written from general GDPR/PDPL knowledge without seeing the repo. The strategy is sound; some items it lists as TODO are already shipped, and a few real gaps Claude can't see from outside are called out below in §3.

RAG key: 🟢 done / 🟡 partial / 🔴 not started.

---

## 1. Coverage map — Phase 1 (EU/UK)

| Claude's item (Part A) | Status | Where it lives in our code |
|---|---|---|
| **A1. Residency / region architecture** | 🟡 Deferred per your call — contractual path now, region-split optional later. `teams.data_region` column + `region_partitionable` flag exist in inventory so we can fork without a re-migration. | `supabase/migrations/2026061420…`, `src/lib/compliance/dataInventory.ts` |
| **A2. AI data-flow minimization (highest priority)** | 🟢 Shared `withTransferGuard` (PII redaction + never-transfer keys) and `logTransfer` (audit-only) wired into 9 edge functions: `ai-pricing`, `ai-demand-forecast`, `ai-event-intelligence`, `fleet-copilot-chat`, `generate-hero-image`, `generate-report`, `identify-vehicle`, `parse-expense-receipt`, `weekly-intelligence-digest`. Auto-strict for EU teams. | `supabase/functions/_shared/transferGuard.ts` + 5 Deno tests |
| **A3. Consent ledger (versioned, IP-stamped)** | 🟢 Already shipped pre-Phase-1: `terms_acceptances` table is append-only, versioned, captures IP + per-document version. `LEGAL_DOCS` versions registry exists. | `terms_acceptances`, `src/lib/legal/versions.ts`, `src/lib/legal/changelog.ts` |
| Granular cookie / SMS / marketing categories | 🟡 SMS opt-in + cookie page exist; **no granular cookie reject-all UI** yet. | `src/pages/legal/Cookies.tsx`, `src/pages/legal/Sms.tsx` |
| **A4. DSR — export / portability** | 🟡 `data_subject_requests` table + `deletion_requests` table exist; we have UI scaffolding ("DSR tooling depth: both") but the **end-to-end export job spanning all tables + Storage is not implemented**. | `data_subject_requests`, `deletion_requests` |
| **A4. DSR — hard erasure across tables/Storage/processors** | 🔴 Not built. `purged_vehicle_fingerprints` exists for one narrow case. | — |
| **A4. Correction paths** | 🟢 Self-service via profile/customer edit; admin override via super-admin. | existing CRUD |
| **A4. Automated retention enforcement jobs** | 🔴 `retention_policies` table exists, **no scheduled job actually deletes**. Retention is policy text only today. | `retention_policies` |
| **A5. Encryption at-rest/in-transit** | 🟢 Lovable Cloud managed (AES-256, TLS 1.2+). |  |
| **A5. RLS audit** | 🟢 Completed in audit cycle Jan 2026; `SUPABASE_RLS_CROSS_CHECK_SUMMARY.md`, plus `src/lib/security/__tests__/rlsMigration.test.ts`. | repo root |
| **A5. Service-role key never client-side** | 🟢 Verified — only used in edge functions. | |
| **A5. Audit log for personal-data access** | 🟡 `data_access_log`, `user_activity_log`, `role_audit_log`, `vehicle_change_log` all exist — coverage is **partial**: writes are logged; **reads of renter PII are not consistently logged**. | tables above |
| **A5. Backup posture / restore drill cadence** | 🔴 Managed by Lovable Cloud; **no documented restore-test cadence**. | — |
| **A5. Breach detection → 72h notification path** | 🔴 No runbook, no alerting wiring. | — |
| **A6. Data inventory (machine-readable)** | 🟢 `src/lib/compliance/dataInventory.ts` + mirror in `data_processing_inventory`. | |
| **A6. Sub-processor registry** | 🟢 `src/lib/compliance/subProcessors.ts` + mirror in `sub_processors`. | |
| **A6. ROPA generator** | 🔴 We have the inputs; no export button → CSV/JSON yet. | — |
| Onboarding jurisdiction picker + soft-warning banner | 🟢 `teams.primary_jurisdiction`, `ComplianceBanner`, Settings → Legal section. | `src/components/compliance/ComplianceBanner.tsx`, `src/components/dashboard/settings/ComplianceSection.tsx` |
| EU/UK representative appointment surfacing | 🔴 Privacy notice references it as `[to be inserted]`; no admin field to populate. | — |

**Phase 1 score:** the load-bearing items (A2 AI guard, A3 consent ledger, A6 inventory, jurisdiction capture) are 🟢. The biggest remaining 🔴s are **retention enforcement, DSR export/erasure executors, and read-side audit logging.**

---

## 2. Phase 2 (UAE) — not started

| Item | Status |
|---|---|
| Jurisdiction picker captures `mainland / DIFC / ADGM` | 🟡 Column accepts free text; needs enum + onboarding UI |
| Consent-default lawful basis swap for UAE accounts | 🔴 — needs a `lawful_basis_profile` per team and per-feature toggle |
| UAE privacy notice page | 🔴 — counsel-drafted text now in `legal-source/privacy-notice-uae.html`, not yet rendered as a React page |
| DPO contact surfacing | 🔴 |
| DIFC AI rules layer (auto-decision disclosure, opt-out) | 🔴 |

---

## 3. Where Claude's plan is **weaker than reality** (because it can't see the repo)

These are items the brief understates or misses; flagging so you don't double-build:

1. **Consent ledger is not greenfield.** Claude lists it as Phase 1 build work. We already have `terms_acceptances` with version, IP, document hash, and per-document arrays. What's actually missing is the **withdrawal-event** column and a **UAE-style granular consent matrix**, not a new table.
2. **Audit logs already exist — but with read-side blind spots.** Claude says "implement audit log." We have four. The gap is narrower: log SELECT-side access to renter PII (currently only writes are logged). A simple Postgres `SECURITY DEFINER` wrapper on a few read paths closes most of it.
3. **Stripe/Twilio/Resend/GHL aren't in our active sub-processor list.** Claude assumes our processor list mirrors integrations. Reality: `subProcessors.ts` lists Lovable Cloud, Stripe, Google, OpenAI, Anthropic, ElevenLabs, GCal, MotorIQ. **Resend, Twilio, GoHighLevel, telematics providers** are referenced in Claude's brief but not in our registry — either they're not yet integrated or the registry is stale. Needs a 30-minute reconciliation pass.
4. **AI transfer guard is more granular than Claude's "pseudonymization layer."** We have two modes: `withTransferGuard` (full redaction + audit) for PII-bearing payloads, and `logTransfer` (audit-only) for already-pseudonymized payloads like vehicle metadata. Claude's plan would have us redact everything, which would break the AI pricing model's accuracy. Our split is correct — document this distinction for the DPIA.
5. **`drivers_license_number` is feature-flagged off.** Claude's draft EU/UK privacy notice mentions "driver license and identification data that operators enter for verification." Our actual code disables that field (`featureFlags.driversLicenseNumberField`) and routes verification through Stripe Identity. **The notice text overstates what we collect** — counsel should narrow it before publication.
6. **Region split is not free.** Claude lists "separate EU region project" as a tradeoff. Realistic cost on our stack: full auth/realtime fork, separate Stripe Connect platform account per region, separate Lovable AI Gateway routing. Multi-week effort, not a config flip. Worth deferring exactly as you decided.
7. **DSR export is harder than "one function."** We have 70+ tables. A naive dump leaks cross-tenant data via FKs unless we walk only rows where `customer_id = X` AND `team_id = current_team`. The export function needs a schema-walker, not a hand-written union — flag for design before build.

---

## 4. Recommended next-step sequence

Ranked by compliance risk reduction per dev hour:

1. **Retention enforcement job** (🔴 → 🟢). One scheduled edge function reading `retention_policies`, soft-deleting expired rows. Without it, every retention period in the privacy notice is a lie.
2. **DSR export edge function** (🔴 → 🟢). Schema-walker that emits per-data-subject JSON ZIP. Required by GDPR Art. 15/20.
3. **DSR hard-erasure executor** (🔴 → 🟢). Consumes `deletion_requests` rows, cascades across tables and Storage, preserves legal-retention exceptions, writes proof to `data_access_log`.
4. **Read-side audit logging** for renter PII (`customers`, `documents`, `inspection_photos`, `rari_messages`). Narrow Postgres wrapper, ~1 day.
5. **Cookie consent v2** with reject-all and category toggles. Reuse `terms_acceptances` for the ledger; new UI only.
6. **Sub-processor registry reconciliation** (Resend/Twilio/GHL/telematics audit).
7. **ROPA export button** in Settings → Legal (CSV/JSON of `data_processing_inventory` joined with `sub_processors`).
8. **EU/UK representative admin field** + render into the privacy notice page once appointed.
9. **Render counsel-drafted privacy notices** (`legal-source/privacy-notice-eu-uk.html`, `privacy-notice-uae.html`) as React pages under `src/pages/legal/`, versioned via `LEGAL_DOCS`.
10. **Render International Data Transfer Addendum** as a page + add to DPA acceptance flow for EU/UK teams.
11. **UAE Phase 2 kickoff** — jurisdiction enum, lawful-basis profile per team, UAE notice page, DIFC AI disclosure layer.

Items 1–4 are the ones that turn the paperwork into something a regulator would actually credit.

---

## 5. Files added to the repo this turn

- `docs/compliance/exotiq-international-compliance-prompt.md` (Claude's Part A/B brief)
- `docs/compliance/exotiq-international-compliance-roadmap.md` (Claude's strategy + sequence)
- `docs/compliance/legal-source/international-transfer-addendum.html` (counsel draft)
- `docs/compliance/legal-source/privacy-notice-eu-uk.html` (counsel draft)
- `docs/compliance/legal-source/privacy-notice-uae.html` (counsel draft)
- `docs/compliance/legal-source/legal-styles.css` (shared legal stylesheet)
- `docs/compliance/NEXT_STEPS.md` (this file)

Nothing in `legal-source/` is wired into the app yet — it's reference text awaiting (a) attorney sign-off, (b) the narrowing edits called out in §3 item 5, and (c) conversion to React pages per step 9 above.

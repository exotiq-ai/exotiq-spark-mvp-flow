# Phase 1 — EU/UK Compliance Foundation (Buildable Scope)

Scope locked from your answers: EU/UK dev foundation only, single-region with contractual transfer path (architected for a future EU project split), soft-gated onboarding, DSR tooling for both the authenticated user and operators acting on behalf of their renters. Legal instruments (SCC annexes, IDTA, TIA, DPIA, privacy notices) are listed but flagged for attorney drafting — this plan does not generate them.

## 1. Data inventory & sub-processor registry

- New `data_processing_inventory` table seeded from a code-side manifest (`src/lib/compliance/dataInventory.ts`) listing every personal-data category, the table/column it lives in, retention period, lawful basis, and which sub-processor(s) receive it (Stripe, MotorIQ, Gemini, OpenAI, Anthropic, ElevenLabs, Google Calendar, Twilio/SMS provider).
- New `sub_processors` table (name, purpose, region, transfer mechanism, DPA URL, status). Surfaced read-only in Settings → Legal → "Sub-processors" and in the DPA page so it stays in sync.
- Owner-only "Export ROPA" action in Settings → Legal renders the inventory + active sub-processors as a CSV/JSON the operator's counsel can hand to a regulator.

## 2. Cross-border AI transfer controls (the highest-risk item)

- Central `src/lib/ai/transferGuard.ts` wraps every outbound AI call (MotorIQ, Rari, Gemini, OpenAI, Anthropic). Responsibilities:
  - Strip/redact direct identifiers (renter name, email, phone, license #, address, DOB) before the request leaves Lovable Cloud. Replace with stable pseudonyms scoped to the request.
  - Block fields tagged "never_transfer" in the data inventory.
  - Log every transfer to a new `ai_transfer_log` table: caller, model, sub-processor region, payload field hashes, team_id, timestamp. Used as evidence for TIA.
- Refactor existing AI edge functions (`ai-pricing`, `rari-*`, `generate-hero-image`, `photo-vision-*`, demand-forecast) to route through the guard. No payload changes for non-EU/UK teams beyond the redaction; EU/UK teams get a stricter allowlist.
- Team setting `ai_data_minimization_level` (standard / strict). EU/UK auto-strict.

## 3. Region-portable data layer (defer EU project, don't paint into a corner)

- Add `data_region` column to `teams` (`us` default, `eu` reserved). All AI guard logic, sub-processor display, and DSR exports key off this field.
- Tag every personal-data table in the inventory manifest with a `region_partitionable` flag so a future migration to an EU project is a data move, not a schema rewrite.
- No infrastructure split this phase — single US region with contractual mechanisms (SCCs/IDTA, drafted by counsel).

## 4. Jurisdiction & soft-gating

- Extend onboarding (`Welcome` / Business profile step) with a "Primary operating jurisdiction" picker: US / EU member state / UK / Other. Stored on `teams.primary_jurisdiction` + `teams.data_region`.
- Soft gate: if jurisdiction = EU/UK and (a) DPA not executed or (b) privacy notice acknowledgement missing, show persistent dashboard banner + Settings → Legal task list. Never blocks usage.
- DPA execution (already built in Phase 8) auto-required for EU/UK teams; banner links straight to it.

## 5. Consent ledger extensions

- Extend `terms_acceptances` event types: `privacy_notice_eu`, `privacy_notice_uk`, `marketing_opt_in`, `marketing_opt_out`, `cookies_consent` (reserved — no banner unless analytics/marketing cookies are ever added).
- New `data_subject_requests` table (request type, subject, requester, team_id, status, fulfilled_at, evidence_url, immutability trigger like `terms_acceptances`).

## 6. DSR tooling — user-facing (extends existing Legal section)

- Self-serve **Export my data** (JSON, signed download) — pulls profile, acceptances, bookings as renter, messages, notifications, AI transfer log entries about the user.
- Self-serve **Request erasure** — opens a `data_subject_requests` row of type `erasure`, ties into the existing `deletion_requests` cascade pipeline, surfaces status + ETA.
- Self-serve **Request correction** — light form that routes to the operator (if user is a renter of one) or to Exotiq support.

## 7. DSR tooling — operator-facing (new)

- Settings → Legal → "Renter DSRs" tab, visible to owner/admin only.
- Search a renter (by email/phone/customer record), then for that subject:
  - **Export** — bundles their `customers` row, bookings, payments (redacted to last4), messages, inspection photos metadata, AI transfer log entries.
  - **Erase** — soft-delete + scheduled hard purge after legal retention window (configurable, default 30 days), with explicit warnings about bookings that have unresolved financial/legal obligations (those rows are preserved with the identifiers redacted, the records themselves retained).
  - **Correct** — opens an edit drawer of the customer record, logged.
- Every action writes a row to `data_subject_requests` + `user_activity_log`. Immutable.

## 8. Retention enforcement

- New `retention_policies` table (entity_type, retention_days, basis, last_run_at).
- Scheduled edge function `enforce-retention` (cron daily): purges/anonymizes per policy. Examples seeded: AI transfer logs 13 months, inactive customer PII 7 years after last booking (insurance/tax floor), messages 3 years, raw inspection photos 2 years (metadata retained).
- Dry-run mode + admin preview in Settings → Legal before first real run.

## 9. RLS & audit hardening sweep

- Audit script (`scripts/compliance/rls-coverage.ts`) cross-references the data inventory against `pg_policies` — fails CI if a PII-tagged table is missing per-team or per-user RLS.
- Add `data_access_log` table fed by triggers on the highest-sensitivity tables (`customers`, `documents`, `payments`, `damage_claims`) capturing who read what — required for the GDPR "Article 30 plus" posture EU regulators expect from operators handling driver license + payment data.

## 10. Legal-doc placeholders wired to the existing acceptance system (NO drafting)

- Add `legal_document_versions` rows for `gdpr_privacy_notice`, `uk_privacy_notice_addendum`, `tia`, `dpia_ai`, `scc_module_two`, `idta_uk` — all with `status='attorney_review_required'` and stub bodies that render an "Attorney review required" notice in the UI. They become part of the gating list once counsel publishes real content.
- Sub-processor registry (Section 1) auto-renders into the DPA page so it stays accurate without re-papering.

## What this plan explicitly does NOT do

- Does not draft SCCs, IDTA, TIA, DPIA, or privacy notice content. Those are attorney deliverables; we ship the rails.
- Does not stand up an EU-hosted project. Architecture stays portable.
- Does not touch UAE (Phase 2).
- Does not hard-block onboarding.

## Technical details

- New tables: `data_processing_inventory`, `sub_processors`, `ai_transfer_log`, `data_subject_requests`, `retention_policies`, `data_access_log`. All team-scoped RLS; immutability triggers on `data_subject_requests` and `ai_transfer_log` (UPDATE/DELETE blocked, same pattern as `terms_acceptances`).
- New edge functions: `ai-transfer-guard` (shared lib + middleware), `dsr-export` (user + operator modes, JWT-validated, Zod-validated), `dsr-erase`, `enforce-retention` (cron).
- New code modules: `src/lib/compliance/dataInventory.ts`, `src/lib/ai/transferGuard.ts`, `src/lib/compliance/dsr.ts`, `src/components/dashboard/settings/RenterDsrTab.tsx`, jurisdiction picker extension to `Welcome.tsx` and `BusinessProfileStep`.
- Feature flag: `complianceEuUk` in `src/lib/featureFlags.ts` — ships dark, enabled once attorney-reviewed legal docs are published.
- Tests: vitest coverage for `transferGuard` redaction, DSR export shape, retention dry-run, RLS coverage script; Deno tests for the three new edge functions.

## Order of implementation (one PR per group)

1. Inventory + sub-processor registry + feature flag scaffolding.
2. AI transfer guard + log + refactor existing AI functions.
3. Jurisdiction picker + soft-gating banner + region column.
4. Consent ledger extensions + legal-doc placeholders.
5. User-facing DSR export/erase/correct.
6. Operator-facing renter DSR console.
7. Retention policies + cron + dry-run UI.
8. RLS coverage script in CI + data_access_log triggers.

Each group is independently shippable behind `complianceEuUk`.

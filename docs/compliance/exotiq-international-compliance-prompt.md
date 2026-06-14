# Exotiq Command Center — International Compliance Infrastructure Audit & Build Prompt

**For:** Lovable / Cursor (Command Center frontend + Supabase infrastructure)
**Scope:** Technical and product readiness for GDPR (EU), UK GDPR, and UAE PDPL / DIFC / ADGM
**Owner:** Gregory Ringler
**Status:** Planning input. Do not execute schema changes without confirmation.

---

## How to use this prompt

This document has two halves. **Read both before acting.**

- **Part A (Engineering scope):** This is your work. Audit the current state against each item, report a gap analysis, then propose an implementation plan. Do not write or modify legal/policy text. Do not invent compliance claims.
- **Part B (Out of scope for you):** Legal and operational items handled outside Lovable/Cursor. Listed so you understand the full picture and do not duplicate or fabricate this work. If a task in Part A depends on a Part B input, flag it and stop rather than guessing.

**Sequencing:** Build for EU/UK first (they share most requirements). Treat UAE as a second pass. Where a single mechanism covers all three, note it. Where UAE diverges, isolate it.

**Prime directive:** When you hit anything you cannot verify from the actual codebase, say so. A flagged gap is worth more than a confident guess. Accuracy over completeness.

---

## Part A — Engineering & product scope (audit, then plan)

For each section: (1) report current state from the actual codebase and Supabase config, (2) identify the gap, (3) propose the change. Do not implement until the plan is approved.

### A1. Data residency and region architecture

The core question to answer first: **can the Command Center keep EU/UK resident data physically in an EU region while serving US customers from US infrastructure, and how is that segregation enforced?**

- Confirm the current Supabase project region(s). Supabase runs on AWS; the region chosen at project creation determines where primary data and native backups live (e.g. `eu-central-1` Frankfurt, `eu-west-1` Ireland).
- Determine the residency strategy and report the trade-offs of each:
  - **Single US region** (current, presumed): simplest, but EU/UK/UAE personal data transfers to the US and must be covered by transfer mechanisms (Part B).
  - **Separate EU region project** for EU/UK customers: strongest residency story, but introduces multi-project routing, auth, and data-sync complexity. Assess feasibility against the current single-project architecture.
  - **Hybrid:** US primary with EU-resident storage for specific high-sensitivity data classes (e.g. renter identity documents in Vault).
- Region selection solves residency, not sovereignty: a US parent company (Supabase is a Delaware C-corp) can still face cross-border legal exposure even when data sits in `eu-central-1`. Note this in the assessment so it is not misrepresented as fully solved.
- Map every place personal data physically flows: Supabase (DB, Storage), Stripe, Resend, ElevenLabs, Google Gemini, OpenAI, Anthropic, GoHighLevel, Twilio, telematics providers. For each, identify the processing region and whether an EU data residency option exists.

### A2. AI processing data flows (highest-priority item)

The AI layer is the sharpest compliance edge. Personal data of EU/UK/UAE residents sent to a US AI provider is a cross-border transfer, and if used in any training/tuning, the training run itself is a separate transfer.

- Inventory every AI call path that can contain personal data: MotorIQ (pricing inputs), FleetCopilot/Rari (conversation logs, voice), Margin (financial data), document processing in Vault, any Gemini/OpenAI/Anthropic/ElevenLabs call.
- For each path, report: what personal data can be included, which provider/region receives it, whether it is retained by the provider, and whether it can be excluded from provider-side training.
- Propose a **data minimization / pseudonymization layer** for AI calls on EU/UK/UAE accounts: strip or tokenize direct identifiers (renter names, license numbers, contact details) before they leave the EU boundary where feasible.
- Confirm provider-side "no training on our data" settings are enabled for every AI vendor and surface where that is configured.

### A3. Consent management (UAE-critical)

UAE PDPL makes **consent the default lawful basis** (it does not recognize GDPR-style "legitimate interests" as a standalone basis). This is a structural difference, not a copy change.

- Audit current consent capture: cookie consent banner, SMS opt-in, marketing opt-in, terms acceptance. Report what is captured, where it is stored, and whether it is versioned.
- Build a unified **consent ledger**: per-data-subject record of what was consented to, when, the version of the notice shown, IP, and withdrawal events. (This extends the clickwrap acceptance record pattern already specified.) Append-only, queryable, exportable.
- For UAE accounts specifically: ensure processing that the US/EU product justifies via "legitimate interests" has an explicit consent path instead. Flag every current processing activity that relies on an implied or legitimate-interest basis so it can be re-papered as consent for UAE.
- Cookie consent must support **reject-all as easily as accept-all** and granular category control (already required by the deployed Cookie Policy).

### A4. Data subject rights (DSR) tooling

All three regimes grant access, correction, deletion, and portability. Build the workflows once; they serve all markets.

- **Access / portability:** a function that exports all personal data for a given data subject (operator user, renter, vehicle partner) in machine-readable JSON/CSV, spanning all tables and Storage. The DPA already commits to this; confirm it exists and works end to end.
- **Deletion / erasure:** a hard-delete workflow that removes a data subject's personal data across all tables, Storage, and (where contractually possible) downstream processors, with documented exceptions for legal-retention data (transaction records, consent logs). Distinguish soft-delete from hard-delete in the schema.
- **Correction:** confirm self-service correction paths and an admin correction path for fields users cannot edit themselves.
- **Storage limitation:** implement automated retention enforcement (e.g. scheduled hard-deletion of data classes past their retention window) rather than retention existing only as policy text. Map each retention period in the Privacy Policy/DPA to an actual enforced job.

### A5. Security controls and evidence (SOC 2 / ISO 27001 aligned)

These overlap heavily with what enterprise EU/UAE buyers will ask for in security questionnaires.

- **Encryption:** confirm at-rest (AES-256, AWS-managed) and in-transit (TLS 1.2+) across all data paths. Report any path lacking it.
- **RLS:** audit row-level security on every table holding personal data. Confirm tenant isolation (one operator cannot read another's data) and per-user isolation where applicable. This is the single most important technical control; report any table where RLS is missing or permissive.
- **Access control:** least-privilege review of service keys vs publishable keys. Confirm the service-role key is never exposed client-side.
- **Audit logging:** implement or confirm an immutable audit log for access to and changes affecting personal data (who accessed/modified what, when). Required as evidence for all three regimes.
- **Backups and restore:** confirm backup location and cross-region posture. Same-region-only backups satisfy residency but fail off-site redundancy expectations. Establish and log a restore-test cadence (monthly preferred, quarterly minimum).
- **Breach detection:** confirm there is a path to detect and surface a personal-data breach fast enough to support a 72-hour notification obligation.

### A6. Records and documentation (machine-generatable parts)

- Generate a **data inventory / data map** from the actual schema: every table, the personal data classes it holds, the data subjects, the retention period, and the downstream processors it flows to. This is the technical input to the Records of Processing (ROPA) that legal completes.
- Generate a current **sub-processor list** from the actual integrations in the codebase, with each processor's purpose, data shared, and processing region. Reconcile against the published sub-processor list in the DPA. Flag any processor in the code not in the published list, and vice versa.

### A7. Deliverable from you

Produce, in order:
1. A **gap-analysis report**: current state vs. each A-section item, RAG-rated (red/amber/green), citing actual files/config.
2. A **prioritized implementation plan**: what to build, in what order, with EU/UK before UAE, and dependencies on Part B inputs clearly marked.
3. **No code changes yet.** Wait for approval on the plan. The only thing you may generate without approval is the read-only data inventory and sub-processor reconciliation (A6), since those are diagnostic.

---

## Part B — Out of scope for Lovable/Cursor (do not generate or fabricate)

These are legal/operational and handled separately. Listed for context. If Part A work depends on one of these, flag the dependency and stop.

- **SCCs (Standard Contractual Clauses):** the 2021 EU SCC modules wired into the DPA for EU→US transfers, and the UK International Data Transfer Addendum for UK→US. Legal artifact, not code.
- **Transfer Impact Assessment (TIA):** documented assessment of US surveillance-law risk for each transfer, plus supplementary measures. Legal/operational.
- **DPF certification decision:** whether Exotiq certifies under the EU-US Data Privacy Framework as an alternative/supplement to SCCs.
- **EU representative + UK representative:** appointment of an Article 27 representative if Exotiq has no EU/UK establishment.
- **UAE jurisdiction determination:** for each UAE operator, whether they fall under federal PDPL, DIFC, or ADGM, based on where they are registered. This drives which rules apply and cannot be auto-detected from the app.
- **UAE DPO appointment:** triggered by large-scale/sensitive or automated-decision processing (the AI pricing likely triggers it).
- **DPIA authorship:** the Data Protection Impact Assessment for the AI features. You provide the technical inputs (A2); legal writes the assessment.
- **Policy/notice text:** all privacy notice, DPA, and consent-language wording. You implement the mechanisms; the text is drafted separately and provided to you.
- **Attorney review:** final sign-off on every mechanism before reliance.

---

## Reference: which regime applies when

| Trigger | Regime | Key divergence from current US posture |
|---|---|---|
| First EU/EEA operator or renter | GDPR | SCCs + TIA for US transfers; ROPA; DSR tooling; EU rep |
| First UK operator or renter | UK GDPR | UK IDTA addendum; UK representative |
| UAE mainland operator | Federal PDPL | Consent as default basis (no legitimate interests); full compliance by Jan 1 2027 |
| UAE operator registered in DIFC | DIFC DP Law No. 5 / 2020 + Reg 10 | GDPR-like, plus AI-specific rules already in force |
| UAE operator registered in ADGM | ADGM DP Regs 2021 | GDPR-like; most transferable from EU work |

---

*This prompt covers technical and product readiness only. It is not legal advice and does not substitute for attorney review of Exotiq's international data protection posture.*

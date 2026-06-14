# Exotiq International Compliance Roadmap

**Markets:** EU (GDPR), UK (UK GDPR), UAE (PDPL / DIFC / ADGM)
**Goal:** Command Center legally able to onboard operators and process renter data in these markets this year.
**Prepared:** June 14, 2026

---

## The one-paragraph strategy

EU and UK share roughly 90% of the same requirements, so build them as a single workstream with a small UK addendum. UAE is a separate track, and within UAE the rules fork again depending on whether an operator is registered on the mainland (federal PDPL), in DIFC, or in ADGM. None of these regimes are primarily about server location. They are about knowing exactly where personal data flows, covering each cross-border flow with a legal mechanism, and being able to prove it. The single sharpest item for Exotiq is the AI layer: every MotorIQ, Rari, Gemini, OpenAI, and Anthropic call that touches an EU/UK/UAE resident's data is a cross-border transfer that must be covered.

## Sequence

**Phase 1 — EU/UK foundation (do first).**
Wire the 2021 EU SCCs into the DPA and add the UK IDTA addendum. Stand up the technical half in Lovable/Cursor: data inventory, DSR tooling (export + erasure), consent ledger, RLS audit, retention enforcement, AI data-flow minimization. Decide the residency posture (single US region with SCCs, or a separate EU region project). Author the Transfer Impact Assessment and the DPIA for the AI features. Appoint EU and UK representatives if Exotiq has no establishment there.

**Phase 2 — UAE.**
Re-paper the lawful basis as consent (PDPL does not accept legitimate interests). For each UAE operator, determine jurisdiction (mainland vs DIFC vs ADGM) before onboarding, because it changes which law applies. Add UAE-specific privacy notice and consent flows. Assess the DPO appointment trigger (the AI pricing likely triggers it). DIFC has AI-specific rules already in force, so a DIFC operator raises the bar earliest.

## What's a dev task vs. a legal task

| Dev (Lovable/Cursor) | Legal / operational |
|---|---|
| Data residency + region architecture | SCCs, UK IDTA, TIA |
| AI data-flow minimization / pseudonymization | DPF certification decision |
| Consent ledger + cookie/marketing/SMS capture | DPIA authorship (dev provides inputs) |
| DSR tooling: export, erasure, correction | EU + UK representative appointment |
| Retention enforcement jobs | UAE jurisdiction determination per operator |
| RLS audit, audit logging, encryption confirm | UAE DPO appointment |
| Data inventory + sub-processor reconciliation | All policy/notice wording + attorney review |

## Documents to produce

| Document | Type | Status |
|---|---|---|
| International Compliance Infrastructure Prompt | Dev brief (Lovable/Cursor) | Drafted |
| GDPR/UK Privacy Notice (EU/UK customer-facing) | HTML/MD policy | To draft |
| DPA + SCC module wiring | Legal doc | To draft (SCC annexes need legal) |
| UAE PDPL Privacy Notice | HTML/MD policy | To draft |
| Transfer Impact Assessment | Legal/ops template | Attorney-led |
| DPIA (AI features) | Legal/ops template | Attorney-led, dev inputs |
| ROPA (Records of Processing) | Internal register | Dev generates data map; legal completes |

## Honest risk notes

- This is real scope. Do not let a dev agent generate SCCs, a TIA, or privacy notices as if they were code tasks. The mechanisms are buildable; the legal instruments are not auto-generatable.
- The AI transfer issue is the item most likely to be missed and most likely to matter. Prioritize A2 in the dev prompt.
- UAE mainland vs DIFC/ADGM is a determination you make per operator at onboarding. Build the onboarding flow to capture it.
- Everything here needs attorney review before you rely on it in a real dispute or regulator interaction. This roadmap structures the work; it does not certify it.

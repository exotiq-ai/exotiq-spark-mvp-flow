## Bring legal version metadata into compliance

The June 14, 2026 revisions to the core legal docs were **material** (new EU/UK privacy notice, UAE notice, International Transfer Addendum / SCCs / UK IDTA, updated sub-processor disclosures). The compliant pattern is: each version carries its own effective date, the prior version is retained in audit history, and re-acceptance is forced before users continue.

The `version` key already changed to `2026-06-14`, so the re-acceptance gate will fire on next login. What's missing is honest **effective date** display and a transparent **last updated** label.

### Changes

**1. `src/lib/legal/versions.ts`**
- Add `lastUpdated: string` to `LegalDocMeta`.
- For all seven core docs (`terms`, `privacy`, `aup`, `dpa`, `sms`, `cookies`, `dmca`): set `effectiveDate: "June 14, 2026"` and `lastUpdated: "June 14, 2026"`.
- `transfer_addendum` is already `June 14, 2026` — just add matching `lastUpdated`.
- Add a `priorVersions` array per doc capturing `{ version: "2026-01-01", effectiveDate: "January 1, 2026" }` so audit history can still surface the original effective date.

**2. `src/components/dashboard/settings/LegalSection.tsx`** (~line 165)
- Render `v{doc.version} · Effective {doc.effectiveDate} · Updated {doc.lastUpdated}`.
- When `effectiveDate === lastUpdated` (which will be true for all 7 after this change), render once: `v{version} · Effective {effectiveDate}`.

**3. `src/components/legal/TermsReacceptanceGate.tsx`** (~line 158)
- Show `Effective {effectiveDate}` (now June 14) alongside the existing change summary. The gate copy already says "Updated terms require your acceptance," which is now factually correct.

**4. Standalone legal pages** (`Privacy.tsx`, `AcceptableUse.tsx`, `Cookies.tsx`, `DataProcessing.tsx`, `Dmca.tsx`, `Sms.tsx`, and `Terms` if present)
- Replace hardcoded `Effective: January 1, 2026` and `Last Updated:` literals with reads from `LEGAL_DOCS[<type>]`. Show both lines.
- `PrivacyEU.tsx`, `PrivacyUAE.tsx`, `TransferAddendum.tsx` already align — leave them.

**5. `src/pages/admin/TermsAcceptancesAdmin.tsx`** (verify only)
- Confirm the admin view still surfaces acceptances against prior versions (`2026-01-01`) so we don't lose audit history for users who already accepted the Jan 1 text. No change expected — the table stores the version that was accepted at acceptance time.

**6. Tests**
- Extend `src/lib/legal/__tests__/versions.test.ts`: assert every doc has `lastUpdated`, assert effective date is no earlier than the version's date string, assert `priorVersions` contains the Jan 1 entry for the seven core docs.

### Explicitly out of scope

- No DB migration. The `legal_document_versions` table already stores per-version records; the new `2026-06-14` rows should already exist from the prior session. If they don't, that's a separate fix and I'll flag it before edits.
- No copy changes to the document bodies.
- No forward-dated effective date (user chose immediate).
- No banner / email notification flow — the existing re-acceptance gate is the notification surface.

### Verification

- `vitest run src/lib/legal` green.
- `/dashboard/settings` Legal panel shows `v2026-06-14 · Effective June 14, 2026` for all rows.
- Forcing the gate on a test account shows `Effective June 14, 2026`.
- All standalone legal pages render dates from a single source.
- Spot-check `terms_acceptances` rows that pre-date today still show their original `2026-01-01` version in admin history (audit integrity preserved).

## Tenant-facing e-signature (Phase 1) — "Exotiq sends, tenant signs, three copies"

A focused, low-risk replacement for DocuSign for routine B2B documents (Founding Partner Order Form, addenda, custom agreements). DocuSign stays available for edge cases (multi-party, witnesses, eIDAS Qualified).

**Posture:** ESIGN + UETA-compliant simple electronic signature. Disclosed to the signer in the ceremony.

### User flow

1. **Super admin** opens *Tenants → [Tenant] → Documents* tab. Uploads a PDF, picks a template (`order_form`, `addendum`, `custom`), enters signer name/title/email if known, and sends.
2. **Tenant owner/admin** sees:
   - In-app notification (existing unified notifications center)
   - Persistent dashboard banner: *"Exotiq has sent a document that requires your signature"* with a *Review and Sign* button
   - Email to the account owner via the existing transactional email path
   - A new *Awaiting Signature* row at the top of Vault
3. **Signing ceremony** (full-screen modal):
   - `pdfjs-dist` renders every page. Scroll-to-bottom required before the sign panel unlocks (standard DocuSign behavior).
   - Fixed bottom signer panel: typed full name, title, auto-stamped date, signature canvas (reuse `SignatureCanvas`), required ESIGN acknowledgement checkbox with the disclosure copy.
   - Cancel returns to dashboard; document stays *Awaiting Signature*.
4. **On submit** (edge function `sign-tenant-document`):
   - Validates signer is an authorized representative (owner/admin role on that team)
   - Uses `pdf-lib` to overlay signature image + typed name + title + date at template-defined coordinates on the last page
   - Appends a **Certificate of Completion** page: `doc_ref` (EXQ-DOC-YYYY-NNNNN), signer name + email + role, timestamp (UTC), IP, user agent, SHA-256 of original and signed PDFs, document title
   - Stores the signed PDF in **three** locations:
     - Tenant's Vault storage bucket (`documents` row, `signed_at`, `signature_image_url`, `signing_metadata`, `parent_document_id` → original)
     - Exotiq compliance bucket (`exotiq-compliance`, write-once, super-admin read only)
     - `tenant_document_signatures` row with the audit envelope
   - Marks the source `tenant_documents` row as `signed`, dismisses the banner, fires a notification back to the super admin who sent it

### Schema (one new table + columns)

**`tenant_documents`** — Exotiq → tenant outbound queue
- `team_id` (FK teams), `sent_by_super_admin_id`, `template` enum, `original_storage_path`, `signed_document_id` (FK documents, null until signed), `signer_email`, `signer_name`, `signer_title`, `status` enum (`sent`/`viewed`/`signed`/`voided`), `field_overlay` JSONB (template-defined coordinates; Phase 2 will let this be edited via UI), `sent_at`, `viewed_at`, `signed_at`, `voided_at`, `voided_reason`, `doc_ref` (separate `EXQ-TDOC-YYYY-NNNNN` sequence)

**`tenant_document_audit`** — append-only audit log
- `tenant_document_id` (FK), `event_type` (`sent`/`opened`/`viewed_page`/`scrolled_complete`/`signed`/`downloaded`/`voided`), `actor_user_id`, `ip_address` inet, `user_agent`, `metadata` JSONB, `created_at`

RLS:
- `tenant_documents`: tenant owners/admins SELECT/UPDATE-status on rows where `team_id` matches their team; super admins full access via `is_super_admin()`. No anon.
- `tenant_document_audit`: insert-only via edge function (service role); super admins SELECT; tenant owners SELECT only their team's rows.
- All four steps (CREATE → GRANT → ENABLE RLS → CREATE POLICY) in one migration.

### Storage

- New private bucket `exotiq-compliance` — service-role write, super-admin read only (`is_super_admin()` policy on `storage.objects`).
- Existing tenant Vault bucket reused for the signed copy the tenant sees.

### Edge functions

- `prepare-tenant-document` — super admin upload → moves file into both storage locations, creates `tenant_documents` row, fires notification + email
- `sign-tenant-document` — overlays signature, appends certificate page, dual-writes, logs audit, fires completion notifications
- Both: JWT auth via `getClaims()`, role check, Zod input validation, structured errors

### Frontend surfaces

- **New: `src/pages/admin/TenantDocumentsAdmin.tsx`** (super admin) — list, upload, send, view status, void
- **New: `src/components/admin/SendTenantDocumentDialog.tsx`** — upload + template picker + signer fields
- **New: `src/pages/dashboard/AwaitingSignatureBanner.tsx`** — mounted at dashboard shell level, queries `tenant_documents` where `status='sent'` for the team
- **New: `src/components/signing/TenantDocumentSigner.tsx`** — full-screen signing ceremony (pdfjs-dist viewer + reused `SignatureCanvas`)
- **Vault tab addition**: *Agreements with Exotiq* section listing signed and pending tenant documents with the `doc_ref`
- **Notifications**: new types `tenant_document_sent` and `tenant_document_signed`, deep-link via existing global router

### Templates (Phase 1 — no drag-to-place UI)

JSON definitions in `src/lib/signing/tenantDocTemplates.ts`. Each template lists field type, page index, normalized x/y/width/height. Ships with:
- `order_form` — signature + printed name + title + date on the last page (matches the Founding Partner Order Form layout you shared)
- `addendum` — same layout, configurable label
- `custom` — signature + printed name + title + date on page = last, anchored bottom-right (safe default)

Schema is identical to what Phase 2 would need, so adding a drag-to-place editor later is a UI-only change. No migration churn.

### Legal & compliance

- ESIGN acknowledgement copy: *"By signing, I agree this electronic signature is the legal equivalent of my manual signature. I confirm I am authorized to bind {tenant legal name}."*
- Audit envelope satisfies UETA Section 12 (attribution, retention, integrity)
- SHA-256 of original and signed PDFs stored in both `tenant_documents` and the certificate page; tamper-evident
- Stored in Exotiq compliance bucket for at least the document retention period defined in `retention_policies`
- New `mem://legal/tenant-esignature` memory documenting the legal posture
- Add a sentence to the Terms doc noting Exotiq may deliver binding agreements via this channel (one-line edit; counsel can refine later)

### Feature flag

`featureFlags.tenantEsignature = false` initially. Super admin sees the surface either way for testing; tenant-facing banner + Vault section gated behind the flag until you flip it.

### Verification

- Vitest: template coordinate math, certificate generator, hash stability
- Edge function unit test: signer role check rejects non-owner/admin
- Manual: send Founding Partner Order Form to a test tenant, sign, confirm three copies match SHA-256, confirm super admin sees it in compliance bucket, confirm tenant sees it in Vault, confirm certificate page renders correctly
- Visual QA on the signing modal at 375px, 768px, 1440px

### Out of scope (Phase 1)

- Drag-to-place field editor (Phase 2)
- Multi-signer routing, sequential signing, reminders, expirations (Phase 3 / keep DocuSign)
- Witness fields, eIDAS Qualified, in-document payments (keep DocuSign)
- Editable PDF form-field detection (would need AcroForm parsing — skip)
- Re-signing / amendments workflow (manual: void + resend for now)

### Effort

3–5 focused days. No edits to bookings, fleet, pricing, or messaging code paths. New tables, new bucket, new pages, new edge functions, two notification types, one banner mount.

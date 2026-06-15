
# Plan: Tenant Signing — Form-Fill + Compliance Email + Signed Copy Visibility

Three independent workstreams, in priority order.

---

## 1. PDF form-fill (AcroForm) support in the signer

Replace the read-only iframe with PDF.js so tenants can fill any AcroForm fields the PDF already has (text boxes, checkboxes, dropdowns) before signing. Field values flow through the existing sign function and get flattened into the final PDF alongside the signature.

**Files**
- `src/components/signing/TenantDocumentSigner.tsx` — swap `<iframe>` for `react-pdf` `<Document>`/`<Page>` with `renderAnnotationLayer` + `renderForms` enabled. Track field values in local state via PDF.js `annotationStorage`. On submit, serialize values and pass as `form_values: Record<string, string|boolean>`.
- `supabase/functions/sign-tenant-document/index.ts` — before stamping the signature, iterate `form_values` and apply via `pdf-lib`'s `form.getTextField(name).setText(v)` / `getCheckBox(name).check()` / `getDropdown(name).select(v)`. Then `form.flatten()` so values become permanent and the certificate hash covers them.
- `package.json` — add `react-pdf` (which bundles `pdfjs-dist`).
- `index.html` — already allows `*.supabase.co` in `frame-src`; PDF.js uses a worker, so add a `worker-src 'self' blob:` directive if not present.

**Edge cases**
- PDFs without AcroForm fields: render normally; no field UI shown.
- Required-field validation: block Sign button until all `required` AcroForm fields are filled.
- Large PDFs: lazy-render pages with `react-pdf`'s page virtualization.

---

## 2. Email the signed PDF to `hello@exotiq.ai` (compliance inbox)

Today, on successful signature, only an in-app notification fires. Add a fire-and-forget email to a configurable compliance inbox (default `hello@exotiq.ai`) with the signed PDF + certificate attached.

**Files**
- `supabase/functions/send-compliance-email/index.ts` — extend to accept an optional `attachments: [{ filename, content_base64 }]` array and forward to Resend's `attachments` field. Already gated by `INTERNAL_FUNCTION_TOKEN`.
- `supabase/functions/sign-tenant-document/index.ts` — after both bucket uploads succeed, fetch the signed PDF bytes, base64-encode, and invoke `send-compliance-email` with:
  - `to: COMPLIANCE_INBOX` (env var, default `hello@exotiq.ai`)
  - subject: `Signed: {doc_ref} — {team_name}`
  - body: signer name/title/email, team name, doc ref, timestamp, SHA-256, links to both Vault and compliance bucket
  - attachment: the signed PDF
  - Log `email_sent` / `email_failed` to `tenant_document_audit`. Failure must NOT roll back the signature.
- New secret: `COMPLIANCE_INBOX` (optional; defaults to `hello@exotiq.ai`).

**Why fire-and-forget**: signature must succeed even if Resend is down.

---

## 3. Visibility of the signed copy in the tenant Vault

Confirm the existing Vault UI lists `tenant_documents` rows with `status = 'signed'` and exposes a "Download signed copy" action that fetches a signed URL from the `customer-documents` bucket using `signed_storage_path`.

**Files to verify (read-only this phase)**
- `src/pages/dashboard/Vault.tsx` (or equivalent) — ensure signed docs show:
  - Status badge (Sent / Viewed / **Signed** / Voided)
  - Signed date + signer name
  - "View signed PDF" button → opens signed URL in new tab
  - "Download certificate page" if separable (currently bundled in the same PDF, so one download covers both)
- If missing, add a `SignedDocumentCard` that renders these affordances.

**For `hello@exotiq.ai` access (super admin):**
- Confirm `SuperAdminDashboard.tsx` has a "Compliance archive" tab listing all signed `tenant_documents` across teams with signed URLs from the `exotiq-compliance` bucket. If not, add one (super-admin-only via `super_admins` table check).

---

## Out of scope (deferred)

- Drag-and-drop field placement editor for super admins (Phase 2 — schema already exists in `tenant_documents.field_overlay`).
- SMS notifications on signature.
- Per-signer email (multi-party signing).
- Counter-signature by Exotiq.

---

## Technical notes

- **react-pdf** workers: must configure `pdfjs.GlobalWorkerOptions.workerSrc` to a CDN or `import.meta.url` worker bundle. Vite needs the `?url` import pattern.
- **pdf-lib form flattening** happens before signature stamping so the stamp lands on a stable, non-editable copy. Certificate's SHA-256 is computed against the final flattened+stamped bytes.
- **Resend attachment limit**: 40 MB total payload, well above typical signed PDFs (~1–3 MB).
- **CSP**: `frame-src` already allows `*.supabase.co`; PDF.js renders to `<canvas>`, no iframe needed once swapped.

---

## Rollout

1. Ship #2 first (email to compliance inbox) — smallest change, immediate value, no UI risk.
2. Ship #3 (Vault visibility audit + fixes).
3. Ship #1 (PDF.js + form-fill) — largest change, behind a quick smoke test on the Order Form PDF.

Approve and I'll start with #2.

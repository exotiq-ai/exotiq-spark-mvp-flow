# TODO — Tenant Document Overlay Fields (Option B)

**Status:** Planned — picking up later this week
**Owner:** TBD
**Related files:**
- `src/components/signing/TenantDocumentSigner.tsx`
- `src/lib/signing/tenantDocTemplates.ts`
- `supabase/functions/sign-tenant-document/index.ts`
- `supabase/functions/prepare-tenant-document/index.ts`

---

## Problem

Today's tenant signing flow uses **flat PDFs** (Order Form, MSA, addenda) with
no AcroForm fields. `react-pdf` is already configured with `renderForms`, but
there is nothing for it to render — so the tenant cannot fill anything in the
document itself. They can only type their printed name + title in the side
panel and draw a signature.

For docs that need tenant-provided values (insurance policy #, business EIN,
delivery address, custom counter-party terms, etc.) we either:
- Pre-fill server-side in `prepare-tenant-document` (works for values we
  already know), or
- Capture them outside the PDF (doesn't appear on the signed doc), or
- Skip them entirely.

This is a content gap, not a code bug. Option B closes it.

---

## Recommended Approach — Overlay field editor

Render typed **HTML `<input>` overlays** positioned on top of each PDF page,
defined per template in `tenantDocTemplates.ts` using the same normalized
(0..1) coordinate system already used for the signature block. On submit,
`pdf-lib` stamps the typed values onto the PDF *before* the signature is
applied and the document is flattened.

**Why this over real AcroForm authoring:**
- Works with any flat PDF — no Acrobat license or per-template authoring
- Field positions live in version-controlled TS, easy to template per doc
- Audit trail captures every value entered (we control the inputs)
- Keeps the current clean UI; just adds floating inputs over the page

**Why this over DocuSign/HelloSign:**
- Overkill for internal tenant onboarding docs (not multi-party redlines)
- Avoids per-seat cost, vendor lock-in, and PII routing through a 3rd party
- We already have ESIGN/UETA-compliant Certificate of Completion + SHA-256
  sealing + dual storage (Vault + compliance archive)

---

## Scope

### 1. Schema — extend `TenantDocFieldType`
File: `src/lib/signing/tenantDocTemplates.ts`

```ts
export type TenantDocFieldType =
  | "signature"
  | "printed_name"
  | "title"
  | "date"
  // NEW:
  | "text"        // single-line free text
  | "multiline"   // textarea
  | "checkbox"    // boolean
  | "dropdown";   // enum from `options: string[]`
```

Extend `TenantDocField` with optional `options?: string[]`, `placeholder?:
string`, `key: string` (stable identifier used as the form-values map key).

### 2. Frontend — overlay layer in `TenantDocumentSigner.tsx`

- New components in `src/components/signing/overlay/`:
  - `TextOverlayField.tsx`
  - `CheckboxOverlayField.tsx`
  - `DropdownOverlayField.tsx`
- New container `<OverlayLayer>` rendered as an absolutely-positioned div
  matching the rendered `<Page>` dimensions. Translate normalized (0..1)
  coords + flipped Y axis into CSS `top`/`left`/`width`/`height`.
- Local state: `overlayValues: Record<string, string | boolean>` keyed by
  field `key`.
- Validation: required overlay fields gate the "Sign and submit" button (the
  same way the existing acknowledgement checkboxes do today).
- Per-page rendering: filter `resolveFieldPages(...)` to the currently visible
  page so inputs only mount for that page.

### 3. Backend — `sign-tenant-document`

Already accepts `form_values: Record<string, string | boolean>` and tries to
apply them as AcroForm values. Extend to also handle **overlay text stamping**
when the field type is `text` / `multiline` / `checkbox` / `dropdown`:

- Iterate `body.fields` (already sent with type + coords + page).
- For text-like types, `page.drawText(value, { x, y, size, font })` matching
  the existing signature-block stamping logic (lines 175–207).
- For checkbox, draw a small filled square or unicode ✓ at the field origin.
- Stamping must happen **before** the certificate-of-completion page is
  appended so it's covered by the body SHA-256.

### 4. Admin — drag-place UI for super admins

- New panel in the super-admin Document Sender: after upload, render the PDF
  with a draggable + resizable field palette (text / checkbox / dropdown /
  signature / etc).
- Persist resulting field array to `tenant_documents.field_overlay` (JSONB
  column already exists, currently empty).
- Read priority on sign: `tenant_documents.field_overlay` ➜ fallback to
  `TENANT_DOC_TEMPLATES[template].fields`.
- Library: consider `react-rnd` or `interact.js`. Keep coords normalized.

### 5. Bundled QOL improvements (same PR)

1. **Download a review copy** button in the signer header (signed URL to the
   original; download-only, no edit).
2. **Scroll-to-end gate** on the "I have reviewed the document in full"
   checkbox — disable until `currentPage === numPages` has been reached at
   least once. Strong UETA evidence.
3. **Decline / Request changes** action: writes a `declined` row to
   `tenant_document_audit`, sets `tenant_documents.status = 'declined'`,
   notifies the super-admin sender with the reason.
4. **Audit page-view logging**: insert a `page_viewed` audit row the first
   time each page is rendered. Strong UETA evidence trail.
5. **Mobile layout**: switch the right-side signer panel to a bottom sheet
   below `md:` so the signature canvas isn't pushed off-screen.

---

## Out of scope for Option B

- Real-time multi-party collaboration / cursors
- DocuSign / HelloSign integration
- KBA / notary / witnessing (state-specific UETA carve-outs)
- Authoring real AcroForm PDFs in Acrobat (Option C — not chosen)
- Form-field templates persisted in the DB (use code-defined templates first,
  migrate to DB rows once we have ≥ 3 distinct templates)

---

## Effort estimate

| Area | Estimate |
|------|----------|
| Schema + types | 1 hr |
| Frontend overlay layer + inputs | 6–8 hrs |
| Backend stamping in `sign-tenant-document` | 3–4 hrs |
| Super-admin drag-place UI | 4–6 hrs |
| QOL bundle (5 items above) | 4–5 hrs |
| QA + edge function tests | 2–3 hrs |
| **Total** | **~20–27 hrs** |

Ship in 2 PRs if needed:
- **PR 1:** Schema + frontend overlay + backend stamping + QOL items 1, 2, 4
  (uses hand-authored template field arrays in TS).
- **PR 2:** Super-admin drag-place UI + QOL items 3, 5.

---

## Verification checklist

- [ ] Tenant can fill all overlay fields on flat Order Form before signing
- [ ] Required overlay fields gate the submit button
- [ ] Signed PDF shows typed values + signature in correct positions
- [ ] Certificate of Completion covers the stamped values (SHA-256 includes
      overlay text)
- [ ] `tenant_document_audit` records page views + declines
- [ ] Mobile: signature canvas visible, bottom-sheet works on iPhone SE
- [ ] Compliance archive copy matches Vault copy byte-for-byte
- [ ] No regression on docs without overlay fields (signature-only path)

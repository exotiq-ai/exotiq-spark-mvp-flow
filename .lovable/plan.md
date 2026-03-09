

# Signing Module Readiness Audit — Issues to Fix Before Testing

I've reviewed every file in the signing pipeline end-to-end. The core logic is solid, but there's **one blocker** that will prevent the edge function from deploying, plus a couple of minor items to clean up for a smooth test.

---

## Blocker: `generate-signed-pdf` missing from `config.toml`

The edge function code exists at `supabase/functions/generate-signed-pdf/index.ts`, but there's no entry in `supabase/config.toml`. Without this, the function won't deploy and the signing ceremony will fail at the PDF generation step.

**Fix:** Add to `config.toml`:
```toml
[functions.generate-signed-pdf]
verify_jwt = false
```

---

## Everything Else Checks Out

Here's what I verified is correctly wired:

| Component | Status |
|-----------|--------|
| **Database columns** (`doc_ref`, `booking_id`, `is_default`, `signed_at`, `signed_by_name`, `signature_image_url`, `signing_metadata`, `parent_document_id`) | Present in `types.ts` — migration ran successfully |
| **`doc_ref` trigger** (`generate_doc_ref()`) | Listed in db-functions — auto-generates `EXQ-DOC-YYYY-NNNNN` on insert |
| **`DocumentUploadDialog`** — "Rental Agreement" type, PDF-only restriction, "Set as Default" toggle, clear-previous-defaults logic | All implemented correctly |
| **`uploadDocument` in FleetContext** — passes `is_default` through to insert | Works — spreads all document fields including `is_default` |
| **`SignatureCanvas`** — canvas with pointer events, clear button, `toDataURL` export | Implemented |
| **`SigningCeremony`** — review step (iframe PDF viewer), sign step (checkbox + name + canvas), complete step, metadata capture (`userAgent`, `deviceType`, `screenSize`, IP from edge function) | Implemented |
| **`DocumentPicker`** — queries rental agreements for team, pre-selects default | Implemented |
| **`EnhancedBookingDialog`** — "Sign Document" button, `handleSignDocument` checks for default then opens ceremony or picker, fetches `bookingDocuments` linked by `booking_id` | Implemented |
| **`VaultEnhanced`** — search by `doc_ref`/signer name, "Default" badge, "Signed" badge, `doc_ref` display | Implemented |
| **Storage** — uses `createSignedUrl` (not `getPublicUrl`) for private bucket access | Fixed in `DocumentUploadDialog` |
| **Edge function** — loads PDF via service role key, appends signature page with `pdf-lib`, uploads result, returns path + client IP | Implemented |

---

## Plan: Single Fix

1. **Add `generate-signed-pdf` to `config.toml`** so the edge function deploys

That's it. Once that's in, you can:
1. Go to Vault → Upload → select "Rental Agreement" → upload your PDF → toggle "Set as Default"
2. Open any booking → scroll to Documents section → click "Sign Document"
3. Review the PDF in the iframe → Continue to Sign → check agreement, enter name, draw signature → Complete Signing
4. Signed doc appears in both the booking's Documents section and in Vault with its `EXQ-DOC-YYYY-NNNNN` reference


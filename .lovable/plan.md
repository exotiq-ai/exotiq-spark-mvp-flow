

# Final Execution Plan: Vault Signing Module + Check-In/Out Workflow + Storage Fix

This consolidates all three approved plans into a single ordered execution sequence. The check-in/out wizard is already implemented. This plan covers the remaining work.

---

## Phase A: Database Migration

Single migration adding signing columns to the `documents` table. The current schema has: `name, type, file_url, file_size, status, expires_at, user_id, team_id, vehicle_id, customer_id, verification_status, verified_by, verified_at`. None of the signing columns exist yet.

```sql
-- 1. Human-readable document reference sequence
CREATE SEQUENCE IF NOT EXISTS document_ref_seq START 1;

-- 2. Add signing columns
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_ref TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS signing_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_default ON documents(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_documents_doc_ref ON documents(doc_ref);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_document_id);

-- 4. Auto-generate doc_ref trigger
CREATE OR REPLACE FUNCTION generate_doc_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.doc_ref IS NULL THEN
    NEW.doc_ref := 'EXQ-DOC-' || EXTRACT(YEAR FROM NOW())::TEXT
      || '-' || LPAD(nextval('document_ref_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_doc_ref ON documents;
CREATE TRIGGER set_doc_ref
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION generate_doc_ref();
```

No new tables. No new buckets. Existing `customer-documents` (private) bucket handles all signing storage.

---

## Phase B: Fix Private Bucket Access (Existing Bug)

Three files currently call `getPublicUrl()` on the private `customer-documents` bucket, which returns 403 URLs. Fix all to use `createSignedUrl()`:

| File | Change |
|------|--------|
| `DocumentUploadDialog.tsx` | Replace `getPublicUrl` with `createSignedUrl(path, 31536000)` (1-year signed URL per project memory policy) |
| `InsuranceUploadDialog.tsx` | Same fix |
| `IDUploadDialog.tsx` | Same fix |

Also update any components that **read** these URLs to handle signed URL refresh if needed (check `VaultEnhanced.tsx` and `VerificationSection.tsx` for document viewing).

---

## Phase C: DocumentUploadDialog — Rental Agreement Support

Modify `DocumentUploadDialog.tsx`:

1. Add `'Rental Agreement'` to the `documentTypes` array
2. When type is `'Rental Agreement'`:
   - Restrict file accept to `.pdf` only (rental agreements must be PDF for iframe viewing)
   - Make expiry date **optional** (rental agreements don't expire)
   - Show a "Set as Default Rental Agreement" toggle
3. On submit with `is_default = true`:
   - First run: `UPDATE documents SET is_default = false WHERE team_id = X AND type = 'Rental Agreement' AND is_default = true`
   - Then insert the new document with `is_default = true`
4. Pass `team_id` from context into the document insert (already available via `useTeam()`)

---

## Phase D: SignatureCanvas Component

Create `src/components/signing/SignatureCanvas.tsx`:

- HTML `<canvas>` element with `pointerdown/pointermove/pointerup` events
- Works on iPad (stylus/finger), mobile (finger), desktop (mouse)
- "Clear" button to reset canvas
- Export method: `toDataURL('image/png')` returns PNG data URL
- Visual feedback: canvas border changes color when signature is present
- No external dependencies

---

## Phase E: Edge Function — generate-signed-pdf

Create `supabase/functions/generate-signed-pdf/index.ts`:

- Uses `pdf-lib` (available via npm/esm.sh in Deno)
- Input: `{ originalPdfUrl, signatureImageUrl, signerName, docRef, bookingDetails, timestamp }`
- Process:
  1. Fetch original PDF from `customer-documents` using service role key
  2. Append a new page with: signature image, signer name, timestamp, doc_ref, booking summary (vehicle, dates, renter)
  3. Upload result to `customer-documents` bucket as `signed/{userId}/{docRef}.pdf`
  4. Return the file path (not a URL — caller generates signed URL)
- Captures IP from `request.headers.get('x-forwarded-for')` and returns it in response for the client to store in `signing_metadata`
- CORS headers included
- Config: `[functions.generate-signed-pdf] verify_jwt = false` (validates auth in code)

---

## Phase F: SigningCeremony + DocumentPicker

Create `src/components/signing/SigningCeremony.tsx`:

Full-screen dialog wizard with steps:
1. **Review**: Booking header (vehicle, dates, renter name) + PDF viewer (`<iframe>` pointing to a signed URL of the rental agreement)
2. **Sign**: "I have read and agree" checkbox + `SignatureCanvas` + printed name input
3. **Complete**: On submit:
   - Upload signature PNG to `customer-documents` bucket
   - Call `generate-signed-pdf` edge function
   - Insert new `documents` row with: `type = 'Signed Rental Agreement'`, `booking_id`, `customer_id`, `vehicle_id`, `signed_at`, `signed_by_name`, `parent_document_id` (points to template), `signing_metadata` (userAgent, deviceType, screen size, IP from edge function response)
   - Show confirmation with doc_ref

Create `src/components/signing/DocumentPicker.tsx`:

- Small modal shown when no default rental agreement exists
- Queries `documents WHERE team_id = X AND type = 'Rental Agreement'`
- Operator selects which agreement to use, then proceeds to `SigningCeremony`

---

## Phase G: Booking Integration

Modify `EnhancedBookingDialog.tsx`:

- Add a "Documents" section in the Details tab (after financial summary)
- Shows any signed documents linked to this booking (`documents WHERE booking_id = X`)
- "Sign Document" button:
  - Checks for default rental agreement (`documents WHERE team_id = X AND type = 'Rental Agreement' AND is_default = true`)
  - If found: opens `SigningCeremony` with that document pre-loaded
  - If not found: opens `DocumentPicker` first, then `SigningCeremony`
- Pass booking, vehicle, and customer data through to the signing flow

---

## Phase H: Vault Search & Display Enhancements

Modify `VaultEnhanced.tsx`:

- Show `doc_ref` column in document list (e.g., `EXQ-DOC-2026-00247`)
- Show "Default" badge on the active rental agreement
- Add search by: doc_ref, booking ID, customer name, vehicle name
- For signed documents, show parent template name and signing date
- "Show all signed copies" link on rental agreement templates

---

## Build Order (Sequential)

| Step | What | Depends On |
|------|------|------------|
| 1 | Database migration (Phase A) | Nothing |
| 2 | Storage fix (Phase B) | Nothing — can parallel with Step 1 |
| 3 | DocumentUploadDialog updates (Phase C) | Steps 1, 2 |
| 4 | SignatureCanvas (Phase D) | Nothing — can parallel |
| 5 | generate-signed-pdf edge function (Phase E) | Step 1 |
| 6 | SigningCeremony + DocumentPicker (Phase F) | Steps 3, 4, 5 |
| 7 | Booking integration (Phase G) | Step 6 |
| 8 | Vault search enhancements (Phase H) | Step 1 |

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/signing/SignatureCanvas.tsx` | Create |
| `src/components/signing/SigningCeremony.tsx` | Create |
| `src/components/signing/DocumentPicker.tsx` | Create |
| `supabase/functions/generate-signed-pdf/index.ts` | Create |
| `src/components/dialogs/DocumentUploadDialog.tsx` | Modify |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Modify |
| `src/components/dashboard/VaultEnhanced.tsx` | Modify |
| `src/components/dialogs/InsuranceUploadDialog.tsx` | Modify (storage fix) |
| `src/components/dialogs/IDUploadDialog.tsx` | Modify (storage fix) |
| `supabase/config.toml` | Add generate-signed-pdf entry |

No new tables. No new buckets. No new secrets needed.


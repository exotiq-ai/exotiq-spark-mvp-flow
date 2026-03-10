

# Signing Flow Polish, Notes Fix, Search & Simplification

## Issues Identified

1. **PDF preview not working in Chrome/Safari** — The iframe loading a Supabase signed URL is blocked by browser security policies (X-Frame-Options / CSP). The signed URL works for download but not for embedding.

2. **Operator name not auto-filled on signed PDF** — `fill-rental-template` sets `operator_name` from team name, but `generate-signed-pdf` (the signature page) doesn't include a section for the operator/representative signature.

3. **Renter acknowledgement checkboxes** — The template has checkboxes that should either be auto-checked by `fill-rental-template`, or handled as an in-app step during signing. Recommendation: **Add an acknowledgements step in the SigningCeremony** (between Review and Sign) where the renter checks each item in-app. This is cleaner, legally stronger (timestamped per-item consent), and works regardless of template format.

4. **Notes not showing in Booking Details** — The Notes tab in `EnhancedBookingDialog` writes to `customer_notes` (linked by `customer_id`), not `bookings.notes`. There's no `booking_id` column on `customer_notes`, so booking-specific notes are stored as general customer notes and not filtered per booking.

5. **Search can't find doc_ref** — Global search (`EnhancedGlobalSearch`) doesn't search documents at all. Vault search does check `doc_ref` but requires being on the Vault page.

6. **Booking number simplification** — No simple booking number exists. The `doc_ref` (EXQ-DOC-YYYY-NNNNN) is document-level. Operators want a human-friendly booking reference.

---

## Plan

### 1. Fix PDF Preview (iframe blocking)
**File: `src/components/signing/SigningCeremony.tsx`**

Replace the `<iframe src={url}>` with a fetch-then-embed approach: fetch the PDF as a blob, create a blob URL, and use that as the iframe src. This bypasses CORS/CSP restrictions on signed URLs.

Same fix in `DocumentPreviewDialog.tsx` — add blob-based loading for PDF previews.

### 2. Add Renter Acknowledgements Step in SigningCeremony
**File: `src/components/signing/SigningCeremony.tsx`**

Add a new step `"acknowledge"` between `"review"` and `"sign"`:
- Display the 8 acknowledgement statements as checkboxes
- All must be checked to proceed to the signature step
- Store which items were acknowledged + timestamps in `signing_metadata`
- This replaces the need for template checkboxes — cleaner, auditable, works with any template

Steps become: `review → acknowledge → sign → complete`

### 3. Auto-fill Operator Representative on Signature Page
**File: `supabase/functions/generate-signed-pdf/index.ts`**

Add `operatorName` to the request body (passed from SigningCeremony). On the signature page, add an "Operator Representative" section below the renter signature with the operator's name and "Digitally acknowledged" text.

**File: `src/components/signing/SigningCeremony.tsx`**

Pass the team name (or logged-in user's name) as `operatorName` in the `generate-signed-pdf` call.

### 4. Fix Booking Notes — Add `booking_id` to `customer_notes`
**Database migration:**
```sql
ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id);
CREATE INDEX idx_customer_notes_booking ON customer_notes(booking_id);
```

**File: `src/components/dialogs/EnhancedBookingDialog.tsx`**
- When adding a note from a booking context, include `booking_id` in the insert
- When fetching notes in the Notes tab, filter by `booking_id` (with fallback to show customer-wide notes too)
- Show both "Booking Notes" and "Customer Notes" grouped in the tab

### 5. Add Documents to Global Search
**File: `src/components/common/EnhancedGlobalSearch.tsx`**

Add a documents search section that queries the `documents` array from `useLocationFilteredFleet()`:
- Search by `doc_ref`, `name`, `signed_by_name`
- Results navigate to Vault with the doc highlighted

### 6. Add Simple Booking Reference Number
**Database migration:**
```sql
CREATE SEQUENCE IF NOT EXISTS booking_ref_seq START 1001;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref text;
CREATE OR REPLACE FUNCTION generate_booking_ref() RETURNS trigger AS $$
BEGIN
  IF NEW.booking_ref IS NULL THEN
    NEW.booking_ref := 'BK-' || LPAD(nextval('booking_ref_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_booking_ref BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_ref();
```

**Files to update:**
- `fill-rental-template/index.ts` — add `booking_ref` to field map
- `EnhancedBookingDialog.tsx` — display booking ref in header
- `EnhancedGlobalSearch.tsx` — search by booking_ref
- Backfill existing bookings with refs

### Files Summary

| File | Change |
|------|--------|
| `SigningCeremony.tsx` | Blob-based PDF preview, acknowledgements step, pass operator name |
| `DocumentPreviewDialog.tsx` | Blob-based PDF preview |
| `generate-signed-pdf/index.ts` | Add operator representative section |
| `EnhancedBookingDialog.tsx` | Fix notes to include booking_id, show booking ref |
| `EnhancedGlobalSearch.tsx` | Add document + booking_ref search |
| `fill-rental-template/index.ts` | Add booking_ref to field map |
| Database migration | Add booking_id to customer_notes, add booking_ref to bookings |


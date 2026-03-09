

# Master Plan: Signing Module Polish + Template Auto-Fill

## What's Already Built (no rework needed)
- Document upload with rental_agreement type, PDF-only enforcement, Set as Default toggle
- SigningCeremony 3-step wizard (Review → Sign → Complete)
- SignatureCanvas (native HTML5, pointer events, touch/stylus)
- generate-signed-pdf edge function (pdf-lib, appends signature page)
- doc_ref auto-generation (EXQ-DOC-YYYY-NNNNN)
- Booking Documents section with signed doc list
- DocumentPreviewDialog with blob-based download
- Vault search by name, type, doc_ref, signer name

---

## Phase 1: Signing Ceremony Polish (Quick Wins)

### 1A. Full-Screen Mobile/iPad Layout
**File: `SigningCeremony.tsx`**
- Replace `sm:max-w-3xl max-h-[90vh]` with responsive: full viewport on mobile/tablet (`h-[100dvh] w-screen` below `lg:`), standard dialog on desktop
- Add Exotiq logo in header bar using existing `ExotiqLogoCompact`
- Add vehicle thumbnail using existing `VehicleThumbnail` component in the booking context card

### 1B. Close Confirmation
**File: `SigningCeremony.tsx`**
- Add `beforeunload` event listener when signing is in progress (step !== "review")
- Wrap `handleClose` with a confirmation dialog (reuse existing `ConfirmationDialog` component) when step is "sign" and canvas has content
- Prevents accidental loss of signature mid-flow

### 1C. Celebration on Completion
**File: `SigningCeremony.tsx`**
- Import existing `Celebration` component from `MicroInteractions.tsx`
- Trigger `variant="success"` confetti when step transitions to "complete"
- Already installed: `canvas-confetti` package

### 1D. Booking Documents UI Polish
**File: `EnhancedBookingDialog.tsx`**
- Change "Sign Document" button from `variant="outline" size="sm"` to a prominent teal primary button
- Add "View" button on each signed document row that opens `DocumentPreviewDialog`

### 1E. Vault Search Enhancement
**File: `VaultEnhanced.tsx`**
- Extend `filteredDocuments` search to also match `booking_id` field
- Already matches: name, type, doc_ref, signed_by_name

### 1F. Edge Function Footer
**File: `generate-signed-pdf/index.ts`**
- Update footer text from "ExotIQ Fleet Management" to "Exotiq Vault"
- Add doc_ref to footer: "Reference: EXQ-DOC-2026-XXXXX"

---

## Phase 2: Template Auto-Fill System

This is the high-value feature. The operator uploads a PDF rental agreement template with form fields. When a booking triggers signing, the system auto-fills customer and booking data into the template before the renter sees it.

### How It Works

```text
SETUP (once):
  Operator creates PDF template in any editor (Adobe Acrobat, LibreOffice, etc.)
  with named AcroForm fields → uploads via Vault as "Rental Agreement" + "Set as Default"

SIGNING FLOW (per booking):
  Operator clicks "Sign Document" on booking
         ↓
  New edge function downloads default template
         ↓
  pdf-lib reads AcroForm fields, fills from booking + customer data:
    • customer_name, customer_email, customer_phone, customer_address
    • drivers_license, license_expiry, date_of_birth
    • insurance_provider, insurance_policy
    • vehicle_name, vehicle_year, vehicle_make, vehicle_model
    • vehicle_vin, vehicle_plate, vehicle_color
    • rental_start, rental_end, daily_rate, total_value
    • deposit_amount, delivery_address, pickup_location
    • operator_name (from team/profile)
    • today_date, agreement_date
         ↓
  Filled PDF uploaded as temporary preview document
         ↓
  SigningCeremony loads the FILLED version (not raw template)
         ↓
  Renter reviews pre-populated agreement → signs → signature page appended
         ↓
  Final PDF archived with full audit trail
```

### 2A. New Edge Function: `fill-rental-template`
**File: `supabase/functions/fill-rental-template/index.ts`**

Input: `{ templateDocumentId, bookingId }`

Logic:
1. Auth check (JWT validation)
2. Fetch booking row (includes customer_name, vehicle_id, dates, rates, locations)
3. Fetch customer row via booking.customer_id (full_name, email, phone, address, drivers_license, license_expiry, DOB, insurance fields)
4. Fetch vehicle row via booking.vehicle_id (name, make, model, year, vin, license_plate, color)
5. Fetch team/profile for operator name
6. Download template PDF from storage
7. Use `pdf-lib` `getForm()` to enumerate AcroForm fields
8. Map data to fields using a standard naming convention (see field map below)
9. Flatten form fields so they appear as static text (prevents renter editing)
10. Upload filled PDF to `filled-templates/{userId}/{bookingId}-{timestamp}.pdf`
11. Return the storage path

**Field Name Convention** (what operators name their PDF form fields):

| Field Name | Source | Example Value |
|---|---|---|
| `customer_name` | customers.full_name | "John Smith" |
| `customer_email` | customers.email | "john@example.com" |
| `customer_phone` | customers.phone | "+1 305 555 1234" |
| `customer_address` | customers.address | "123 Main St, Miami" |
| `drivers_license` | customers.drivers_license | "D123-456-789" |
| `license_expiry` | customers.license_expiry | "Dec 15, 2027" |
| `date_of_birth` | customers.date_of_birth | "Jan 1, 1990" |
| `insurance_provider` | customers.insurance_provider | "State Farm" |
| `insurance_policy` | customers.insurance_policy | "POL-123456" |
| `vehicle_name` | vehicles.name | "McLaren 720S" |
| `vehicle_year` | vehicles.year | "2024" |
| `vehicle_make` | vehicles.make | "McLaren" |
| `vehicle_model` | vehicles.model | "720S" |
| `vehicle_vin` | vehicles.vin | "SBM14DCA..." |
| `vehicle_plate` | vehicles.license_plate | "EXOTIQ1" |
| `vehicle_color` | vehicles.color | "Papaya Spark" |
| `rental_start` | bookings.start_date | "Mar 15, 2026" |
| `rental_end` | bookings.end_date | "Mar 20, 2026" |
| `daily_rate` | bookings.daily_rate | "$2,500" |
| `total_value` | bookings.total_value | "$12,500" |
| `deposit_amount` | bookings.deposit_amount | "$5,000" |
| `pickup_location` | bookings.pickup_location | "Miami Beach" |
| `delivery_address` | bookings.delivery_address | "456 Ocean Dr" |
| `agreement_date` | today | "March 9, 2026" |
| `operator_name` | teams.name | "Exotiq Miami" |

The function gracefully skips any fields that don't exist in the template — operators only need to include the fields they care about.

### 2B. Update Signing Flow
**File: `SigningCeremony.tsx` + `EnhancedBookingDialog.tsx`**

Current flow: operator clicks Sign → picks template → SigningCeremony opens with raw template PDF

New flow:
1. Operator clicks "Sign Document"
2. System finds default rental agreement (existing logic)
3. **NEW**: Calls `fill-rental-template` edge function with template ID + booking ID
4. Shows loading state: "Preparing your rental agreement..."
5. SigningCeremony opens with the **filled** PDF (not the raw template)
6. Rest of signing flow unchanged

The `DocumentInfo` passed to SigningCeremony will point to the filled PDF URL instead of the raw template.

### 2C. Post-Signing: Email Delivery
**File: new edge function `send-signed-document`**

After signing completes, optionally email the signed PDF to both operator and renter:

1. Download the signed PDF from storage
2. Use Resend (already configured, `RESEND_API_KEY` exists) to send:
   - **To renter**: customer email from booking, subject "Your Rental Agreement — {vehicle_name}", attach PDF
   - **To operator**: team owner email, subject "Signed Agreement — {customer_name} — {doc_ref}", attach PDF
3. Update the document record with `email_sent_at` timestamp

This is triggered from `SigningCeremony.tsx` after the signing is complete — a "Send Copy" button or automatic send based on team settings.

---

## Phase 3: Config for `supabase/config.toml`

Add entry for the new edge function:
```toml
[functions.fill-rental-template]
verify_jwt = false

[functions.send-signed-document]
verify_jwt = false
```

---

## Database Changes

### Migration: Add `email_sent_at` to documents
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
```

No other schema changes needed — all required fields already exist.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `SigningCeremony.tsx` | Modify | Full-screen mobile, logo, close confirm, confetti, auto-fill integration |
| `EnhancedBookingDialog.tsx` | Modify | Teal Sign button, View buttons, call fill-rental-template before opening ceremony |
| `VaultEnhanced.tsx` | Modify | Search by booking_id |
| `generate-signed-pdf/index.ts` | Modify | Footer text update |
| `supabase/functions/fill-rental-template/index.ts` | Create | Template auto-fill edge function |
| `supabase/functions/send-signed-document/index.ts` | Create | Email delivery of signed PDFs |
| `supabase/config.toml` | Modify | Add new function entries |
| Database migration | Create | Add email_sent_at column |

---

## Implementation Order

1. **Phase 1** first (1A–1F) — all UI polish, no new backend
2. **Phase 2A** — build `fill-rental-template` edge function
3. **Phase 2B** — wire auto-fill into signing flow
4. **Phase 2C** — email delivery (can be last, independent)

---

## What I'm NOT building (and why)

- **react-pdf**: Heavyweight dependency. The iframe handles PDF viewing fine including native pinch-to-zoom on iOS/Android.
- **"Lock mode"**: A tap-pattern unlock is a gimmick. The `beforeunload` + close confirmation covers the real risk.
- **Date range filter in Vault**: Phase 2 of search. Text search covering 5 lookup paths is sufficient for now.
- **HTML-to-PDF templates**: AcroForm fields with pdf-lib is lighter, preserves operator formatting exactly, and doesn't need a headless browser.
- **White-label logos**: Future feature. Hard-coding Exotiq logo for now.


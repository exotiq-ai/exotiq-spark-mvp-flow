

# CRM Upgrade: Edit Customer, Flexible Phone Validation, and Full-Feature CRM

## Problems Found

1. **Phone validation blocks booking submission** — The phone `970.555.1234` uses dots instead of dashes/spaces. The regex `^[\d\s\-\+\(\)]+$` rejects dots (`.`). The phone field is greyed out (`disabled={selectedCustomerId !== 'new'}`) so the operator can't fix it inline.

2. **No way to edit customer information** — `CustomerProfileDialog` is read-only. The `updateCustomer` function exists in FleetContext but is only used for toggling VIP/blacklist status. There's no edit form for name, email, phone, address, license, insurance, or DOB.

3. **No secondary/emergency contact fields** — Operators need emergency contacts for renters (standard in the industry).

---

## Phase 1: Fix the Immediate Blockers

### 1A. Fix Phone Validation
**File: `src/lib/validation.ts` (line 35)**

Current regex: `/^[\d\s\-\+\(\)]+$/` — rejects dots.

Fix: `/^[\d\s\-\+\(\)\.]+$/` — allow dots. This is a one-character fix that unblocks the user immediately.

### 1B. Make Customer Fields Editable During Booking
**File: `src/components/dialogs/NewBookingDialog.tsx` (lines 376-414)**

Current: All customer fields are `disabled={selectedCustomerId !== 'new'}`.

Change: Remove `disabled` from phone field (always editable). Keep name/email disabled for existing customers since those are identity fields, but phone numbers change frequently and operators need to override them per-booking.

Add a small helper text: "Phone can be updated for this booking" when an existing customer is selected.

---

## Phase 2: Edit Customer Dialog (Critical Missing Feature)

### 2A. Create `EditCustomerDialog.tsx`
**New file: `src/components/dialogs/EditCustomerDialog.tsx`**

A form dialog that mirrors `AddCustomerDialog` but pre-fills with existing customer data. Fields:
- Full Name, Email (identity — with confirmation if changed)
- Phone, Address, Date of Birth
- Driver's License + Expiry
- Insurance Provider, Policy Number, Insurance Expiry
- Notes
- Customer Status (Active/VIP — dropdown, not toggle)

Uses `updateCustomer` from FleetContext. Validates with existing validators. Shows success toast on save.

### 2B. Add Edit Button to CustomerProfileDialog
**File: `src/components/dialogs/CustomerProfileDialog.tsx`**

Add a `Pencil` icon button in the header next to the customer name, or an "Edit Customer" button in the Overview tab actions section. Opens `EditCustomerDialog` with the current customer data.

When the edit dialog saves successfully, the profile dialog should reflect the updated data (either via realtime subscription or by calling `refreshCustomers`).

---

## Phase 3: Emergency/Secondary Contact

### 3A. Database Migration
Add columns to the `customers` table:

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS secondary_phone text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
```

### 3B. Update UI Components
- **AddCustomerDialog**: Add optional "Emergency Contact" section with name + phone fields
- **EditCustomerDialog**: Include emergency contact fields
- **CustomerProfileDialog**: Display secondary phone and emergency contact in Contact Information section

---

## Phase 4: CRM Feature Completions for Daily SMB Use

### 4A. Customer Activity Timeline
**New component: `CustomerTimeline.tsx`**

Replace or augment the "Notes" tab in `CustomerProfileDialog` with a unified activity timeline that shows:
- Booking created/completed/cancelled events (pulled from bookings table)
- Payment received events (pulled from payments table)
- Notes added (existing customer_notes)
- Status changes (VIP, blacklisted)
- Documents signed (from documents table)

This gives operators a single chronological view of every interaction — the #1 feature real CRM operators use daily.

### 4B. Quick Actions from CRM List
**File: `src/components/dashboard/CRMSection.tsx`**

Add quick-action icons on each customer card (without opening the profile):
- Phone icon → click-to-call (`tel:` link)
- Email icon → click-to-email (`mailto:` link)
- Calendar icon → quick "New Booking" shortcut

### 4C. Customer Tags/Labels
**Database migration**: Add `tags text[]` column to customers table.

Allow operators to tag customers with labels like "Repeat", "Corporate", "Referral", "Cash Only", "Late Returns" — freeform tags that appear as badges on customer cards and can be filtered in the CRM list.

### 4D. Last Activity Date
**Computed field** shown on customer cards: "Last booking: 3 days ago" or "No bookings yet". Derived from the most recent booking's `start_date`. No new column needed — computed from the bookings join.

### 4E. CRM Export
Add an "Export" button to the CRM section header that exports the customer list as CSV using the existing `xlsx` package (already installed). Columns: Name, Email, Phone, Status, Total Bookings, Lifetime Value, Last Booking Date, Tags.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/validation.ts` | Modify | Add `.` to phone regex |
| `src/components/dialogs/NewBookingDialog.tsx` | Modify | Make phone editable for existing customers |
| `src/components/dialogs/EditCustomerDialog.tsx` | Create | Full edit form for customer profiles |
| `src/components/dialogs/CustomerProfileDialog.tsx` | Modify | Add Edit button, display emergency contact, activity timeline |
| `src/components/dialogs/AddCustomerDialog.tsx` | Modify | Add emergency contact fields |
| `src/components/dashboard/CRMSection.tsx` | Modify | Quick actions, last activity, export button, tag filters |
| Database migration | Create | Add secondary_phone, emergency_contact_name, emergency_contact_phone, tags columns |

## Implementation Order

1. **Phase 1** (1A + 1B) — unblocks the user immediately
2. **Phase 2** (2A + 2B) — critical missing feature, highest priority
3. **Phase 3** (3A + 3B) — emergency contacts, industry standard
4. **Phase 4** (4A–4E) — daily-use CRM features, can be done incrementally


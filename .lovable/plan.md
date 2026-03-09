

# Fix: Document Upload Fails Due to Database CHECK Constraint

## Root Cause

The `documents` table has a CHECK constraint (`documents_type_check`) that only allows these lowercase values:

```
'insurance', 'registration', 'license', 'contract', 'other'
```

Two problems:
1. **"Rental Agreement" is not in the constraint** -- so it's rejected outright
2. **Case mismatch** -- the UI sends capitalized values (`Insurance`, `Registration`) but the constraint expects lowercase. Existing documents were inserted with lowercase values, which is why they work. The `DocumentUploadDialog` uses capitalized `documentTypes` array, so any new upload from the dialog would also fail for non-rental-agreement types if the type wasn't already lowercase.

The "false flag" success toast the user sees is the **file upload to storage** succeeding (that happens first), then the **database insert** failing when the form is submitted with the type value.

## Fix

### 1. Database Migration: Update the CHECK constraint

Drop and recreate `documents_type_check` to include `rental_agreement` (and keep using lowercase, snake_case for consistency with existing data):

```sql
ALTER TABLE documents DROP CONSTRAINT documents_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_type_check 
  CHECK (type = ANY (ARRAY[
    'insurance', 'registration', 'license', 'contract', 
    'rental_agreement', 'inspection', 'other'
  ]));
```

Also adding `inspection` since that's a logical document type for this fleet app.

### 2. Code Fix: Normalize type values in DocumentUploadDialog

The `documentTypes` array in `DocumentUploadDialog.tsx` currently uses display-friendly capitalized strings as the actual stored values. Fix by mapping display labels to lowercase DB values:

```typescript
const documentTypes = [
  { label: 'Insurance', value: 'insurance' },
  { label: 'Registration', value: 'registration' },
  { label: 'License', value: 'license' },
  { label: 'Contract', value: 'contract' },
  { label: 'Inspection', value: 'inspection' },
  { label: 'Rental Agreement', value: 'rental_agreement' },
  { label: 'Other', value: 'other' },
];
```

Update `isRentalAgreement` check to use `type === 'rental_agreement'`.

### 3. Expiration Date Logic

Make expiration date optional for: `rental_agreement`, `contract`, `inspection`, `other`. Keep it required for: `insurance`, `registration`, `license` (these have real regulatory expiry dates).

### 4. VaultEnhanced Display

Update any display logic that shows `type` to render the human-friendly label (capitalize/format the stored value).

## Files to Change

| File | Change |
|------|--------|
| Database migration | Drop + recreate `documents_type_check` with new values |
| `DocumentUploadDialog.tsx` | Use label/value pairs for types, fix `isRentalAgreement` check, conditional expiry logic |
| `VaultEnhanced.tsx` | Format stored type values for display |
| `SigningCeremony.tsx` | Update type reference from `'Signed Rental Agreement'` to `'rental_agreement'` (signed docs) |

## "Set as Default" Toggle

Yes, the toggle IS built in the current `DocumentUploadDialog.tsx` code (lines showing `isRentalAgreement && <Switch>` block). It just never fires because the type check fails before the insert reaches the database. Once the constraint is fixed, the toggle will work.


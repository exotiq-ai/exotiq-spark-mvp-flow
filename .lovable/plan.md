
# Emergency Fix: Booking Import & CRM Data Flow

## Problem Diagnosis

Your booking import shows **0 imported, 1 skipped, 3 failed**. After deep investigation, I found **multiple root causes**:

### Root Cause 1: Database CHECK Constraint Rejects "active" Status
The `bookings` table has a CHECK constraint that only allows:
```sql
CHECK (status = ANY (ARRAY['pending', 'confirmed', 'completed', 'cancelled']))
```
But the import schema AND the app code reference `'active'` as a valid status. When a booking row has `status: 'active'`, the database rejects it.

### Root Cause 2: vehicles.current_rate is NOT NULL
When importing vehicles, the `current_rate` column is required but the import schema marks it as optional. Rows without rates fail.

### Root Cause 3: Vehicle Fields Missing from Database
The import template includes `color` and `mileage` fields, but these columns don't exist in the `vehicles` table, causing insert failures.

### Root Cause 4: Booking vehicle_name Not Stored
When importing bookings, we capture `vehicle_name` for matching, but the database doesn't have a `vehicle_name` column to store unmatched vehicle names.

### Root Cause 5: Email Required for Customer Auto-Creation
If a booking row has a customer name but no email, we can't auto-create a customer. Per your preference, we'll import the booking anyway and prompt later.

---

## Implementation Plan

### Phase 1: Database Schema Fixes

**Migration 1: Add missing vehicle columns**
```sql
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS mileage integer DEFAULT 0;
```

**Migration 2: Add vehicle_name to bookings**
```sql
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS vehicle_name text;
```

**Migration 3: Update booking status CHECK constraint**
```sql
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY['pending', 'confirmed', 'active', 'completed', 'cancelled']));
```

### Phase 2: Import Schema Fixes

**Update `src/lib/importSchemas.ts`:**

1. Update `vehicleImportValidation` to require `current_rate` with a default:
```typescript
current_rate: z.coerce.number().min(0).default(0)
```

2. Add `color` and `mileage` to vehicle validation

3. The booking status enum already includes 'active' so no change needed there

### Phase 3: ImportWizard Logic Fixes

**Update `src/components/import/ImportWizard.tsx`:**

1. **Store vehicle_name on bookings**: When inserting booking rows, include the `vehicle_name` field from the import data even when we can't match it to a vehicle_id

2. **Handle missing customer email gracefully**: If a booking row has no customer_email, skip the auto-create step but still import the booking (vehicle_id and customer_id will be null, vehicle_name stored as text)

3. **Show post-import prompt**: After import completes, if there are bookings with missing customer_id, show a message prompting the user to review and link customers manually

### Phase 4: Fix vehicles.current_rate default

**Add column default to database:**
```sql
ALTER TABLE vehicles 
ALTER COLUMN current_rate SET DEFAULT 0;
```

---

## Technical Details

### Updated performImport Logic

```text
For bookings import:
1. Run linkBookingsToExistingRecords() to match customer_email → customer_id and vehicle_name → vehicle_id
2. For each row:
   - If customer_email exists but no match found: auto-create customer
   - If customer_email missing: import anyway, customer_id = null
   - If vehicle_name exists but no match: vehicle_id = null, store vehicle_name text
   - Store all valid bookings
3. After import: show notification if some bookings need manual customer/vehicle linking
```

### Updated Vehicle Import Validation

```typescript
export const vehicleImportValidation = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().min(1900).max(2027),
  license_plate: z.string().optional().nullable(),
  vin: z.string().length(17).optional().nullable().or(z.literal('')),
  current_rate: z.coerce.number().min(0).default(0), // Now defaults to 0
  status: z.enum(['available', 'rented', 'maintenance', 'unavailable']).optional().default('available'),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),      // NEW
  mileage: z.coerce.number().min(0).optional().nullable() // NEW
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add color/mileage to vehicles, vehicle_name to bookings, update status constraint, add current_rate default |
| `src/lib/importSchemas.ts` | Update vehicle validation to include color/mileage and default current_rate |
| `src/components/import/ImportWizard.tsx` | Store vehicle_name on bookings, handle missing email gracefully, show post-import prompt |

---

## Testing After Implementation

1. **Vehicle import**: Upload a CSV with color/mileage columns → should import successfully
2. **Booking import with status=active**: Should insert without constraint violation
3. **Booking import without vehicle match**: Should store vehicle_name text, vehicle_id null
4. **Booking import without customer email**: Should import with customer_id null, show prompt
5. **CRM view**: Should show any auto-created customers from booking imports

---

## Expected Outcome

After these fixes:
- Booking imports will succeed even when vehicles/customers don't exist yet
- The `vehicle_name` text is preserved for later matching
- Customers are auto-created when email is provided
- Missing email cases are handled gracefully with post-import prompts
- Vehicle imports work with all template fields including color and mileage
- Your customers can onboard their CRM and Fleet data tomorrow without issues

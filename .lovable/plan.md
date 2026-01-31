

# Fix Critical Import Issues and Allow Incomplete Vehicle Data

## Problem Summary

Two major issues blocking vehicle imports:

1. **"Something went wrong" crash** - Radix UI Select components crash when receiving empty string values
2. **VIN validation too strict** - The import validation requires VIN to be exactly 17 characters, blocking uploads with missing or partial VIN data

The customer needs to upload fleet inventory CSV with missing VIN and license plate information, to be added later.

---

## Issues Found

### Issue 1: Select.Item Crashes (3 Components)

| File | Line | Problem |
|------|------|---------|
| `CreateVehicleTaskDialog.tsx` | 229 | `<SelectItem value="">Unassigned</SelectItem>` |
| `DynamicPricingCard.tsx` | 292 | `value={selectedVehicle \|\| ''}` |
| `ValidationPreview.tsx` | 172 | `value={String(editedData[error.field] \|\| '')}` |

Radix UI explicitly prohibits empty string values for Select.Item components.

### Issue 2: VIN Validation Too Strict

**File:** `src/lib/importSchemas.ts` (Line 489)

```typescript
vin: z.string().length(17, 'VIN must be exactly 17 characters').optional().nullable().or(z.literal(''))
```

The `.length(17)` validation runs even when VIN is provided but incomplete. This blocks:
- CSVs with partial VIN data
- CSVs with missing VIN columns
- Users who want to add VIN later

**File:** `src/lib/importUtils.ts` (Lines 409-414)

The suggestion helper also enforces the 17-character rule.

---

## Solution Plan

### Fix 1: CreateVehicleTaskDialog - Use Sentinel Value

**File:** `src/components/dialogs/CreateVehicleTaskDialog.tsx`

- Change `value=""` to `value="__unassigned__"`
- Update state handling to interpret `__unassigned__` as null/undefined

### Fix 2: DynamicPricingCard - Use Undefined

**File:** `src/components/dashboard/DynamicPricingCard.tsx`

- Change `value={selectedVehicle || ''}` to `value={selectedVehicle ?? undefined}`
- Use undefined instead of empty string for no selection

### Fix 3: ValidationPreview - Use Sentinel Value

**File:** `src/components/import/ValidationPreview.tsx`

- Add `__empty__` sentinel value for fields with missing data
- Transform on save to convert sentinel back to empty string

### Fix 4: Relax VIN Validation

**File:** `src/lib/importSchemas.ts`

Change line 489 from:
```typescript
vin: z.string().length(17, 'VIN must be exactly 17 characters').optional().nullable().or(z.literal(''))
```

To:
```typescript
vin: z.string()
  .max(17, 'VIN cannot exceed 17 characters')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform(val => val === '' ? null : val)
```

This allows:
- Empty VIN (to add later)
- Partial VIN (data entry in progress)
- Full 17-character VIN (validated)
- Prevents VIN longer than 17 characters (invalid)

### Fix 5: Update VIN Suggestion Helper

**File:** `src/lib/importUtils.ts`

Update lines 409-414 to give helpful suggestion instead of blocking error:
```typescript
if (field === 'vin' && value) {
  const strValue = String(value);
  if (strValue.length > 17) {
    return `VIN cannot exceed 17 characters (current: ${strValue.length})`;
  }
  if (strValue.length > 0 && strValue.length < 17) {
    return `VIN looks incomplete (${strValue.length}/17 characters) - you can complete it later`;
  }
}
```

### Fix 6: Onboarding Team Validation

**File:** `src/pages/Onboarding.tsx`

Add validation to ensure `currentTeam` exists before vehicle insert:
```typescript
if (!currentTeam?.id) {
  toast({
    title: "Error",
    description: "Team not found. Please refresh and try again.",
    variant: "destructive"
  });
  return;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dialogs/CreateVehicleTaskDialog.tsx` | Use `__unassigned__` sentinel instead of empty string |
| `src/components/dashboard/DynamicPricingCard.tsx` | Use `undefined` instead of empty string fallback |
| `src/components/import/ValidationPreview.tsx` | Use `__empty__` sentinel for empty field values |
| `src/lib/importSchemas.ts` | Change VIN from `.length(17)` to `.max(17)` |
| `src/lib/importUtils.ts` | Update VIN suggestion to be informational, not blocking |
| `src/pages/Onboarding.tsx` | Add team validation before vehicle insert |

---

## Validation Rules After Fix

| Field | Before | After |
|-------|--------|-------|
| VIN | Must be exactly 17 chars or empty | Can be empty, partial, or full (max 17) |
| License Plate | Optional | Optional (no change) |
| Daily Rate | Must be positive | Defaults to 0 if missing |

---

## Expected Outcome

After these fixes:

1. No more "Something went wrong" crashes related to Select components
2. Fleet CSV imports work with missing VIN/license plate data
3. Users can add VIN and plate information later via vehicle edit
4. Manual vehicle creation during onboarding saves correctly
5. Import wizard shows helpful info instead of blocking errors for incomplete VINs




# Fix: Vehicle Import Failing — 105/105 Rows Rejected

## Root Cause

The `year` column in the `vehicles` database table is `NOT NULL`, but most rows in the CSV have no year. The Zod validation schema (updated last session) correctly allows `null` for year, so **validation preview passes** — but then the actual database `INSERT` fails because Postgres rejects `year: null` on a NOT NULL column. The error is silently caught and counted as "failed."

This is a **schema mismatch** between the validation layer (allows null) and the database (forbids null).

## Fix (2 changes)

### 1. Database Migration: Make `year` nullable

```sql
ALTER TABLE public.vehicles ALTER COLUMN year DROP NOT NULL;
```

This is safe — year is genuinely optional for rental fleet imports (many operators don't track it). Existing rows with year values are unaffected.

### 2. Harden the import error logging

**File: `src/components/import/ImportWizard.tsx`** (line ~228-233)

Currently the insert error is silently swallowed:
```typescript
if (error) { failed += batch.length; }
```

Add `console.error` with the actual Supabase error so future failures are diagnosable:
```typescript
if (error) {
  console.error('[ImportWizard] Batch insert error:', error.message, error.details);
  failed += batch.length;
}
```

Also store the error in the `import_batches` record's `error_details` column so it shows in the import report.

### 3. Protect model field from numeric coercion (preventive)

**File: `src/lib/importUtils.ts`** — in `transformRows` (line ~407-417)

When a CSV cell contains `911`, PapaParse or XLSX may parse it as a number. The `model` field in Zod is `z.string().min(1)` — if the value arrives as `number 911` instead of `string "911"`, it could fail validation.

Add a safeguard: if the target field is `model`, `name`, `make`, `color`, or `location`, force-stringify the value:
```typescript
const stringFields = ['name', 'make', 'model', 'color', 'location', 'license_plate', 'vin'];
if (stringFields.includes(mapping.targetField) && value !== null) {
  value = String(value);
}
```

## Summary

| # | Change | Type | Risk |
|---|--------|------|------|
| 1 | Make `year` column nullable | DB migration | None — additive |
| 2 | Log insert errors to console + batch record | Code fix | None — debug improvement |
| 3 | Force-stringify text fields in transform | Code fix | None — defensive |

This will make the CSV from the screenshots import successfully.


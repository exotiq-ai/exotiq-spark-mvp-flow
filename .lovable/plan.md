

# Make Year/Status Optional + Add Post-Import Summary Download

## Two small, fast changes:

### 1. Make `year` and `status` optional in vehicle import validation
**File: `src/lib/importSchemas.ts`**
- Line 64: Change `required: true` → `required: false` for `year`
- Line 487: Change `z.coerce.number().min(1900)...` → add `.optional().nullable().default(null)` with a preprocess to handle empty strings
- Line 491: Add `'booked'` to the status enum, add `.nullable()` (it already has `.optional().default('available')`)

### 2. Add "Download Import Report" button to ImportSummary
**File: `src/components/import/ImportSummary.tsx`**
- Accept new optional props: `fileName?: string`, `columnMappings?: array`, `failedRows?: array`, `skippedRows?: array`
- Add a "Download Summary" button that generates a simple text/CSV report containing:
  - Date/time, file name, entity type
  - Fields mapped vs skipped (columns present vs not)
  - Row counts: imported, skipped, failed
  - List of failed rows with error reasons (if any)
- Uses the existing `downloadFile` pattern (Blob → link click) — no new dependencies

**File: `src/components/import/ImportWizard.tsx`**
- Pass the extra props (`fileName`, `columnMappings`, validation result details) through to `ImportSummary`

This is ~30 minutes of work — no database changes, no new components, just tweaking validation constants and adding one button with a blob download.


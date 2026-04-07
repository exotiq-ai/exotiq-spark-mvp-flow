

# Damage Claim Chain of Custody — Plan Review

## The plan is good. Two refinements worth making:

### 1. `inspection_id` is already missing from the shared schema — but it's also missing from the DB insert type

The shared `damageClaimSchema` in `validationSchemas.ts` (line 59-69) already has `booking_id` and `customer_id` but **not** `inspection_id`. The plan correctly identifies this gap. However, since `createDamageClaim` spreads `validated` data and the `damage_claims` table already has an `inspection_id` column, we just need to add it to the Zod schema. No DB migration needed — confirmed.

The internal Zod schema in `DamageReportDialog.tsx` (lines 16-40) is a **duplicate** that also lacks these fields. The plan should update both schemas, or better, have the dialog import the shared one. Given scope, updating both in parallel is the pragmatic call.

### 2. One small gap: `createDamageClaim` strips empty strings

The function does `damageClaimSchema.parse(claim)` then spreads. The schema uses `.optional().or(z.literal(''))` for `booking_id` and `customer_id` — meaning empty strings pass validation but get inserted as `''` into UUID columns, which will cause a Postgres type error. The prefill should pass `undefined` (not `''`) when IDs are absent. The plan should note this explicitly to avoid a subtle runtime bug.

### 3. Everything else checks out

- `inspectionId` is indeed scoped to `submitAll` (line 295) — lifting to state is correct
- The "File Damage Claim" button is `variant="outline" size="sm"` (line 800-804) — upgrading visual weight is correct
- `createDamageClaim` spreads validated data (line 1221) — adding `inspection_id` to the schema is sufficient, no FleetContext changes needed
- Severity mapping (`major` → `severe`) is needed since damage items use `major` but the DB enum is `minor|moderate|severe|total_loss`

## Updated Plan (with refinements)

### Files Changed

| File | Change |
|------|--------|
| `src/components/dialogs/CheckInOutDialog.tsx` | Lift `inspectionId` to state via `completedInspectionId`, enhance prefill with `booking_id`, `customer_id`, `inspection_id`, computed `severity`, make "File Damage Claim" button primary/destructive with damage count message |
| `src/components/dialogs/DamageReportDialog.tsx` | Extend prefill interface with `booking_id`, `customer_id`, `inspection_id`, `severity`; auto-select severity; show booking link banner; add fields to internal Zod schema; pass through to `createDamageClaim` — ensure `undefined` not `''` for empty optional UUIDs |
| `src/lib/validationSchemas.ts` | Add `inspection_id: z.string().uuid().optional().or(z.literal(''))` to shared `damageClaimSchema` |

### No changes needed

- **FleetContext.tsx** — `createDamageClaim` spreads validated data, works automatically
- **Database** — `damage_claims` table already has `booking_id`, `customer_id`, `inspection_id` columns
- **RLS** — existing policies are correct for this flow

### Risk

**Very low.** Three files, additive changes only. The main gotcha (empty string → UUID column error) is called out and handled.


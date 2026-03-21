

# Rate Tiers Implementation Plan — Final Review

## All 7 Advisory Suggestions: Accepted

Every suggestion from the code review is valid and incorporated below. Here's the rationale for each:

### Suggestion 1: Add RecordPaymentDialog.tsx — ACCEPTED
Confirmed: `calculateBookingTotal` is called in 4 files, not 3. `RecordPaymentDialog.tsx` (line 110) computes the financial breakdown for the payment modal. It must pass `durationType` to show the correct label ("3-Hour Rate" vs "Daily Rate x 3 days"). Added to scope.

### Suggestion 2: Make durationType optional with default — ACCEPTED
Critical for safe rollout. The parameter will be:
```typescript
durationType?: '3hr' | '6hr' | 'daily' | 'multiday'; // defaults to 'daily'
```
All 4 existing callers continue working untouched. Each gets updated individually.

### Suggestion 3: Types regeneration + local interfaces — ACCEPTED
After migration, Supabase types auto-regenerate. But there are **9+ local `Vehicle` interfaces** across the codebase (FleetVehicleCard, QuickPriceEditorDialog, QuickPriceEditorContent, EditVehicleDialog, CreateVehicleTaskDialog, PhotoReviewQueue, BulkUploadModal, PhotoHubTab, AddVehicleFromPhotoWizard). Only those that display or edit rates need updating — primarily FleetVehicleCard and EditVehicleDialog. The rest don't touch rate fields.

### Suggestion 4: Time picker Phase 1 documentation — ACCEPTED
Explicit note added: time picker is informational-only in Phase 1. UI will show "Vehicle reserved for the full day" when an hourly tier is selected.

### Suggestion 5: Document current_rate naming — ACCEPTED
A code comment will be added to `pricingUtils.ts` and the Vehicle type in `EditVehicleDialog.tsx` explaining `current_rate` = 24hr/daily rate, preserved for backwards compatibility.

### Suggestion 6: Hardcode multiday at 2+ days — ACCEPTED
Logic: `if rentalDays >= 2 && rate_multiday != null → use rate_multiday per day, else current_rate`. Hardcoded threshold, no team setting needed now.

### Suggestion 7: Fleet card single "View Rates" action — ACCEPTED
Cleaner UX. Replace "Edit Price" + "Manage All Rates" with a single "View Rates" action that opens a read-only rate summary popover/sheet with a "Manage in MotorIQ" link for manager+ users.

---

## Updated Implementation Plan

### Step 1: Database Migration

```sql
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS rate_3hr NUMERIC,
  ADD COLUMN IF NOT EXISTS rate_6hr NUMERIC,
  ADD COLUMN IF NOT EXISTS rate_multiday NUMERIC;

COMMENT ON COLUMN public.vehicles.rate_3hr IS 'Flat rate for 3-hour rentals. Null = not offered.';
COMMENT ON COLUMN public.vehicles.rate_6hr IS 'Flat rate for 6-hour rentals. Null = not offered.';
COMMENT ON COLUMN public.vehicles.rate_multiday IS 'Per-day rate for 2+ day rentals. Null = falls back to current_rate.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rental_duration_type TEXT DEFAULT 'daily';

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS min_rate NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS rental_buffer_minutes INTEGER DEFAULT 60;
```

### Step 2: Update `pricingUtils.ts`

- Add optional `durationType` param (defaults to `'daily'`)
- Add code comment documenting that `dailyRate` maps to `current_rate` (24hr tier)
- Pricing logic:
  - `3hr` or `6hr`: `rentalSubtotal = dailyRate` (flat, the tier rate is passed as `dailyRate`)
  - `daily`: `rentalSubtotal = dailyRate × 1`
  - `multiday`: `rentalSubtotal = dailyRate × rentalDays` (caller passes `rate_multiday || current_rate`)
- All downstream math (discount, gas, delivery) unchanged

### Step 3: Update Validation (`validationSchemas.ts`)

- Add `rental_duration_type` to bookingSchema as optional enum
- Add `rate_3hr`, `rate_6hr`, `rate_multiday` to vehicleSchema as optional positive numbers

### Step 4: MotorIQ "Rate Tiers" Tab

- New tab in `MotorIQEnhanced.tsx` alongside existing tabs
- New component: `RateTiersPanel.tsx` — editable table of all vehicles with 4 rate columns
- Permission-gated to manager for editing
- Validation: each rate must be >=    team's `min_rate`
- AI tabs completely untouched

### Step 5: NewBookingDialog Duration Selector

- Duration chips shown after vehicle selection (only tiers where rate is non-null)
- "24 Hours" always available (`current_rate`)
- "Multi-day" available when dates span 2+ days
- For 3hr/6hr: show time picker for start time, auto-calculate end time
- **Phase 1 note in UI**: "Vehicle reserved for the full day" banner when hourly tier selected
- Time values stored on booking for Phase 2 readiness but do NOT affect availability

### Step 6: Fleet Card — "View Rates" Action

- Remove "Edit Price" dropdown option
- Add single "View Rates" action → read-only rate summary (all set tiers)
- Manager+ users see "Manage in MotorIQ" link
- Tier badges shown on card: "3hr: $200 · 6hr: $350"

### Step 7: Update All `calculateBookingTotal` Callers

Each caller updated to pass `durationType` from booking data:

| File | Change |
|------|--------|
| `NewBookingDialog.tsx` | Pass selected duration type |
| `EnhancedBookingDialog.tsx` | Pass `booking.rental_duration_type` |
| `EditBookingDialog.tsx` | Pass + allow changing duration type |
| `RecordPaymentDialog.tsx` | Pass for correct payment breakdown labels |

All work without changes initially due to default `'daily'`.

### Step 8: Local Vehicle Interface Updates

| File | Needs rate fields? |
|------|-------------------|
| `FleetVehicleCard.tsx` | Yes — displays tier badges |
| `EditVehicleDialog.tsx` | Yes — edits rates |
| `QuickPriceEditorContent.tsx` | No — daily rate only |
| `QuickPriceEditorDialog.tsx` | No — daily rate only |
| `CreateVehicleTaskDialog.tsx` | No — no rate fields |
| Others (photos, maps) | No |

### Step 9: Team Settings — Rate Floor

- Add `min_rate` field to `TeamSettingsSection.tsx`
- Default $100, configurable by owner/admin
- Label: "Minimum rental rate" with helper text

---

## Files Changed (Complete)

| File | Action |
|------|--------|
| Migration SQL | 3 cols on vehicles, 1 on bookings, 2 on teams |
| `src/lib/pricingUtils.ts` | Add optional `durationType`, document `current_rate` naming |
| `src/lib/validationSchemas.ts` | Add tier rates + duration type |
| `src/components/dashboard/MotorIQEnhanced.tsx` | Add "Rate Tiers" tab |
| `src/components/dashboard/RateTiersPanel.tsx` | Create — editable rate table |
| `src/components/dialogs/NewBookingDialog.tsx` | Duration selector + time picker + "full day" note |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Pass `durationType` |
| `src/components/dialogs/EditBookingDialog.tsx` | Duration type editing + pass param |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Pass `durationType` for labels |
| `src/components/fleet/FleetVehicleCard.tsx` | Tier badges + "View Rates" action |
| `src/components/dialogs/EditVehicleDialog.tsx` | Add rate tier fields to interface |
| `src/components/dashboard/TeamSettingsSection.tsx` | Add min_rate config |

## Intentionally Not Touched

- AI pricing engine (stays 24hr-only)
- Availability/conflict detection (date-based, full-day blocks)
- Revenue reporting (`total_value` already computed correctly)
- QuickPriceEditor (stays daily-rate-only)
- Rari AI context

## Key Design Decisions Documented

- `current_rate` = 24hr/daily rate, not renamed (48+ references)
- `durationType` optional, defaults to `'daily'` — zero-risk rollout
- Multiday threshold: hardcoded at 2+ calendar days
- Phase 1 time picker: informational only, no availability impact
- Rate floor: team-level setting, not hardcoded


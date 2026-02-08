

# Comprehensive Payment Adjustments, Mileage Tracking, and Streamlined Check-In/Check-Out

This is a significant upgrade touching payments, vehicle pricing, and the rental lifecycle. Here's the full breakdown.

---

## Part 1: Enhanced Payment Collection Dialog

### Current State
The `RecordPaymentDialog` shows a basic booking summary (customer name, total value, email) with payment type/amount/method inputs. It lacks financial context for the tenant making the collection.

### What Changes

**Rich Booking Financial Summary** at the top of the payment dialog:
- Rental total (daily rate x days)
- Discount applied (amount + reason from `discount_amount` / `discount_reason`)
- Deposits already paid (queried from `payments` table)
- Security deposit held (from `security_deposit_amount` / `security_deposit_status`)
- Balance remaining (calculated: total - payments received)
- Mileage overage charges (if `return_odometer` - `pickup_odometer` > `mileage_limit`, calculated at `mileage_overage_fee` per mile)

**Adjustments Section** -- a collapsible "Add Charges" area where tenants can add line-item fees before recording payment:
- Toll fees (manual entry)
- Additional mileage (auto-calculated from odometer if available, or manual override)
- Fuel charges
- Late return fee
- Custom/other fee with description
- Each adjustment has a description + amount and gets stored in the payment `notes` field as structured data

The total amount field auto-updates as adjustments are added.

### Files Modified
| File | Change |
|------|--------|
| `src/components/dialogs/RecordPaymentDialog.tsx` | Complete redesign with financial summary, adjustments section, auto-calculation |

---

## Part 2: Vehicle Mileage Fee Configuration

### Current State
The database has `mileage_overage_fee` on bookings (defaults to $0.50/mile) and `mileage_limit` on bookings, but there's no UI for tenants to configure per-vehicle mileage rates or default included miles.

### What Changes

**New columns on `vehicles` table** (via migration):
- `default_mileage_limit` (integer) -- included miles per rental day (e.g., 250 miles/day)
- `mileage_overage_rate` (numeric) -- per-mile charge when exceeded (e.g., $1.50/mile)

**Vehicle Settings in Fleet module**: Add mileage configuration fields to the vehicle details/edit UI so tenants can set per-vehicle:
- Included miles per day
- Overage rate per mile

**Booking Auto-Population**: When creating a booking, auto-populate `mileage_limit` (vehicle's `default_mileage_limit` x rental days) and `mileage_overage_fee` from the assigned vehicle's settings.

**Mileage Calculation in Payment Dialog**: When both `pickup_odometer` and `return_odometer` are recorded (from inspections), automatically calculate:
- Miles driven = return_odometer - pickup_odometer
- Included miles = mileage_limit
- Overage = max(0, miles_driven - included_miles)
- Overage charge = overage x mileage_overage_fee

### Files Modified
| File | Change |
|------|--------|
| SQL Migration | Add `default_mileage_limit`, `mileage_overage_rate` to vehicles |
| `src/components/dialogs/VehicleDetailsDialog.tsx` | Add mileage config fields |
| `src/components/dialogs/AddVehicleDialog.tsx` | Add mileage defaults on creation |
| `src/components/dialogs/NewBookingDialog.tsx` | Auto-populate mileage fields from vehicle |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Auto-calculate mileage charges |

---

## Part 3: Streamlined Check-In / Check-Out Module

### Current State
The existing `InspectionWidget` is a full guided photo capture wizard with 11 photo angles + damage documentation + checklist. It's thorough but heavy -- tenants need a fast path for day-to-day operations. The ops status pipeline (`useVehicleOpsStatus.ts`) already has `check_out_ready` -> `renter_has` -> `check_in_required` -> `pending_inspection` states.

### What Changes

**New `CheckInOutDialog` component** -- a streamlined, single-screen dialog that covers the essentials:

**Check-Out Flow (vehicle going to renter):**
1. Confirm vehicle + booking + customer
2. Record odometer reading (required) -- saves to `booking.pickup_odometer` and updates `vehicle.mileage`
3. Record fuel level (slider, required) -- saves to `booking.pickup_fuel_level`
4. Quick condition note (optional text)
5. Photo capture (optional -- "Skip" or "Take Photos" which opens the existing guided wizard)
6. Collect deposit if not yet paid (quick link to payment dialog)
7. "Complete Check-Out" button: updates booking status to `active`, vehicle ops_status to `renter_has`, saves odometer/fuel

**Check-In Flow (vehicle returning from renter):**
1. Confirm vehicle + booking + customer
2. Record odometer reading (required) -- saves to `booking.return_odometer` and updates `vehicle.mileage`
3. Record fuel level (slider, required) -- saves to `booking.return_fuel_level`
4. Auto-calculate mileage overage (if `return_odometer - pickup_odometer > mileage_limit`)
5. Quick condition note + damage flag (checkbox: "Any new damage?" -> opens damage capture)
6. Photo capture (optional)
7. Show final charges summary: overage fees, fuel difference, any damage
8. "Complete Check-In" button: updates booking status to `completed`, vehicle ops_status to `check_in_required`, saves data

**Historical Support**: Both flows accept a manual date/time override so tenants can back-date check-ins/check-outs for historical bookings. A "Set Date Manually" toggle reveals date/time pickers.

**Integration Points**:
- Accessible from the `EnhancedBookingDialog` as new action buttons ("Check Out Vehicle" / "Check In Vehicle") based on booking status
- Accessible from the Fleet ops status board
- Updates booking, vehicle, and triggers `refreshData()`
- After check-in, auto-prompts for final payment collection if balance > 0

### Files Created/Modified
| File | Change |
|------|--------|
| `src/components/dialogs/CheckInOutDialog.tsx` | New streamlined check-in/check-out dialog |
| `src/components/dialogs/EnhancedBookingDialog.tsx` | Add Check-Out / Check-In action buttons |
| `src/contexts/FleetContext.tsx` | Add `checkOutVehicle` and `checkInVehicle` actions |

---

## Part 4: Integration and Data Integrity

All new features connect to existing systems:

- **Payment dialog** reads from `payments` table for history, `bookings` for financial fields
- **Mileage calculation** flows from vehicle config -> booking creation -> inspection odometer -> payment adjustment
- **Check-in/out** updates `bookings` (status, odometer, fuel), `vehicles` (mileage, ops_status), and triggers notifications via existing triggers
- **refreshData(true)** called after every mutation to keep all views in sync
- No breaking changes to existing booking, payment, or inspection flows

### Database Migration Summary
```
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS default_mileage_limit integer DEFAULT 250,
ADD COLUMN IF NOT EXISTS mileage_overage_rate numeric DEFAULT 1.50;
```

---

## Suggested Improvements Beyond the Request

1. **Fuel charge calculation**: If check-out fuel was 100% and check-in fuel is 75%, auto-calculate a fuel surcharge based on estimated tank size (configurable per vehicle)
2. **Digital signature capture**: Add a signature pad at check-out for the rental agreement acknowledgment
3. **SMS/email receipt**: After check-in completion with final charges, auto-send a receipt to the customer

These are noted for future iterations -- not included in this build to keep scope focused and stable for your live onboarding.

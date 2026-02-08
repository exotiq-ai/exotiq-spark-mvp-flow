

# Enhance Booking Details in Customer Profile Dialog

## Problem

In the Customer Profile dialog's Bookings tab, each booking row only shows 4 fields: pickup location, status, start date, and total value. Key information like the vehicle, return date, duration, daily rate, payment status, and notes are missing.

## Solution

Expand each booking row in `src/components/dialogs/CustomerProfileDialog.tsx` (lines 278-298) into a detailed card showing all relevant booking information from the database.

### Updated Booking Card Layout

Each booking card will display:

| Row | Left | Right |
|-----|------|-------|
| **Header** | Vehicle name (or "No Vehicle Assigned") | Status badge |
| **Dates** | Start date - End date (duration in days) | |
| **Location** | Pickup location -> Dropoff location | |
| **Pricing** | Daily rate x days | Total value |
| **Payment** | Payment status badge | |
| **Notes** | Booking notes (if any) | |

### Click Behavior

Clicking a booking card will open the `EnhancedBookingDialog` for full management (change vehicle, adjust dates, take payment, etc.), consistent with the app's existing navigation patterns.

### File: `src/components/dialogs/CustomerProfileDialog.tsx`

1. Import `EnhancedBookingDialog` and add state for `selectedBooking`
2. Replace the minimal booking rows (lines 278-298) with expanded cards showing:
   - **Vehicle**: `booking.vehicle_name` with fallback text
   - **Dates**: `start_date` to `end_date` with calculated duration
   - **Locations**: `pickup_location` and `dropoff_location` (if different)
   - **Pricing**: `daily_rate` per day, `total_value`
   - **Payment status**: `payment_status` badge (paid/partial/unpaid)
   - **Delivery**: delivery address and fee if `requires_delivery` is true
   - **Notes**: `booking.notes` (truncated, expandable)
3. Add click handler to open `EnhancedBookingDialog` for the clicked booking
4. Import `useLocationFilteredFleet` to access `vehicles` for resolving vehicle details

### Visual Design

- Cards use the existing `bg-muted/30 border border-primary/10 rounded-lg` style
- Vehicle name is prominent at top left
- Dates shown with calendar icon, duration calculated as badge
- Financial details in a subtle row at bottom
- Hover state indicates clickability (`cursor-pointer hover:border-primary/30`)

## Files Changed

| File | Change |
|------|--------|
| `src/components/dialogs/CustomerProfileDialog.tsx` | Expand booking rows with full details + click-to-open behavior |

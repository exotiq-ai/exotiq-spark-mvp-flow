

# Clickable Customer Names Throughout the App

## Overview

Make customer names interactive across all modules. In schedule/calendar contexts, clicking opens the booking details dialog. In all other contexts (CRM, Payments, Pending Approval), clicking navigates to the customer's CRM profile.

---

## Locations to Update

### 1. Today's Schedule (BookEnhanced.tsx, line 508-510)

**Context:** Schedule view -- clicking the customer name should open the booking details dialog (same as clicking "View" on a booking).

**Current code:** Plain text `{booking.customer_name}`

**Change:** Wrap in a clickable span that calls `setSelectedBooking(booking)` + `setShowBookingDetails(true)`, same as the existing "View" button logic. Style with `cursor-pointer hover:text-primary transition-colors text-primary/80 underline-offset-2 hover:underline`.

### 2. Next Pickup Card (BookEnhanced.tsx, line 377)

**Context:** Schedule-adjacent -- clicking opens booking details.

**Change:** Same pattern as Today's Schedule. Make the customer name a clickable span that opens the booking dialog for `nextBooking`.

### 3. Pending Approval Section (BookEnhanced.tsx, line 307)

**Context:** Administrative list -- clicking should navigate to customer CRM profile (if `customer_id` exists).

**Change:** Wrap `{booking.customer_name}` in a clickable span that calls `goToCustomerProfile(booking.customer_id)` when `customer_id` is present. Show a subtle link style only when clickable.

### 4. Payment Tracker (PaymentTracker.tsx, line 179)

**Context:** Financial view -- clicking should navigate to customer CRM profile.

**Change:** Wrap `{booking.customer_name}` in a clickable span. Import and use `useModuleNavigation` to call `goToCustomerProfile(booking.customer_id)`.

### 5. Upcoming Schedule Widget (UpcomingScheduleWidget.tsx, line 70)

**Context:** Dashboard schedule widget -- clicking should navigate to the booking in the calendar (using `goToBookingDetails`).

**Change:** Make customer name clickable via `goToBookingDetails(booking.id)`. Import `useModuleNavigation`.

### 6. Calendar Hover Card (BookingCalendar.tsx, line 86)

**Context:** Calendar popup -- clicking should navigate to customer CRM profile.

**Change:** Wrap `{booking.customer_name}` in a clickable span that navigates to the CRM via search params. Use `useSearchParams` (already imported in BookingCalendar).

### 7. Calendar Day Panel (BookingCalendar.tsx, line 565)

**Context:** Calendar detail panel -- same as above, navigate to CRM profile.

**Change:** Make the customer name text clickable with CRM navigation.

---

## Interaction Pattern

| Area | Click Action | Rationale |
|------|-------------|-----------|
| Today's Schedule | Open booking details dialog | User is reviewing today's operations |
| Next Pickup card | Open booking details dialog | User wants details on this specific booking |
| Pending Approval | Navigate to CRM profile | User needs to verify customer before approving |
| Payment Tracker | Navigate to CRM profile | User may need customer contact info for collections |
| Dashboard Schedule Widget | Navigate to booking | Quick access from dashboard overview |
| Calendar hover/panel | Navigate to CRM profile | User already sees booking context, needs customer info |

## Styling

All clickable customer names will use a consistent style:
- `cursor-pointer` for the pointer cursor
- `hover:text-primary` for color change on hover
- `transition-colors` for smooth effect
- Only styled as clickable when a valid `customer_id` exists (graceful degradation for unlinked bookings)

## Files Changed

| File | Changes |
|------|---------|
| `src/components/dashboard/BookEnhanced.tsx` | Make customer names clickable in Today's Schedule, Next Pickup, Pending Approval |
| `src/components/dashboard/PaymentTracker.tsx` | Make customer names clickable to CRM |
| `src/components/dashboard/UpcomingScheduleWidget.tsx` | Make customer names clickable to booking details |
| `src/components/dashboard/BookingCalendar.tsx` | Make customer names clickable to CRM in hover card and day panel |

## Risk

None. All changes are purely UI -- adding click handlers and hover styles to existing text elements. No data flow or database changes.




# Deep Dive: Booking Calendar -- Findings and Fix Plan

## Is It Set Up for Live Data?

**Yes, the plumbing is there.** The calendar reads from `useLocationFilteredFleet()` which pulls from `FleetContext`. FleetContext has a realtime Postgres subscription on the `bookings` table that triggers a debounced refresh within 500ms of any INSERT/UPDATE/DELETE. So when a booking is created anywhere -- CRM, booking dialog, import -- the calendar SHOULD update automatically.

## The Fundamental Bug

There is a **critical filtering bug on line 221-228** of `BookingCalendar.tsx`. The current filter logic:

```text
isWithinInterval(monthStart, { start: bookingStart, end: bookingEnd }) ||
isWithinInterval(monthEnd, { start: bookingStart, end: bookingEnd }) ||
(bookingStart <= monthStart && bookingEnd >= monthEnd)
```

This checks three cases:
1. Does the month's first day fall within the booking? (multi-week bookings spanning month start)
2. Does the month's last day fall within the booking? (multi-week bookings spanning month end)
3. Does the booking span the entire month?

**What it MISSES**: Bookings that start AND end within the same month -- which is the vast majority of bookings (e.g., Feb 5-8). These bookings don't contain `monthStart` or `monthEnd`, so they get filtered out.

This is likely why bookings appear to be "missing" from the calendar.

## Other Issues Found

### Google Calendar Button (line 328-337)
The "Google" button only opens **one booking** (the first in the filtered list) as a Google Calendar event. It does not sync the calendar -- it just opens a pre-filled Google Calendar URL for a single event. Not useful.

### ICS Export (calendarExport.ts line 86)
The `bookingsToCalendarEvents` function accepts a `vehicleMap` parameter but **never uses it**. Event titles say "Rental: [Customer Name]" instead of including the vehicle name, which is what the tenant needs to see on their external calendar.

## The Plan

### 1. Fix the Month Filter (BookingCalendar.tsx)

Replace the broken 3-condition filter with a simple overlap check:

```text
A booking overlaps a month if:
  bookingStart <= monthEnd AND bookingEnd >= monthStart
```

This single condition catches ALL cases: bookings within the month, spanning the start, spanning the end, or spanning the entire month.

### 2. Fix ICS Export to Include Vehicle Names (calendarExport.ts)

Update `bookingsToCalendarEvents` to actually use the `vehicleMap`:
- Title: "[Vehicle Name] - [Customer Name]" instead of "Rental: [Customer Name]"
- Description: Include booking dates, total value, pickup location, and notes

### 3. Fix Google Calendar Button (BookingCalendar.tsx)

Change the Google Calendar button from opening a single booking to exporting ALL filtered bookings as an ICS file that can be imported into Google Calendar. The current single-event URL approach is not practical.

Add a dropdown with two options:
- **Export .ics** -- downloads a file that can be imported into any calendar app
- **Add to Google Calendar** -- opens Google Calendar's import page with instructions

### 4. Google Calendar Two-Way Sync -- What Would Be Needed

For a real one-way sync (push bookings to Google Calendar automatically), we would need:

- **Google Calendar connector** via the gateway (`https://gateway.lovable.dev/google_calendar/calendar/v3`)
- A backend function that creates/updates/deletes Google Calendar events when bookings change
- **Field mapping**: Booking `start_date` / `end_date` to event times, `customer_name` + vehicle name to event title, `pickup_location` to event location, `total_value` + `notes` to event description
- **Sync tracking**: A `google_calendar_event_id` column on the bookings table to track which bookings have been synced and avoid duplicates

This is achievable but requires connecting the Google Calendar connector first. For now, the ICS export approach covers the use case without OAuth complexity.

## Technical Details

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookingCalendar.tsx` | Fix month filter logic (line 221-228). Replace Google Calendar single-event button with ICS export dropdown. |
| `src/lib/calendarExport.ts` | Fix `bookingsToCalendarEvents` to use `vehicleMap` for vehicle names in event titles. Enrich event descriptions with booking details. |

### Filter Fix (BookingCalendar.tsx, lines 221-228)

Replace the current 3-condition check with:
```text
const filteredBookings = bookings.filter(booking => {
  if (selectedVehicle !== "all" && booking.vehicle_id !== selectedVehicle) return false;
  const bookingStart = new Date(booking.start_date);
  const bookingEnd = new Date(booking.end_date);
  // Simple overlap: booking overlaps month if it starts before month ends AND ends after month starts
  return bookingStart <= monthEnd && bookingEnd >= monthStart;
});
```

### ICS Fix (calendarExport.ts, lines 86-93)

```text
return bookings.map((booking) => {
  const vehicleName = vehicleMap[booking.vehicle_id] || '';
  return {
    uid: booking.id,
    title: vehicleName ? `${vehicleName} - ${booking.customer_name}` : `Rental: ${booking.customer_name}`,
    description: [
      `Customer: ${booking.customer_name}`,
      `Location: ${booking.pickup_location}`,
      booking.notes || '',
    ].filter(Boolean).join('\n'),
    location: booking.pickup_location,
    startDate: new Date(booking.start_date),
    endDate: new Date(booking.end_date),
  };
});
```

### What This Fixes

- Bookings that start and end within the same month now appear on the calendar
- ICS exports include vehicle names so the tenant knows which car each event is for
- Google Calendar integration provides a practical export path instead of a single-event URL
- All existing features (click for details, hover preview, split-view panel, realtime updates, conflict detection) remain unchanged

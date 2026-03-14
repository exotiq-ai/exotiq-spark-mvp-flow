

# Fix: Same-Day / Hourly Bookings Not Appearing on Calendar

## Root Cause

The calendar's `getBookingsForDayStatic` function (line 730-736 in `BookingCalendar.tsx`) compares a midnight `Date` object against booking timestamps that include time-of-day:

```ts
// day = March 14 00:00:00
// bookingStart = March 14 10:00:00, bookingEnd = March 14 13:00:00
return day >= bookingStart && day <= bookingEnd;
// → false, because midnight < 10am
```

A 3-hour booking (e.g., 10am–1pm) on a single day **never appears on the calendar** because the day cell's midnight timestamp fails both comparisons.

## Fix

### `src/components/dashboard/BookingCalendar.tsx` — `getBookingsForDayStatic`

Normalize all three dates to calendar-day boundaries so time-of-day is irrelevant:

```ts
function getBookingsForDayStatic(filteredBookings: any[], day: Date) {
  const dayStart = startOfDay(day);
  return filteredBookings.filter(booking => {
    const bookingStart = startOfDay(new Date(booking.start_date));
    const bookingEnd = startOfDay(new Date(booking.end_date));
    return dayStart >= bookingStart && dayStart <= bookingEnd;
  });
}
```

`startOfDay` is already imported from `date-fns` in the file. This ensures a booking from 10am–1pm on March 14 maps to the March 14 cell (both start and end normalize to midnight March 14, and the day cell is also midnight March 14 → match).

**One file, one function, ~3 lines changed.** No impact on pricing (which already uses `Math.max(1, …)` for minimum 1-day billing) or any other filtering logic (BookEnhanced and UpcomingScheduleWidget already handle same-day correctly).


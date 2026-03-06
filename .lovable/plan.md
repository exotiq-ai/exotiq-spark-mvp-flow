

# Fix: Gregory Ringler $1M Test Booking

## The Problem

The Feb 9 spike is caused by a **single test booking** from Gregory Ringler:

| Field | Value |
|-------|-------|
| Customer | Gregory Ringler |
| Total Value | $1,000,000 |
| Daily Rate | $799 |
| Start Date | 2026-02-10 UTC (shows as Feb 9 in your timezone) |
| End Date | 2026-02-08 (before start — invalid) |
| Vehicle | None assigned |
| Created | Jan 31, 2026 |

He has a second identical $1M booking from 2025 (status: pending) that's also bad data. Both were created on Jan 31 during early testing — $799/day rate with a $1M total value is clearly a data entry error.

## Fix

Delete both Gregory Ringler bookings and any associated payments via a database migration. This is the same surgical cleanup approach we just used — exact name match, 2 records only.

```sql
DELETE FROM payments WHERE booking_id IN (
  SELECT id FROM bookings WHERE customer_name = 'Gregory Ringler'
);
DELETE FROM bookings WHERE customer_name = 'Gregory Ringler';
```

After this, the Feb 9 spike disappears and the chart will show accurate revenue figures.


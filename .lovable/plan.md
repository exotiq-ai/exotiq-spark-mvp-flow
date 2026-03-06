

# Revenue Chart Data Mismatch — Root Cause & Fix

## The Problem

The revenue chart shows **$0 for March 5** despite there being bookings worth **$47,200** visible in the calendar for that day. This is caused by two compounding issues:

### Issue 1: Wrong Data Source
The chart (`useChartData.ts`) calculates daily revenue from the **payments table** (`transaction_date`), while the calendar and booking views show **booking `total_value`** by `start_date`. These are fundamentally different numbers:
- Payments for March 5: only $5,900 (2 payment records)
- Bookings starting March 5: $47,200 (from calendar view)

The RevenueWidget header also mixes approaches — "Total Revenue" counts only `completed` bookings' `total_value`, while the chart underneath sums payments. This creates visual inconsistency.

### Issue 2: Timezone Bug
Even the $5,900 in payments may not show correctly. The chart generates date strings using `new Date().toISOString().split('T')[0]` which converts local time to UTC, potentially shifting dates by a day. For example, at 8pm EST on March 5, `toISOString()` returns `2026-03-06T01:00:00Z`, making the date string "2026-03-06" instead of "2026-03-05".

## The Fix

### `src/hooks/useChartData.ts` — Use booking revenue instead of payments

Change the revenue calculation to use **booking `total_value` by `start_date`** for `confirmed` and `completed` bookings. This aligns with the calendar view and makes the chart meaningful for fleet operators (booked revenue per day, not just cash collected).

Also fix the timezone issue by using local date formatting (`toLocaleDateString` with `en-CA` for YYYY-MM-DD) instead of `toISOString()`.

```typescript
// Revenue = sum of booking total_value for confirmed/completed bookings starting on this date
const dayBookings = bookings.filter(b => {
  const startDate = new Date(b.start_date);
  const localDate = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
  return localDate === dateStr && (b.status === 'confirmed' || b.status === 'completed');
});
const dayRevenue = dayBookings.reduce((sum, b) => sum + (b.total_value || 0), 0);
```

The `payments` parameter can remain for future use but won't drive the chart revenue anymore.

### `src/components/dashboard/widgets/RevenueWidget.tsx` — Align "Total Revenue"

Update the total revenue calculation to include both `completed` AND `confirmed` bookings (currently only counts `completed`), matching the chart's data source.

## Impact

- Revenue chart will show booking-based revenue per day, matching the calendar view
- March 5 will correctly show $47,200 (the two confirmed bookings)
- Timezone-safe date comparisons throughout
- Consistent metric definitions across dashboard, chart, and calendar

| File | Change |
|------|--------|
| `src/hooks/useChartData.ts` | Revenue from bookings instead of payments; fix timezone |
| `src/components/dashboard/widgets/RevenueWidget.tsx` | Include confirmed bookings in total revenue |


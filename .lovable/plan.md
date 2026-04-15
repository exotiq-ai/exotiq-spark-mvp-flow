

# Fix: MotorIQ Weekly Revenue — Use Rental Date, Not Record Creation Date

## Problem
"Total Fleet Revenue — This week" shows $0 because it filters on `created_at` (when the database row was inserted). Your bookings were bulk-created weeks ago, so nothing falls in the current week by that field. Revenue should reflect when the rental actually happens (`start_date`).

## Change

**File: `src/components/dashboard/MotorIQEnhanced.tsx`**

Update the `bookingsWithDates` mapping (~line 60-65):
- Pass `start_date` as the date field instead of `created_at`
- Include `confirmed` bookings (currently only counts `completed` and `active`, but most of your data is `confirmed`)

```ts
// Before
.filter(b => b.status === 'completed' || b.status === 'active')
.map(b => ({ created_at: b.created_at, total_value: ... }));

// After
.filter(b => b.status === 'completed' || b.status === 'confirmed' || b.status === 'active')
.map(b => ({ created_at: b.start_date, total_value: Number(b.total_value) || 0 }));
```

No other files need changes — the `useRevenueGrowth` hook logic is correct, it just needs the right date fed in.


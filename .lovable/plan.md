

# Revenue Cleanup & Booked vs Collected Toggle

## What Gets Deleted (safe to remove)

These are **exact-name matches** — none overlap with your real customers:

| Test Name (exact) | Bookings | Revenue | Created |
|---|---|---|---|
| Marcus Wellington | 803 | $6.3M | Nov 2025 |
| Grace Mitchell | 753 | $7.6M | Nov 2025 |
| Sophia Rossi | 705 | $5.4M | Nov 2025 |
| Andrew Sullivan | 583 | $4.5M | Nov 2025 |
| Liam Wilson | 552 | $4.4M | Oct 2025 |
| Michael Thornton | 408 | $4.9M | Nov 2025 |
| Mason Walker | 252 | $1.9M | Jan 2026 |
| **Total** | **4,056** | **$35M** | |

Plus 4,090 associated payment records.

## What Stays (untouched)

**415 bookings ($6.6M)** including:
- 109 realistic demo bookings created today ($970K)
- 306 historical bookings from real-feeling customers
- "Marcus Wellington **III**" (27 bookings, $807K) — different name, safe
- All VIP customers, event bookings, Prestige Concierge, etc.

## Plan (3 parts)

### 1. Delete test data via database
Delete payments first (foreign key), then bookings. Uses exact `customer_name` match — no wildcards.

### 2. Add Booked vs Collected toggle
**`useChartData.ts`**: Add `collectedData` array that sums payment `amount` by `transaction_date` (local timezone). Return both datasets.

**`RevenueLineChart.tsx`**: Add a "Booked / Collected" toggle badge next to Compare. When "Collected" is selected, swap the chart data source and update the tooltip label. Different color for collected (blue vs green).

### 3. Label consistency
**`Pulse.tsx` line 58** and **`TodaySnapshot.tsx` line 73**: Change "Revenue Today" → "Collected Today" since both read from the payments table.

| File | Change |
|------|--------|
| Database | Delete 4,056 test bookings + 4,090 test payments |
| `useChartData.ts` | Add `collectedData` from payments |
| `RevenueLineChart.tsx` | Booked/Collected toggle |
| `Pulse.tsx` | Label → "Collected Today" |
| `TodaySnapshot.tsx` | Label → "Collected Today" |


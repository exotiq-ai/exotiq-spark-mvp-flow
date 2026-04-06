

# Fix CRM Lifetime Value Calculation

## Problem
The `update_customer_stats()` trigger only counts revenue from `status = 'completed'` bookings. All other revenue-generating statuses (`confirmed`, `active`, `checked_in`, `checked_out`) are excluded, causing $0 lifetime values.

## Changes

### 1. Migration: Update trigger function
Replace the trigger to use `status NOT IN ('cancelled', 'pending')` instead of `status = 'completed'`.

### 2. Migration: Backfill existing data
Run a one-time UPDATE on the `customers` table to recalculate `lifetime_value` and `total_bookings` for all existing rows.

Both statements go in a single migration. No application code changes needed — the trigger fires automatically on booking inserts/updates, and the UI already reads `lifetime_value` from the customers table.

## Files Changed

| File | Change |
|------|--------|
| Database migration | `CREATE OR REPLACE FUNCTION update_customer_stats()` + backfill UPDATE |


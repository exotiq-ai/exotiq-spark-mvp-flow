
# Fix Rari Real-Time Data Access

## Problem Summary

Rari is experiencing **two critical failures**:

1. **Database Query Broken**: All booking queries fail with error `column vehicles_1.vehicle_name does not exist`
2. **Wrong Date Context**: Rari shows "June 2025" dates because the AI agent doesn't receive the current date

---

## Root Causes

### Issue 1: Schema Mismatch in `get_bookings`

The edge function queries:
```sql
vehicles(vehicle_name, make, model, year, location)
```

But the `vehicles` table has column `name`, NOT `vehicle_name`:

| Table | Column | Actual Value |
|-------|--------|--------------|
| `vehicles` | `name` | ✅ Exists |
| `vehicles` | `vehicle_name` | ❌ Does NOT exist |

This causes PostgreSQL error `42703` and **ALL booking-related tools return errors**.

### Issue 2: No Current Date Passed to ElevenLabs

The `dynamicVariables` sent to ElevenLabs (line 264-280 in `RariVoiceInterface.tsx`) include:
- `user_id` ✅
- `team_id` ✅  
- `user_name` ✅
- `current_date` ❌ **MISSING**

Without the current date, the ElevenLabs AI has no way to know what "today" means and hallucinates dates.

---

## Solution

### Fix 1: Update Database Queries

**File: `supabase/functions/elevenlabs-tools/index.ts`**

Change all occurrences of `vehicle_name` in the select query to `name`:

```typescript
// Line 727 - get_bookings
// BEFORE:
.select('*, vehicles(vehicle_name, make, model, year, location), customers(...)');
// AFTER:
.select('*, vehicles(name, make, model, year, location), customers(...)');

// Line 805 - get_recent_activity  
// BEFORE:
.select('*, vehicles(vehicle_name, make, model, year, location), customers(...)');
// AFTER:
.select('*, vehicles(name, make, model, year, location), customers(...)');
```

Also update any references to `b.vehicles?.vehicle_name` to use `b.vehicles?.name`.

### Fix 2: Pass Current Date as Dynamic Variable

**File: `src/components/rari/RariVoiceInterface.tsx`**

Add current date to dynamic variables:

```typescript
// Around line 278
dynamicVariables['current_date'] = new Date().toISOString().split('T')[0]; // "2026-01-31"
dynamicVariables['current_datetime'] = new Date().toLocaleString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long', 
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short'
}); // "Friday, January 31, 2026, 12:15 AM EST"
```

**Note**: The ElevenLabs agent configuration must also reference `{{current_date}}` or `{{current_datetime}}` in its system prompt for this to take effect. If the agent prompt doesn't reference these variables, they won't be used.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/elevenlabs-tools/index.ts` | Fix `vehicle_name` → `name` in SELECT queries (lines 727, 805+) |
| `src/components/rari/RariVoiceInterface.tsx` | Add `current_date` and `current_datetime` to dynamic variables |

---

## Expected Results After Fix

1. **Booking queries work**: `get_bookings` returns real March 2026 bookings
2. **Correct dates**: Rari says "Today (January 31st, 2026)" instead of "June 20th, 2025"
3. **Real data access**: All fleet metrics, vehicle info, and booking data flow correctly

---

## Testing Plan

1. Deploy the edge function fix
2. Start a Rari conversation
3. Ask "What are my upcoming bookings?"
4. Verify console shows successful query (no `42703` error)
5. Verify Rari speaks the correct current date and real booking data

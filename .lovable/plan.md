# Fix Demand Forecast "Invalid time value" crash

## Problem
`DemandForecastCard.tsx` (rendered inside MotorIQEnhanced) calls `format(new Date(x), ...)` on AI-returned `pred.date`, `event.date`, and `opp.date` values. When the AI returns a missing/malformed date string, `new Date(x)` becomes `Invalid Date` and date-fns `format()` throws `RangeError: Invalid time value`, which the ErrorBoundary catches and blanks the whole MotorIQ panel.

Stack confirms: `Kt` (date-fns format) → `Array.map` inside MotorIQEnhanced bundle.

## Fix (single file, presentation-only)
Edit `src/components/dashboard/DemandForecastCard.tsx`:

1. Add a tiny local helper near the top:
   ```ts
   const safeFormat = (value: unknown, fmt: string, fallback = '—') => {
     if (!value) return fallback;
     const d = value instanceof Date ? value : new Date(value as string);
     return isNaN(d.getTime()) ? fallback : format(d, fmt);
   };
   ```

2. Replace every `format(new Date(<dynamic>), '...')` call with `safeFormat(<dynamic>, '...')`:
   - Line 878 — `event.date` (events list)
   - Line 1095 — `opp.date` (opportunities)
   - Line 1123 — `pred.date` (daily predictions, the `.map` in the stack)
   - Line 1212 — `event.date` (event detail)

3. Leave the internal generated dates (lines 213/217/338/345/347/464/467/612) alone — those originate from `new Date()`/`addDays` and are always valid.

## Why this is enough
- The trace points to `Array.map` → `format` inside this card; all four call sites above are inside `.map()` over AI-returned arrays.
- No data/business-logic changes; pure render safety.
- US dashboard rendering unchanged when dates are valid.

## Verification
- Reload `/` with Orion tenant (current user) — MotorIQ Enhanced renders without the ErrorBoundary fallback.
- Console: no `RangeError: Invalid time value`.
- Predictions/Events/Opportunities tiles show `—` instead of crashing when a date field is missing.

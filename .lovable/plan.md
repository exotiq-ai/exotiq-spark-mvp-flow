

# Gemini-Powered Event Intelligence + UI Improvements

## The Big Picture

Replace the PredictHQ dependency with a Gemini-powered `ai-event-intelligence` edge function that returns real-world event data for any city/date range. Wire it into both the Demand Forecast and Dynamic Pricing tabs, and fix all `Math.random()` / hardcoded fallbacks with real booking data.

## What Gemini Can Deliver (and What It Can't)

**Strong coverage for your use case:**
- All major recurring events (F1, Ultra, Art Basel, WM Phoenix Open, Barrett-Jackson, boat shows, tennis opens, etc.) — names, dates, estimated attendance, categories
- Seasonal demand patterns by city and month
- Event categorization (sports, music, conferences, etc.)
- Estimated demand impact scoring based on attendance + event type + historical patterns

**Honest gaps:**
- No newly announced one-off events (e.g., surprise concert added last week)
- Attendance estimates are approximations, not verified ticketing data
- No sub-daily granularity (PredictHQ can show hourly demand patterns)

**For luxury rentals in 2 cities, this covers ~90% of demand-driving events.** The 10% gap is micro-events that rarely move $2K+/day rental demand anyway.

**Cost:** ~$0.005/query using `gemini-3-flash-preview`. Even at 50 queries/day = ~$7.50/month vs PredictHQ's $500+/month.

## Implementation Plan

### 1. New Edge Function: `ai-event-intelligence`

Creates a Gemini-powered endpoint that returns structured event data identical to the current `predicthq-events` response shape, so the UI needs minimal rewiring.

- **Input:** `{ city, startDate, endDate, categories? }`
- **Output:** Same shape as predicthq-events: `{ events: [...], demandMultiplier, summary: { peakDate, totalEvents, avgImpact } }`
- Uses Gemini tool calling to force structured JSON output (no parsing hacks)
- Merges Gemini results with the expanded `PEAK_SEASONS` calendar for guaranteed coverage of known events
- Caches responses in a `demand_intelligence_cache` table (TTL: 24 hours) to avoid redundant API calls for the same city/date range

### 2. Expand `PEAK_SEASONS` Calendar (both edge functions)

Add ~13 new events to both `elevenlabs-tools` and `rari-mcp-server`:

**Scottsdale/Phoenix:** Barrett-Jackson (Jan, 1.35x), WM Phoenix Open (Feb, 1.40x), Scottsdale Arabian Horse Show (Feb, 1.20x), Spring Training (Feb-Mar, 1.20x), Scottsdale Arts Festival (Mar, 1.15x)

**Miami:** Miami Boat Show (Feb, 1.30x), Ultra Music Festival (Mar, 1.35x), Miami Open Tennis (Mar, 1.25x), Miami Swim Week (Jun, 1.20x)

**National holidays:** Presidents Day Weekend (1.15x), Memorial Day (1.25x), Independence Day (1.30x), Labor Day (1.20x), Thanksgiving Week (1.30x)

### 3. Fix `DemandForecastCard.tsx` — Kill Fake Data

| Current Problem | Fix |
|---|---|
| `baseDemand = 65 + Math.random() * 10` (line 248) | Calculate from actual booking density: count bookings for that day-of-week from the bookings table, derive a utilization-based demand score |
| `lastYearMultiplier = 1.0 + Math.random()` (lines 288-289) | Calculate real YoY/MoM from booking revenue data (same approach as DynamicPricingCard, which already does this correctly) |
| `peakHours: ['10:00 AM', '2:00 PM', '7:00 PM']` (line 297) | Remove this metric — luxury rentals don't have meaningful hourly patterns. Replace with "Avg Booking Duration" computed from real data |
| "PredictHQ" badge (line 325) | Change to "Demand Intelligence" with updated tooltip |

**Data source:** Pass `bookings` from `useLocationFilteredFleet` into the component as a prop. The DemandForecastCard currently doesn't receive booking data — that's why it uses random numbers.

### 4. Fix `DynamicPricingCard.tsx` — Remove Hardcoded Fallbacks

| Current Problem | Fix |
|---|---|
| Fallback `demandMultiplier: 1.15` (line 111) | Compute from PEAK_SEASONS calendar: check if current date falls in a peak season for the selected location, use that surge multiplier |
| Fallback `seasonalFactor: 1.08` (line 112) | Derive from booking data: compare current month's booking count vs 3-month average |
| Fallback `utilization: 78` (line 114) | Calculate from actual vehicle utilization: `vehicles.reduce(sum + v.utilization) / vehicles.length` (the data is already there) |

### 5. UI Improvements for Demand Forecast Tab

**Current UI is already strong.** Proposed enhancements:

- **Swap data source:** Point `fetchEvents` at `ai-event-intelligence` instead of `predicthq-events`. Same response shape = same UI, real data
- **Add "Powered by" indicator:** Replace "PredictHQ" badge with "MotorIQ Intelligence" — your own brand
- **Add booking overlay to forecast bars:** Show actual confirmed bookings overlaid on demand prediction bars (lighter inner bar = confirmed bookings, full bar = predicted demand). This lets operators see the gap between current bookings and predicted demand — actionable insight
- **Add "Seasonal Context" chip:** Below the forecast bars, show a small contextual note like "Peak Season: WM Phoenix Open (1.4x surge)" when dates overlap with PEAK_SEASONS entries

### 6. UI Improvements for Dynamic Pricing Tab

- **Event context in pricing factors:** The "Events" card currently shows "--" when no events fetched. Instead, auto-check PEAK_SEASONS and show the active event name + surge multiplier without requiring a separate API call
- **Before/After rate comparison:** When AI analysis runs, show a mini table of all vehicles with current rate vs suggested rate + delta, not just the selected vehicle

## Database Changes

One new table for caching Gemini event responses:

```sql
CREATE TABLE demand_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours',
  UNIQUE(city, start_date, end_date)
);
```

RLS: Allow authenticated reads/writes scoped to function-level access (or disable RLS since only edge functions write to it).

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/ai-event-intelligence/index.ts` | **New** — Gemini-powered event data endpoint |
| `supabase/functions/elevenlabs-tools/index.ts` | Expand PEAK_SEASONS from 7 → ~20 entries |
| `supabase/functions/rari-mcp-server/index.ts` | Same PEAK_SEASONS expansion |
| `src/components/dashboard/DemandForecastCard.tsx` | Swap data source, fix Math.random(), add booking overlay, accept bookings prop |
| `src/components/dashboard/DynamicPricingCard.tsx` | Replace hardcoded fallbacks with real calculations from PEAK_SEASONS + vehicle data |
| `src/hooks/useAIPricingEnhanced.ts` | Update to call `ai-event-intelligence` instead of `predicthq-events` |
| `supabase/config.toml` | Add `ai-event-intelligence` function config |
| Database migration | Create `demand_intelligence_cache` table |

## Holes I'm Poking

1. **Cache staleness:** 24-hour TTL means if a major event is announced today, it won't show until Gemini's next call. Acceptable for luxury rentals where events are planned months ahead.
2. **Gemini hallucination risk:** Could invent events that don't exist. Mitigation: merge with PEAK_SEASONS as ground truth — if Gemini returns an event that matches a PEAK_SEASONS entry, we boost confidence. Unknown events get a lower confidence badge in the UI.
3. **No real-time data:** Unlike PredictHQ, Gemini can't tell you "ticket sales are surging for this weekend's concert." For your price tier, this rarely matters — operators plan weeks ahead.
4. **Rate limiting:** If many users hit the endpoint simultaneously, Lovable AI rate limits could trigger. The cache table mitigates this — identical city/date queries return cached data.

## Cost Summary

| Component | Monthly Cost |
|---|---|
| Gemini event queries (~50/day) | ~$7.50 |
| Cache table storage | Negligible |
| PEAK_SEASONS (static) | $0 |
| **Total** | **~$7.50/mo** |

vs PredictHQ: $500-2,000/month.


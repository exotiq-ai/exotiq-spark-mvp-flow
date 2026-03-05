

# Demo Bookings: Feb-June 2026 — Real-World Fleet Operation

## Overview
Insert ~120 new bookings across Feb-June 2026 for the demo account, using existing customers and vehicles with market-calibrated pricing, real seasonality, event-driven surges, and a 60-65% fleet utilization target. Include matching payment records for completed/past bookings.

## Market-Calibrated Daily Rates (adjusted from current DB values)

Based on real 2025 Miami rental market data (Monarc VIP, Premier Auto Miami), the current DB rates for hypercars are already above market. I'll **adjust rates down to realistic levels** for the bookings while keeping the vehicle `current_rate` field untouched (Rari can then suggest rate optimizations):

| Vehicle | Current DB Rate | Realistic Market Rate | Notes |
|---------|----------------|----------------------|-------|
| Bugatti Chiron Sport | $5,000-5,200 | $3,500-4,500 | Hypercar tier, $3,495+ market |
| Koenigsegg Jesko | $8,000 | $5,000-6,000 | Ultra-rare, premium but capped |
| Mercedes-AMG One | $8,029 | $5,000-6,500 | Hypercar class |
| Pagani Huayra | $6,000 | $4,000-5,000 | Hypercar tier |
| Aston Martin Valkyrie | $6,500 | $4,500-5,500 | Track hypercar |
| McLaren Speedtail | $4,700-4,800 | $3,000-3,500 | Limited production McLaren |
| Lamborghini Sián | $5,000 | $3,500-4,000 | Limited hybrid |
| McLaren 765LT | $1,800 | $2,500-2,800 | Track-focused, commands premium |
| Ferrari Daytona SP3 | $4,000 | $3,500-4,000 | Correct range |
| Lamborghini Revuelto | $3,000 | $2,500-3,000 | Correct range |
| Ferrari SF90 | $2,500 | $2,000-2,500 | Correct |
| Rolls-Royce Cullinan | $1,500 | $2,000-2,300 | Underpriced vs market |
| Rolls-Royce Ghost | $1,400 | $1,700-2,000 | Underpriced |
| Ferrari 812 Superfast | $1,500 | $1,800-2,200 | Underpriced |
| Lambo Huracán EVO | $1,450 | $1,500-1,800 | Correct |
| Porsche 911 Turbo S | $1,200 | $1,200-1,500 | Correct |
| Bentley Mulliner Batur | $3,500 | $2,500-3,000 | Ultra-luxury GT |

**Key insight for Rari**: Some vehicles are overpriced (hypercars), some underpriced (Rolls-Royce, Ferrari 812). This creates realistic optimization opportunities for Rari to suggest.

## Seasonality & Event Calendar

### Scottsdale (18 vehicles)
- **Feb 2-8**: WM Phoenix Open — PEAK. 1.5x multiplier. Near-full fleet utilization
- **Feb (rest)**: High season. 70-75% utilization
- **Mar**: Spring training + good weather. 65-70% utilization  
- **Apr**: Still strong, starts cooling. 55-60%
- **May-Jun**: Off-season heat. 40-50% utilization (Rari opportunity: suggest rate drops)

### Miami (14 vehicles)
- **Feb-Mar**: Peak season, snowbirds. 70-75% utilization
- **Mar 20-22**: Ultra Music Festival weekend — 1.4x multiplier
- **Apr**: Spring break tail, moderate. 60-65%
- **May**: F1 Miami GP (early May) — PEAK. 1.5x multiplier
- **May-Jun**: Summer begins, steady. 55-60%

## Booking Distribution (~120 new bookings)

| Month | Scottsdale | Miami | Status Mix |
|-------|-----------|-------|------------|
| Feb | ~18 | ~14 | 90% completed, 10% confirmed |
| Mar | ~14 | ~12 | ~70% completed (past March 5), ~30% confirmed |
| Apr | ~10 | ~10 | 75% confirmed, 20% pending, 5% needing attention |
| May | ~8 | ~10 | 70% confirmed, 25% pending, 5% pending |
| Jun | ~6 | ~8 | 60% confirmed, 30% pending, 10% pending |

### VIP Repeat Booking Patterns
These customers get 2-4 bookings across the 5-month window:
- **Marcus Wellington III** ($266k LTV, 19 bookings) — 3-4 new bookings, always hypercars
- **Maxwell Sterling** ($220k LTV) — 3 bookings, varied high-end
- **Alexander Rothschild** ($185k LTV) — 2-3 bookings
- **Sophia Blackwood** ($165k LTV) — 2-3 bookings
- **David Chen** ($132k LTV) — 2-3 bookings
- **Jonathan Blake** ($117k LTV) — 2-3 bookings
- **Victoria Hayes** ($86k LTV) — 2 bookings, hypercar specialist
- **Samantha Pierce** ($125k LTV) — 2 bookings
- **Prestige Concierge** (corporate, $285k) — 3-4 bookings for clients
- **Apex Events LLC** (corporate, $175k) — 2-3 event bookings

Regular customers get 1-2 bookings each.

### Booking Duration Patterns (realistic luxury rental)
- Weekend rentals (Fri-Sun): 40% of bookings (2-3 days)
- Short-term (3-5 days): 30%
- Weekly (5-7 days): 20%  
- Extended (7-14 days): 10%

## Event-Driven Bookings (premium pricing)

### WM Phoenix Open (Feb 2-8, Scottsdale)
- 8-10 bookings, mostly 3-5 day, 1.5x rates
- VIPs + corporate accounts
- Multiple hypercars booked simultaneously

### Ultra Music Festival (Mar 20-22, Miami)  
- 5-6 bookings, weekend-heavy, 1.3-1.4x rates
- Younger clientele (Sebastian Cruz, Ryan Sterling types)
- Lamborghinis and flashy vehicles

### F1 Miami Grand Prix (May ~3-5, Miami)
- 6-8 bookings, 4-5 day avg, 1.5x rates
- VIP clients + corporate
- Full fleet near capacity

## Payment Records

For all completed bookings (Feb through ~March 5):
- ~40 payment records
- Mix of payment types: wire transfer (VIPs), credit card (standard), Zelle (some)
- Payment statuses: mostly "paid", some "deposit_paid" for current confirmed bookings
- Amounts match booking `total_value`

## What This Enables for Rari

1. **Rate optimization**: Scottsdale hypercars overpriced vs market → Rari suggests lowering to improve utilization
2. **Underpriced vehicles**: Rolls-Royce fleet below market → Rari suggests raising rates
3. **Seasonal strategy**: May-June Scottsdale drop-off → Rari suggests promotional rates or relocation
4. **VIP recognition**: Repeat VIP patterns → Rari can highlight loyalty program opportunities
5. **Utilization gaps**: Specific vehicles with low booking density → Rari identifies underperformers
6. **Event planning**: Upcoming F1 Miami → Rari suggests pre-booking outreach to past customers

## Implementation

This will be executed as database INSERT statements via the data insertion tool:
1. Insert ~120 bookings with realistic dates, rates, durations, customer links, and vehicle assignments
2. Insert ~40 payment records for completed bookings
3. Update customer stats (lifetime_value, total_bookings) to reflect new bookings
4. Update vehicle revenue totals

No code changes needed — this is purely data population.


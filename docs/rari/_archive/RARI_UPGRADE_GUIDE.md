# RARI Fleet Copilot - Upgrade Guide

## Current State Analysis

**Last Updated:** December 29, 2025

Rari is the AI-powered fleet management assistant built on ElevenLabs voice interface with custom tool integrations. This guide outlines what has changed since initial setup and what upgrades are needed for deployment.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│  RariVoiceInterface.tsx ──► ElevenLabs React SDK                │
│  MotorIQ.tsx             ──► AI Pricing UI                      │
│  useAIPricing.ts         ──► Local pricing calculations         │
│  useAIPricingEnhanced.ts ──► Enhanced AI pricing with events    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Functions                                │
├─────────────────────────────────────────────────────────────────┤
│  elevenlabs-session/     ──► Voice session authentication       │
│  elevenlabs-tools/       ──► Rari's tool execution (871 lines)  │
│  fleet-copilot-chat/     ──► Text chat with tool calling        │
│  ai-pricing/             ──► AI pricing recommendations         │
│  predicthq-events/       ──► Event-based demand forecasting     │
│  demo-login/             ──► Demo user authentication           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Database                                   │
├─────────────────────────────────────────────────────────────────┤
│  vehicles       (65 vehicles, 2 locations: Miami, Scottsdale)   │
│  bookings       (117 bookings with surge pricing)               │
│  customers      (40+ customers with VIP/corporate tiers)        │
│  payments       (190 payment records)                           │
│  rari_feedback  (Feedback logging for feature requests)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recent System Changes (Since Rari Setup)

### 1. Multi-Location Support ✅
- **Change:** Added `location` column to vehicles table
- **Impact on Rari:** Rari's tools need to support location filtering
- **Current Status:** NOT YET IMPLEMENTED in Rari tools

**Required Update:**
```typescript
// In elevenlabs-tools/index.ts - get_fleet_vehicles
case "get_fleet_vehicles": {
  const { status, location } = args;  // ADD location parameter
  
  let query = supabase.from('vehicles').select('*').eq('user_id', userId);
  
  if (status && status !== 'all') query = query.eq('status', status);
  if (location) query = query.eq('location', location);  // ADD THIS
  
  // ... rest of function
}
```

### 2. Enhanced Pricing with Surge Rates ✅
- **Change:** Bookings now have surge pricing (30-50% premiums) for peak events
- **Impact on Rari:** Rari should understand and explain surge pricing
- **Current Status:** Partially implemented via getPricingRecommendation

### 3. Expanded Customer Types ✅
- **Change:** Added VIP, corporate, and various customer tiers
- **Impact on Rari:** Customer queries should include tier information
- **Current Status:** Basic implementation exists

### 4. Payment Integration ✅
- **Change:** Full payment records with wire transfers, deposits, crypto
- **Impact on Rari:** Should be able to report on payment status
- **Current Status:** NOT YET IMPLEMENTED

---

## Missing Rari Capabilities

### Priority 1: Location-Aware Queries
Rari cannot currently:
- Filter vehicles by location (Miami vs Scottsdale)
- Report on location-specific metrics
- Recommend vehicles based on customer location

**Required Tool Update:**
```typescript
// New tool: getLocationMetrics
{
  type: "function",
  name: "getLocationMetrics",
  description: "Get fleet metrics for a specific location",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string", enum: ["Miami", "Scottsdale", "all"] }
    },
    required: ["location"]
  }
}
```

### Priority 2: Payment Reporting
Rari cannot currently:
- Report on payment statuses across bookings
- Identify overdue payments
- Calculate revenue by payment method

**Required Tool:**
```typescript
{
  type: "function", 
  name: "getPaymentSummary",
  description: "Get payment summary and outstanding balances",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["paid", "pending", "partial", "all"] },
      timeframe: { type: "string", enum: ["today", "week", "month", "year"] }
    }
  }
}
```

### Priority 3: Peak Season Awareness
Rari needs to understand:
- Art Basel (Dec 1-8)
- NYE/Holiday (Dec 20 - Jan 3)
- Super Bowl (Feb 5-12)
- Miami Grand Prix (May 2-4)

**Required Update:** Add event calendar knowledge to system prompt and getPricingRecommendation

### Priority 4: Real-Time Booking Creation
Rari cannot currently:
- Create new bookings via voice
- Check real-time availability
- Send booking confirmations

**Future Enhancement:** Would require write-capable tools with proper authorization

---

## Tool Inventory

### Currently Working Tools (elevenlabs-tools)

| Tool Name | Description | Status |
|-----------|-------------|--------|
| get_fleet_vehicles | List vehicles with status filter | ✅ Works |
| get_bookings | Get bookings with filters | ✅ Works |
| get_recent_activity | Recent booking activity | ✅ Works |
| getFleetMetrics | Fleet performance metrics | ✅ Works |
| getVehicleDetails | Single vehicle details | ✅ Works |
| getCustomerProfile | Customer information | ✅ Works |
| checkAvailability | Check vehicle availability | ✅ Works |
| getRevenueAnalysis | Revenue by timeframe | ✅ Works |
| getTopPerformers | Top vehicles/customers | ✅ Works |
| searchBookings | Search with filters | ✅ Works |
| getDamageReports | Damage claims | ✅ Works |
| getUpcomingMaintenance | Maintenance schedule | ✅ Works |
| getCustomerLifetimeValue | Customer LTV | ✅ Works |
| getVaultDocuments | Document vault | ⚠️ Mock data |
| getDemandForecast | Event-based demand | ⚠️ Needs API key |
| getPricingRecommendation | AI pricing | ✅ Works |
| getFleetPricingOverview | Fleet-wide pricing | ✅ Works |
| getEventImpact | Event impact analysis | ⚠️ Basic |
| getWeatherInfo | Weather data | ⚠️ Mock data |
| getCarJoke | Entertainment | ✅ Works |
| getVehicleSpecs | Vehicle specifications | ⚠️ Limited data |
| logFeedback | Log user feedback | ✅ Works |
| featureComingSoon | Handle missing features | ✅ Works |

### Missing Tools Needed

| Tool Name | Priority | Description |
|-----------|----------|-------------|
| getPaymentSummary | High | Payment status reporting |
| getLocationMetrics | High | Location-specific analytics |
| createBooking | Medium | Voice booking creation |
| sendNotification | Medium | Send SMS/email to customer |
| updateVehicleRate | Medium | Adjust pricing in real-time |
| getSeasonalCalendar | Low | Peak event calendar |

---

## Edge Function Dependencies

### Required Secrets

| Secret | Used By | Status |
|--------|---------|--------|
| LOVABLE_API_KEY | fleet-copilot-chat | ✅ Configured |
| ELEVENLABS_API_KEY | elevenlabs-session | ✅ Configured |
| PREDICTHQ_API_KEY | predicthq-events | ⚠️ Optional |
| OPENAI_API_KEY | ai-pricing | ✅ Configured |
| STRIPE_SECRET_KEY | payment functions | ✅ Configured |

### Function Inter-Dependencies

```
elevenlabs-session
    └── Returns signed URL for voice connection

elevenlabs-tools
    ├── Uses: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    └── Calls: predicthq-events (optional)

fleet-copilot-chat
    ├── Uses: LOVABLE_API_KEY, SUPABASE_URL
    └── Provides: Text-based chat with same tools

ai-pricing
    ├── Uses: OPENAI_API_KEY
    └── Provides: AI-powered rate recommendations
```

---

## ElevenLabs Configuration

### Agent Settings (from RARI_ELEVENLABS_SETTINGS.md)

| Setting | Recommended Value |
|---------|-------------------|
| Voice | Sarah or Rachel |
| Model | Turbo v2.5 |
| Language | English |
| Stability | 0.3 |
| Speed | 1.0 |
| Interruption Sensitivity | Medium-High |

### System Prompt Updates Needed

Current system prompt may be outdated. Update to include:

1. **Multi-location awareness:**
   > "You manage a fleet across multiple locations including Miami and Scottsdale."

2. **Peak season knowledge:**
   > "Be aware of peak rental seasons: Art Basel (Dec), NYE, Super Bowl (Feb), Miami Grand Prix (May)."

3. **VIP customer handling:**
   > "Some customers are VIPs requiring white-glove service. Always check customer tier before making recommendations."

---

## Deployment Checklist

### Pre-Deployment

- [ ] Update elevenlabs-tools with location filtering
- [ ] Add getPaymentSummary tool
- [ ] Update ElevenLabs agent system prompt
- [ ] Verify all edge functions are deployed
- [ ] Test demo login flow
- [ ] Verify Rari can access demo user data

### Testing Scenarios

1. **Location Query:** "How many vehicles do we have in Scottsdale?"
2. **Payment Query:** "What's our outstanding payment balance?"
3. **Peak Pricing:** "Should we adjust rates for NYE?"
4. **VIP Customer:** "Tell me about Marcus Wellington"
5. **Availability:** "Is the Bugatti available next weekend?"

### Post-Deployment

- [ ] Monitor rari_feedback table for missing features
- [ ] Track tool execution errors in edge function logs
- [ ] Review user satisfaction metrics
- [ ] Iterate on system prompt based on common queries

---

## Future Roadmap

### Phase 1: Enhanced Read Capabilities
- Location-aware queries
- Payment status reporting
- Customer tier awareness

### Phase 2: Write Capabilities (Requires Security Review)
- Create bookings via voice
- Update vehicle rates
- Send customer notifications

### Phase 3: Proactive Intelligence
- Real-time alerts for booking opportunities
- Automatic surge pricing recommendations
- Predictive maintenance scheduling

---

## Files to Update

| File | Update Required |
|------|-----------------|
| `supabase/functions/elevenlabs-tools/index.ts` | Add location param, payment tools |
| `supabase/functions/fleet-copilot-chat/index.ts` | Mirror elevenlabs-tools updates |
| `RARI_ELEVENLABS_SETTINGS.md` | Update system prompt |
| `elevenlabs-tools-config.json` | Add new tool definitions |
| `src/components/rari/RariVoiceInterface.tsx` | No changes needed |

---

## Summary

Rari is functional but needs updates to leverage recent system enhancements:

1. **Critical:** Add location filtering to vehicle/booking queries
2. **High:** Add payment status reporting
3. **Medium:** Update system prompt for multi-location, peak seasons
4. **Low:** Add proactive notifications and write capabilities

The demo data is now complete with 65 vehicles, 117 bookings, 190 payments across 2 locations.

# RARI ElevenLabs Dashboard Settings

Configure these settings in the [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai) for your Rari agent.

## Voice Settings (Agent → Voice)

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| **Voice** | Sarah or Rachel | Natural, friendly female voices |
| **Stability** | 0.3 - 0.4 | Lower = more expressive/natural |
| **Similarity Boost** | 0.75 | Good voice consistency |
| **Style** | 0.4 - 0.5 | Natural expressiveness |
| **Speed** | 1.1 - 1.2 | Faster speech (max 1.2) |
| **Use Speaker Boost** | ✅ Enabled | Enhances clarity |

## Model Settings (Agent → Model)

| Setting | Recommended Value |
|---------|-------------------|
| **Model** | Turbo v2.5 | Lowest latency, natural flow |
| **Turn Detection** | Auto/Low | Quick response to user |

## Agent Behavior (Agent → Behavior)

| Setting | Recommended Value |
|---------|-------------------|
| **First Message** | "Hey! I'm Rari, your fleet assistant. What can I help you with today?" |
| **Language** | English |
| **Interruption Sensitivity** | Medium-High | Let users interrupt naturally |

---

## System Prompt (UPDATED December 2025)

Replace your current system prompt with this optimized version:

```
You are Rari, an AI fleet management assistant for Exotiq's luxury car rental Command Center.

PERSONALITY:
- Friendly, confident, and quick
- Use casual language: contractions (I'm, we're, you'll), short sentences
- Be direct - no filler words or over-explaining
- Sound like a helpful colleague, not a formal assistant

RESPONSE STYLE:
- Keep responses SHORT - 1-2 sentences max
- Get to the point fast
- Use numbers and specifics, not vague terms
- If you don't know something, say "Let me check that" and use your tools

FLEET KNOWLEDGE:
- You manage a luxury fleet across MULTIPLE LOCATIONS: Miami (50 vehicles) and Scottsdale (15 vehicles)
- Always consider location when answering fleet questions
- Vehicle types: Hypercars, Supercars, Luxury Sedans, Sports Luxury

PEAK SEASONS (apply surge pricing):
- Art Basel Miami: Dec 1-8 (+35% surge)
- Christmas Week: Dec 20-26 (+40% surge)  
- New Year's Eve: Dec 27 - Jan 3 (+50% surge)
- Super Bowl: Feb 5-12 (+50% surge)
- Miami Grand Prix: May 2-4 (+40% surge)
- Summer Peak: Jun 15 - Aug 15 (+15% surge)

CUSTOMER TIERS:
- VIP customers get white-glove service priority
- Corporate accounts may have negotiated rates
- Check customer status before making recommendations

CAPABILITIES:
- Access real fleet data via tools
- Check vehicle availability by location
- Report on bookings, revenue, payments
- Provide pricing recommendations with peak season awareness
- Get location-specific metrics (Miami vs Scottsdale)
- Check payment status and outstanding balances
- Log feature requests when you can't help

EXAMPLES OF GOOD RESPONSES:
- "Your Miami fleet's at 78% utilization - that's solid!"
- "The 488 GTB is booked this weekend in Miami. Want me to check Scottsdale availability?"
- "Revenue's up 12% this month - $47K in Miami, $12K in Scottsdale."
- "We're in NYE peak season - I'd recommend 50% surge pricing."
- "You have $15K in pending payments across 8 bookings."

EXAMPLES OF BAD RESPONSES (TOO LONG):
- "I'd be happy to help you with that. Let me take a moment to check the fleet utilization metrics for you..."
- "Based on my analysis of the current booking data..."

If a feature isn't available, say "That's coming soon! I'll note it for the team." and use the logFeedback tool.
```

---

## Tools Configuration

### ✅ REQUIRED: Enable ALL these tools in ElevenLabs dashboard

#### Fleet & Vehicle Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `get_fleet_vehicles` | List vehicles with filters | `status` (available/rented/maintenance/all), `location` (Miami/Scottsdale/all) |
| `getVehicleDetails` | Single vehicle details | `vehicleName`, `includeBookings` |
| `checkAvailability` | Check vehicle availability | `vehicleName`, `startDate`, `endDate`, `location` |
| `getVehicleSpecs` | Vehicle specifications | `vehicleName` |

#### Location Tools (NEW)
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getLocationMetrics` | Location-specific analytics | `location` (Miami/Scottsdale/all) |
| `getFleetMetrics` | Fleet performance metrics | `timeframe`, `location` |

#### Booking Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `get_bookings` | Get bookings with filters | `status`, `start_date`, `end_date`, `location` |
| `searchBookings` | Search bookings | `status`, `daysRange`, `location` |
| `get_recent_activity` | Recent activity feed | `limit` |

#### Payment Tools (NEW)
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getPaymentSummary` | Payment status reporting | `status` (paid/pending/partial/all), `timeframe`, `location` |

#### Revenue & Pricing Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getRevenueAnalysis` | Revenue by timeframe | `timeframe`, `vehicleName`, `location` |
| `getTopPerformers` | Top vehicles/customers | `metric` (revenue/utilization/customers), `limit`, `location` |
| `getPricingRecommendation` | AI pricing with peak awareness | `vehicleName`, `location` |
| `getFleetPricingOverview` | Fleet-wide pricing | `location` |
| `getDemandForecast` | Event-based demand | `city`/`location`, `days` |
| `getEventImpact` | Event impact analysis | `eventName`, `location` |

#### Customer Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getCustomerProfile` | Customer information | `customerName`, `includeHistory` |
| `getCustomerLifetimeValue` | Customer LTV | `customerName` |

#### Operations Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getDamageReports` | Damage claims | `status`, `location` |
| `getUpcomingMaintenance` | Maintenance schedule | `daysAhead`, `location` |
| `getVaultDocuments` | Document vault | `category`, `status` |

#### Utility Tools
| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `getWeatherInfo` | Weather data | `location` |
| `getCarJoke` | Entertainment | none |
| `logFeedback` | Log user feedback | `feedbackType`, `keywords`, `userQuery` |
| `featureComingSoon` | Handle missing features | `featureName`, `userRequest` |

---

## Tool JSON Definitions

Copy these into your ElevenLabs agent's tool configuration:

### getLocationMetrics (NEW)
```json
{
  "type": "function",
  "name": "getLocationMetrics",
  "description": "Get fleet metrics for a specific location including vehicle count, revenue, utilization, and peak season status",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "enum": ["Miami", "Scottsdale", "all"],
        "description": "Location to get metrics for"
      }
    },
    "required": ["location"]
  }
}
```

### getPaymentSummary (NEW)
```json
{
  "type": "function",
  "name": "getPaymentSummary",
  "description": "Get payment summary including completed, pending, and outstanding balances by status, method, and location",
  "parameters": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["paid", "pending", "partial", "completed", "all"],
        "description": "Filter by payment status"
      },
      "timeframe": {
        "type": "string",
        "enum": ["today", "week", "month", "year"],
        "description": "Time range for payments"
      },
      "location": {
        "type": "string",
        "enum": ["Miami", "Scottsdale", "all"],
        "description": "Filter by vehicle location"
      }
    }
  }
}
```

### Updated get_fleet_vehicles
```json
{
  "type": "function",
  "name": "get_fleet_vehicles",
  "description": "Get list of vehicles in the fleet, optionally filtered by status and location",
  "parameters": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["available", "rented", "maintenance", "all"],
        "description": "Filter by vehicle status"
      },
      "location": {
        "type": "string", 
        "enum": ["Miami", "Scottsdale", "all"],
        "description": "Filter by location"
      }
    }
  }
}
```

---

## Testing Checklist

After updating settings, test these commands:

### Location Queries
1. ✅ "How many vehicles do we have in Scottsdale?" → Should use getLocationMetrics
2. ✅ "What's our Miami utilization?" → Should use getFleetMetrics with location
3. ✅ "Compare Miami and Scottsdale revenue" → Should use getLocationMetrics

### Payment Queries
4. ✅ "What's our outstanding payment balance?" → Should use getPaymentSummary
5. ✅ "Show me pending payments this month" → Should use getPaymentSummary
6. ✅ "How much did we collect this week?" → Should use getPaymentSummary

### Peak Season Queries
7. ✅ "Should we adjust rates for NYE?" → Should mention 50% surge
8. ✅ "What's the Art Basel pricing recommendation?" → Should use getEventImpact
9. ✅ "Are we in peak season?" → Should check current date against peak calendar

### Standard Queries
10. ✅ "What's my fleet utilization?" → Should respond in <2 seconds
11. ✅ "Check Ferrari availability next weekend" → Should use checkAvailability
12. ✅ "Tell me about Marcus Wellington" → Should use getCustomerProfile

---

## Latency Optimization

For fastest responses:
1. Use **Turbo v2.5** model
2. Set **Speed to 1.15-1.2**
3. Lower **Stability to 0.3-0.4** (faster processing)
4. Enable **Optimize streaming latency** if available

---

## Webhook Configuration

Your Edge Function URL:
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools
```

Ensure this is set as the webhook URL for all tool calls in ElevenLabs.

---

## Summary of December 2025 Updates

1. **Added location parameter** to all relevant tools (vehicles, bookings, metrics, payments)
2. **New getLocationMetrics tool** for location-specific analytics
3. **New getPaymentSummary tool** for payment status reporting
4. **Peak season calendar** built into pricing recommendations
5. **Updated system prompt** with multi-location awareness and peak seasons
6. **Enhanced vehicle specs** database with more models

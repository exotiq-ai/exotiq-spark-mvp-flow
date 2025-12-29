# Rari MCP Server Integration Guide

## Overview

The Rari MCP Server implements the Model Context Protocol (MCP) for ElevenLabs integration, enabling automatic tool discovery and execution for the Rari fleet assistant.

## Server URL

```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rari-mcp-server` | GET | Server info and capabilities |
| `/rari-mcp-server/sse` | GET | SSE stream for tool discovery |
| `/rari-mcp-server/tools` | GET | JSON list of all tools |
| `/rari-mcp-server` | POST | Execute a tool |

## ElevenLabs Setup

1. Go to [ElevenLabs MCP Integrations](https://elevenlabs.io/app/agents/integrations)
2. Click **"Add Custom MCP Server"**
3. Configure:
   - **Name**: `Exotiq Fleet Tools`
   - **Description**: `Complete fleet management tools for Rari`
   - **Server URL**: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server`
   - **Approval Mode**: Fine-grained (auto-approve read tools)
4. Add to your Rari agent

## Available Tools (25 Total)

### Fleet & Vehicle
- `get_fleet_vehicles` - List vehicles by status/location
- `getFleetMetrics` - Fleet performance metrics
- `getLocationMetrics` - Metrics by location
- `getVehicleDetails` - Vehicle details with bookings
- `getVehicleSpecs` - Technical specifications
- `checkAvailability` - Check date availability

### Bookings
- `get_bookings` - List bookings with filters
- `searchBookings` - Search bookings
- `get_recent_activity` - Recent booking activity

### Payments & Revenue
- `getPaymentSummary` - Payment totals by status/method
- `getRevenueAnalysis` - Revenue analysis
- `getTopPerformers` - Top vehicles/customers

### Pricing
- `getPricingRecommendation` - AI pricing suggestions
- `getFleetPricingOverview` - Fleet pricing overview
- `getDemandForecast` - Demand forecasting
- `getEventImpact` - Event impact analysis

### Customers
- `getCustomerProfile` - Customer details
- `getCustomerLifetimeValue` - Customer LTV

### Operations
- `getDamageReports` - Damage claims
- `getUpcomingMaintenance` - Maintenance schedule
- `getVaultDocuments` - Document vault

### Utility
- `getWeatherInfo` - Weather info
- `getCarJoke` - Car jokes
- `logFeedback` - Log feedback
- `featureComingSoon` - Log feature requests

## Benefits Over Webhook Configuration

| Before (Webhooks) | After (MCP) |
|-------------------|-------------|
| Manual config per tool | Auto-discovery |
| Dashboard updates needed | Code-driven |
| Error-prone | Version controlled |
| Time consuming | Instant updates |

## Adding New Tools

1. Add tool definition to `TOOL_MANIFEST` in `rari-mcp-server/index.ts`
2. Add execution logic to `executeFunction` switch
3. Deploy - ElevenLabs discovers automatically!

## Testing

```bash
# Get server info
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server

# List tools
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/tools

# Execute tool
curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "getFleetMetrics", "parameters": {"timeframe": "month"}}'
```

## Note

ElevenLabs MCP support is in **public alpha**. The existing webhook-based `elevenlabs-tools` function remains as a fallback.

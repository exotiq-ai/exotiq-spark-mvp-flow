# Rari MCP Server Integration Guide

## Quick Setup for ElevenLabs

### Step 1: Add Custom MCP Server in ElevenLabs

1. Go to [ElevenLabs MCP Integrations](https://elevenlabs.io/app/conversational-ai/mcp-servers)
2. Click **"Add MCP Server"** or **"Add Custom MCP Server"**
3. Fill in these exact values:

| Field | Value |
|-------|-------|
| **Name** | `Exotiq Fleet Tools` |
| **Description** | `Fleet management tools for Rari assistant` |
| **Server URL** | `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse` |
| **Secret Token** | *(leave empty - not required)* |
| **Approval Mode** | `Auto-approved` or `Fine-grained` |

4. Click **Save** or **Add**

### Step 2: Add to Your Rari Agent

1. Go to your Rari agent settings
2. Under "Integrations" or "Tools", find `Exotiq Fleet Tools`
3. Enable it

### Step 3: Test

Say to Rari: *"What vehicles do we have available?"*

Rari should call `get_fleet_vehicles` and return your fleet data.

---

## Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rari-mcp-server` | GET | Server info and capabilities |
| `/rari-mcp-server/sse` | GET | **Primary** - SSE connection for MCP |
| `/rari-mcp-server/manifest` | GET | ElevenLabs-style tool manifest |
| `/rari-mcp-server/tools` | GET | JSON list of all tools |
| `/rari-mcp-server/messages` | POST | JSON-RPC message handling |
| `/rari-mcp-server` | POST | Direct tool execution (legacy) |

---

## Available Tools (25 Total)

### Fleet & Vehicle
| Tool | Description |
|------|-------------|
| `get_fleet_vehicles` | List vehicles by status/location |
| `getFleetMetrics` | Fleet performance metrics |
| `getLocationMetrics` | Metrics by location |
| `getVehicleDetails` | Vehicle details with bookings |
| `getVehicleSpecs` | Technical specifications |
| `checkAvailability` | Check date availability |

### Bookings
| Tool | Description |
|------|-------------|
| `get_bookings` | List bookings with filters |
| `searchBookings` | Search bookings |
| `get_recent_activity` | Recent booking activity |

### Payments & Revenue
| Tool | Description |
|------|-------------|
| `getPaymentSummary` | Payment totals by status/method |
| `getRevenueAnalysis` | Revenue analysis |
| `getTopPerformers` | Top vehicles/customers |

### Pricing
| Tool | Description |
|------|-------------|
| `getPricingRecommendation` | AI pricing suggestions |
| `getFleetPricingOverview` | Fleet pricing overview |
| `getDemandForecast` | Demand forecasting |
| `getEventImpact` | Event impact analysis |

### Customers
| Tool | Description |
|------|-------------|
| `getCustomerProfile` | Customer details |
| `getCustomerLifetimeValue` | Customer LTV |

### Operations
| Tool | Description |
|------|-------------|
| `getDamageReports` | Damage claims |
| `getUpcomingMaintenance` | Maintenance schedule |
| `getVaultDocuments` | Document vault |

### Utility
| Tool | Description |
|------|-------------|
| `getWeatherInfo` | Weather info |
| `getCarJoke` | Car jokes |
| `logFeedback` | Log feedback |
| `featureComingSoon` | Log feature requests |

---

## Optional: Secure with Token

If you want to require authentication:

1. Add `MCP_SECRET_TOKEN` secret in Supabase with any secure value
2. In ElevenLabs, add that same value to the **Secret Token** field

---

## Testing Endpoints

```bash
# Get server info
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server

# Get tool manifest (ElevenLabs format)
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/manifest

# List tools (MCP format)
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/tools

# Execute tool directly
curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "getFleetMetrics", "parameters": {"timeframe": "month"}}'
```

---

## Troubleshooting

### "Connection failed" in ElevenLabs
- Verify URL ends with `/sse`
- Check no trailing slash after `/sse`
- Try the `/manifest` endpoint to verify server is responding

### Tools not appearing
- Check ElevenLabs MCP server is "Connected" status
- Verify the server is added to your specific agent
- Try removing and re-adding the MCP server

### "Unauthorized" errors
- If using Secret Token, ensure it matches exactly
- If not using auth, ensure `MCP_SECRET_TOKEN` is not set in Supabase

---

## How It Works

```
ElevenLabs Agent
      │
      ▼
   GET /sse (SSE connection)
      │
      ├─► Receives: event: endpoint
      │            data: https://.../messages?sessionId=xxx
      │
      ▼
  POST /messages (JSON-RPC 2.0)
      │
      ├─► initialize → Server capabilities
      ├─► tools/list → Available tools
      └─► tools/call → Execute tool, get result
```

The server maintains the SSE connection for real-time communication while handling tool calls via POST requests.

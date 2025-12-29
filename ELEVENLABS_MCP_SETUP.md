# ElevenLabs MCP Integration - Quick Setup Guide

**Quick Reference:** How to connect your Rari Fleet MCP Server to ElevenLabs

---

## 🚀 Step-by-Step Setup

### Step 1: Apply Database Migration

First, ensure the performance indexes are applied:

```bash
# Via Supabase CLI
supabase migration up

# Or via Supabase Dashboard:
# Database → Migrations → Apply migration: 20250101000000_add_rari_feedback_indexes.sql
```

### Step 2: Configure Environment Variables (Optional)

In Supabase Dashboard → Edge Functions → `rari-mcp-server`:

1. Go to Settings → Secrets
2. Add secret: `DEMO_USER_ID` = `[your-demo-user-uuid]`
   - This ensures consistent user context for testing
   - Find your user ID in the `profiles` table

### Step 3: Add MCP Server to ElevenLabs

1. **Navigate to MCP Integrations:**
   - Go to: https://elevenlabs.io/app/agents/integrations
   - Click **"Add Custom MCP Server"**

2. **Configure Basic Information:**
   - **Name:** `Rari Fleet Tools`
   - **Description:** `Fleet management tools for Rari assistant - 25 tools for vehicles, bookings, payments, customers, and analytics`

3. **Configure Server Settings:**
   - **Server Type:** Select `SSE` (Server-Sent Events)
   - **Server URL:** 
     ```
     https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse
     ```
   - **Secret Token (Optional):** Leave empty (unless you set `MCP_SECRET_TOKEN`)
   - **HTTP Headers (Optional):** Not needed

4. **Tool Approval Mode:**
   - **Recommended:** `Fine-Grained Tool Approval`
   - **Auto-approve these (read-only, safe):**
     - `get_fleet_vehicles`
     - `getFleetMetrics`
     - `getLocationMetrics`
     - `getVehicleDetails`
     - `getVehicleSpecs`
     - `checkAvailability`
     - `get_bookings`
     - `get_recent_activity`
     - `getRevenueAnalysis`
     - `getTopPerformers`
     - `getCustomerProfile`
     - `getCustomerLifetimeValue`
     - `getDamageReports`
     - `getUpcomingMaintenance`
     - `getVaultDocuments`
     - `getWeatherInfo`
     - `getCarJoke`
   
   - **Require approval for these (data modification):**
     - `getPricingRecommendation`
     - `getFleetPricingOverview`
     - `getDemandForecast`
     - `getEventImpact`
     - `logFeedback`
     - `featureComingSoon`

5. **Trust Checkbox:**
   - ✅ Check **"I trust this server"**

6. **Click "Add Server"**

### Step 4: Test Connection

ElevenLabs will automatically:
- Test the connection
- List all 25 available tools
- Show them in the dashboard

You should see:
```
✅ Connection successful
📋 25 tools available
```

### Step 5: Add to Your Rari Agent

1. Go to your Rari agent settings
2. Navigate to **"Integrations"** or **"Tools"**
3. Find **"Rari Fleet Tools"** in the list
4. Enable it
5. Configure tool approval settings if needed

---

## 🧪 Testing

### Test 1: Simple Query
Ask Rari: *"What vehicles do I have available?"*

Expected: Rari calls `get_fleet_vehicles` and returns your fleet list.

### Test 2: Location Filter
Ask Rari: *"Show me vehicles in Miami"*

Expected: Rari calls `get_fleet_vehicles` with `location: "Miami"`.

### Test 3: Metrics Query
Ask Rari: *"What's my fleet utilization this month?"*

Expected: Rari calls `getFleetMetrics` with `timeframe: "month"`.

---

## 🔍 Troubleshooting

### Connection Failed

**Check:**
1. URL ends with `/sse` (not `/sse/`)
2. No trailing slash
3. Server is accessible (test with curl)

**Test manually:**
```bash
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server
```

### Tools Not Appearing

**Check:**
1. MCP server shows "Connected" status
2. Server is added to your specific agent
3. Try removing and re-adding the MCP server

### "Unauthorized" Errors

**Check:**
1. If using `MCP_SECRET_TOKEN`, ensure it matches in ElevenLabs
2. If not using auth, ensure `MCP_SECRET_TOKEN` is NOT set in Supabase

### Wrong User Data

**Check:**
1. `DEMO_USER_ID` environment variable is set correctly
2. User ID exists in `profiles` table
3. Check Supabase Edge Function logs for user identification

---

## 📊 Monitoring

### View Logs

1. **Supabase Dashboard:**
   - Edge Functions → `rari-mcp-server` → Logs
   - Look for: `[MCP Server]` and `[TOOL]` prefixes

2. **Key Log Messages:**
   - `Session X stored` - Connection established
   - `Using user ID: X` - User identification
   - `Handling tools/call: X` - Tool execution
   - `Tool result:` - Response data

### Check Tool Usage

Query the `rari_feedback` table to see:
- Which tools are being called
- User queries and responses
- Feature requests

---

## 🎯 Quick Reference

### MCP Server URL
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse
```

### Available Endpoints
- `GET /sse` - SSE connection (ElevenLabs)
- `POST /messages` - JSON-RPC messages
- `GET /manifest` - Tool manifest
- `GET /tools` - REST tool list
- `GET /` - Server info

### Tool Count
**25 tools** available for fleet management

### Support
- Check `MCP_SERVER_AUDIT_REPORT.md` for detailed information
- Review Supabase Edge Function logs
- Test endpoints with curl first

---

## ✅ Success Checklist

- [ ] Database migration applied
- [ ] `DEMO_USER_ID` set (optional)
- [ ] MCP server added to ElevenLabs
- [ ] Connection test successful
- [ ] 25 tools visible in dashboard
- [ ] MCP server added to Rari agent
- [ ] Tool approval configured
- [ ] Test query successful

---

**You're all set!** 🎉

Your Rari Fleet MCP Server is now connected to ElevenLabs and ready to use.

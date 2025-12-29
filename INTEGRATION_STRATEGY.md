# Complete Integration Strategy: ElevenLabs + Cursor + MCP

**Two Powerful Integrations Working Together!**

---

## 🎯 Two Complementary Paths

### Path 1: ElevenLabs → Cursor API (Code Operations)
**What it does:** Rari can launch Cursor agents to work on your codebase
- ✅ Launch background agents
- ✅ Create pull requests
- ✅ Handle coding tasks autonomously
- ✅ Work on repositories

**Setup:** ElevenLabs Dashboard → Integrations → Cursor → Add Cursor API Key

### Path 2: ElevenLabs → MCP Server (Fleet Data)
**What it does:** Rari can access your fleet management data
- ✅ Query vehicles, bookings, customers
- ✅ Get metrics and analytics
- ✅ Check availability
- ✅ Provide pricing recommendations

**Setup:** ElevenLabs Dashboard → MCP Integrations → Add Custom MCP Server

---

## 🚀 Combined Power

**Together, Rari can:**

1. **Answer fleet questions** (via MCP):
   - "What vehicles do I have available?"
   - "What's my revenue this month?"
   - "Check availability for next weekend"

2. **Work on code** (via Cursor):
   - "Add a new feature to the booking system"
   - "Fix the pricing calculation bug"
   - "Create a new dashboard widget"

3. **Combine both** (the ultimate power):
   - "Analyze my fleet data and create a report"
   - "Based on current bookings, suggest code improvements"
   - "Generate a new feature based on customer feedback"

---

## 📋 Setup Checklist

### ✅ Path 1: Cursor Integration (For Code Operations)

1. **Get Cursor API Key:**
   - Go to: https://cursor.com/settings
   - Generate API key
   - Copy it

2. **Add to ElevenLabs:**
   - ElevenLabs Dashboard → Integrations → Cursor
   - Paste API key
   - Click "Connect"

3. **Available Tools:**
   - Launch Agent
   - List Agents
   - Get Agent
   - Get Agent Conversation
   - Add Agent Followup

### ✅ Path 2: MCP Server (For Fleet Data)

1. **Test MCP Server:**
   ```bash
   ./test-mcp-server.sh
   ```

2. **Add to ElevenLabs:**
   - ElevenLabs Dashboard → MCP Integrations
   - Add Custom MCP Server
   - URL: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse`
   - Type: SSE

3. **Available Tools:**
   - 25 fleet management tools
   - Vehicles, bookings, customers, payments, etc.

---

## 🎯 Use Cases

### Scenario 1: Fleet Question
**User:** "What vehicles are available in Miami?"

**Rari uses:**
- ✅ MCP Server → `get_fleet_vehicles` tool
- Returns: List of available vehicles

### Scenario 2: Code Task
**User:** "Add a new filter to the booking calendar"

**Rari uses:**
- ✅ Cursor API → Launch Agent
- Agent works on codebase
- Creates PR or commits changes

### Scenario 3: Combined Task
**User:** "Analyze my booking trends and create a dashboard widget"

**Rari uses:**
- ✅ MCP Server → `getRevenueAnalysis` tool (get data)
- ✅ Cursor API → Launch Agent (create widget code)
- Complete solution!

---

## 🔧 Current Status

### Cursor Integration:
- ✅ Available in ElevenLabs
- ✅ Just needs API key
- ✅ Ready to use

### MCP Server:
- ⚠️ Tools not appearing in ElevenLabs
- ✅ Server is working (tested)
- 🔍 Need to debug connection

---

## 🐛 Debugging MCP Connection

Since Cursor integration works, let's focus on getting MCP working:

### Step 1: Verify Server
```bash
./test-mcp-server.sh
```

### Step 2: Check ElevenLabs Logs
- Look for connection errors
- Check what format it expects

### Step 3: Try Alternative Format
If SSE doesn't work, we can try:
- HTTP Streamable transport
- Different manifest format
- Direct tool endpoint

---

## 💡 Recommendation

**Set up both!**

1. **Cursor Integration** (Quick win):
   - Add API key now
   - Test with: "List my agents" or "Launch an agent"
   - This works immediately

2. **MCP Server** (Debug in parallel):
   - Run test script
   - Check Supabase logs
   - We'll fix the connection issue

**Together they give Rari complete capabilities!** 🚀

---

## 📊 Integration Architecture

```
User → ElevenLabs (Rari)
         │
         ├─→ Cursor API → Codebase Operations
         │   (Launch agents, PRs, code tasks)
         │
         └─→ MCP Server → Fleet Data
             (Vehicles, bookings, metrics)
```

**Both paths active = Full Rari power!** ⚡

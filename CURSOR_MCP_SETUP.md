# Cursor MCP Integration Setup

**Alternative path:** Use Cursor to test and debug the MCP server, then connect ElevenLabs

---

## 🎯 Why Cursor First?

1. **Easier to debug** - See logs directly in Cursor
2. **Test the MCP server** - Verify it works before ElevenLabs
3. **Better error messages** - Cursor shows detailed connection issues
4. **Can use in development** - Access fleet tools while coding

---

## 📋 Step 1: Configure Cursor MCP

### Option A: Via Cursor Settings UI

1. Open Cursor
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Search for **"MCP"** or **"Model Context Protocol"**
4. Click **"Add MCP Server"** or **"Configure MCP Servers"**

### Option B: Via Config File

1. Open Cursor config file:
   - **macOS:** `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
   - **Windows:** `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
   - **Linux:** `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

2. Add this configuration:

```json
{
  "mcpServers": {
    "rari-fleet-tools": {
      "url": "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse",
      "transport": "sse",
      "name": "Rari Fleet Tools",
      "description": "Fleet management tools for Exotiq - 25 tools for vehicles, bookings, payments, and analytics"
    }
  }
}
```

### Option C: Remote MCP Server (Recommended)

Since your server is hosted on Supabase, Cursor can connect directly:

1. In Cursor settings, add **Remote MCP Server**
2. **Server URL:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse`
3. **Transport Type:** SSE (Server-Sent Events)
4. **Name:** `Rari Fleet Tools`

---

## 🧪 Step 2: Test in Cursor

After configuring, test the connection:

1. **Restart Cursor** (important for MCP config to load)
2. Open a chat in Cursor
3. Ask: *"What vehicles do I have in my fleet?"*
4. Cursor should call the `get_fleet_vehicles` tool

### Expected Behavior:

- ✅ Cursor connects to MCP server
- ✅ Lists available tools
- ✅ Can call tools when needed
- ✅ Returns fleet data

### If It Doesn't Work:

1. Check Cursor's MCP connection status
2. Look for error messages in Cursor's output panel
3. Run the test script: `./test-mcp-server.sh`
4. Check Supabase Edge Function logs

---

## 🔍 Step 3: Debug Connection Issues

### Check MCP Server Status

Run the test script:

```bash
chmod +x test-mcp-server.sh
./test-mcp-server.sh
```

This will test:
- ✅ Server info endpoint
- ✅ Manifest endpoint (tool discovery)
- ✅ Tools list
- ✅ SSE connection
- ✅ JSON-RPC initialize
- ✅ JSON-RPC tools/list

### Check Cursor Logs

1. Open Cursor
2. Go to **View** → **Output**
3. Select **"MCP"** or **"Cline"** from dropdown
4. Look for connection messages

### Check Supabase Logs

1. Go to Supabase Dashboard
2. **Edge Functions** → `rari-mcp-server` → **Logs**
3. Look for:
   - `[MCP Server] SSE connection requested`
   - `[MCP Server] Session X stored`
   - `[MCP Server] Handling tools/list request`

---

## 🚀 Step 4: Once Cursor Works, Connect ElevenLabs

After verifying Cursor can connect:

1. **Use the same URL** in ElevenLabs:
   ```
   https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse
   ```

2. **If Cursor works but ElevenLabs doesn't:**
   - The issue is ElevenLabs-specific
   - Check ElevenLabs MCP server format requirements
   - Try the `/manifest` endpoint directly in ElevenLabs

---

## 🛠️ Alternative: HTTP Streamable Transport

If SSE doesn't work, we can add HTTP streamable support:

The MCP server already supports HTTP POST for tool calls, but we might need to add a streamable HTTP endpoint for ElevenLabs.

---

## 📊 Quick Test Commands

### Test Server Info
```bash
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server
```

### Test Manifest (ElevenLabs format)
```bash
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/manifest | jq
```

### Test Tools List
```bash
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/tools | jq '.tools | length'
```

### Test SSE Connection
```bash
curl -N https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse
```

---

## ✅ Success Checklist

- [ ] Cursor MCP server configured
- [ ] Cursor restarted
- [ ] Test query works in Cursor
- [ ] Tools are visible in Cursor
- [ ] Can call fleet tools from Cursor
- [ ] Supabase logs show connections
- [ ] Ready to try ElevenLabs with same URL

---

## 🎯 Next Steps

1. **Get Cursor working first** - This validates the MCP server
2. **Debug any issues** - Fix them while testing in Cursor
3. **Then try ElevenLabs** - Use the same working URL
4. **If ElevenLabs still fails** - The issue is format-specific, we'll fix it

---

**Let's get Cursor working first, then we'll tackle ElevenLabs!** 🚀

# ElevenLabs MCP Connection Debugging Guide

**Problem:** ElevenLabs not seeing available tools when testing MCP connection

---

## 🔍 Debugging Steps

### Step 1: Verify MCP Server is Accessible

```bash
# Test basic connectivity
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server

# Should return server info with toolCount: 25
```

### Step 2: Test Manifest Endpoint

ElevenLabs might be calling the manifest endpoint directly:

```bash
curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/manifest | jq
```

**Expected Response:**
```json
{
  "type": "mcp.tool_manifest",
  "tools": [
    {
      "name": "get_fleet_vehicles",
      "description": "...",
      "parameters": {...}
    },
    ... (25 tools total)
  ]
}
```

### Step 3: Test SSE Endpoint

```bash
# Test SSE connection (should see endpoint event)
timeout 5 curl -N https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse
```

**Expected Output:**
```
event: endpoint
data: https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/messages?sessionId=xxx

event: ready
data: {"status":"connected"}

: ping
```

### Step 4: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → `rari-mcp-server`
2. Click **Logs** tab
3. Look for:
   - `[MCP Server] SSE connection requested`
   - `[MCP Server] Manifest requested`
   - Any error messages

---

## 🐛 Common Issues & Fixes

### Issue 1: "Connection Failed" in ElevenLabs

**Possible Causes:**
- URL has trailing slash
- CORS issues
- Server not responding

**Fix:**
- Ensure URL is exactly: `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse`
- No trailing slash
- Test with curl first

### Issue 2: "No Tools Found"

**Possible Causes:**
- Manifest endpoint not returning correct format
- Tools list empty
- JSON format mismatch

**Fix:**
1. Test manifest endpoint:
   ```bash
   curl https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/manifest
   ```
2. Verify it returns 25 tools
3. Check JSON is valid

### Issue 3: "Unauthorized" Error

**Possible Causes:**
- `MCP_SECRET_TOKEN` is set but not provided
- Token mismatch

**Fix:**
- If you set `MCP_SECRET_TOKEN`, add it in ElevenLabs
- If you didn't set it, ensure it's not set in Supabase

### Issue 4: SSE Connection Drops Immediately

**Possible Causes:**
- Keep-alive not working
- Connection timeout
- Server error

**Fix:**
- Check Supabase logs for errors
- Verify keep-alive pings are sent
- Check network connectivity

---

## 🔧 Alternative: Use HTTP Streamable Transport

If SSE doesn't work, ElevenLabs also supports HTTP streamable transport. We can add this endpoint:

**URL Format:**
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/stream
```

This would use HTTP POST with streaming responses instead of SSE.

---

## 🧪 Test Script

Run the comprehensive test:

```bash
chmod +x test-mcp-server.sh
./test-mcp-server.sh
```

This tests all endpoints and shows what's working.

---

## 📋 ElevenLabs Configuration Checklist

When adding MCP server in ElevenLabs:

- [ ] **Server Type:** SSE (Server-Sent Events)
- [ ] **Server URL:** Exact URL (no trailing slash)
- [ ] **Secret Token:** Leave empty (unless you set `MCP_SECRET_TOKEN`)
- [ ] **HTTP Headers:** Not needed
- [ ] **Trust Checkbox:** ✅ Checked
- [ ] **Connection Test:** Should show "Connected" and list 25 tools

---

## 🎯 Next Steps

1. **Run test script** - Verify server is working
2. **Check Supabase logs** - See what ElevenLabs is requesting
3. **Try Cursor first** - Validate MCP server works
4. **Compare formats** - If Cursor works, compare what it expects vs ElevenLabs

---

## 💡 Pro Tip: Use Cursor to Validate

**Best approach:**
1. Get Cursor MCP working first (easier to debug)
2. Once Cursor can see and use tools, the server is correct
3. Then the issue is ElevenLabs-specific format requirements
4. We can adjust the server format for ElevenLabs compatibility

---

**Let's get Cursor working first, then we'll know the server is correct!** 🚀

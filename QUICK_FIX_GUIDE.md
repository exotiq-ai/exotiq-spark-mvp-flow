# Quick Fix: ElevenLabs Not Seeing Tools

## 🎯 Strategy: Cursor First, Then ElevenLabs

**Why:** Cursor is easier to debug and will validate the MCP server works correctly.

---

## ⚡ Quick Actions (Do These Now)

### 1. Test the MCP Server

```bash
cd "/Users/g.r./Documents/EXOTIQ/Loveable & GitHub Downloads/MVP - Github Repo 12:29:25/exotiq-spark-mvp-flow"
./test-mcp-server.sh
```

**What to look for:**
- ✅ Server info shows `toolCount: 25`
- ✅ Manifest returns 25 tools
- ✅ Tools list works
- ✅ SSE connects

### 2. Set Up Cursor MCP (5 minutes)

1. **Open Cursor Settings:**
   - Cmd/Ctrl + ,
   - Search "MCP"

2. **Add Remote MCP Server:**
   - **Name:** `Rari Fleet Tools`
   - **URL:** `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server/sse`
   - **Transport:** SSE

3. **Restart Cursor**

4. **Test in Cursor Chat:**
   - Ask: *"What vehicles do I have?"*
   - Should call `get_fleet_vehicles` tool

### 3. Check Supabase Logs

1. Go to: https://supabase.com/dashboard/project/jlgwbbqydjeokypoenoc
2. **Edge Functions** → `rari-mcp-server` → **Logs**
3. Look for connection attempts from ElevenLabs

---

## 🔍 What We're Looking For

### If Cursor Works:
✅ MCP server is correct  
→ Issue is ElevenLabs-specific format  
→ We'll adjust server for ElevenLabs compatibility

### If Cursor Doesn't Work:
❌ MCP server has an issue  
→ We'll fix the server first  
→ Then try ElevenLabs again

---

## 🐛 Common ElevenLabs Issues

### Issue: "Connection Failed"
- **Check:** URL has no trailing slash
- **Check:** Server is accessible (test with curl)
- **Check:** CORS headers are correct

### Issue: "No Tools Found"
- **Check:** Manifest endpoint returns tools
- **Check:** JSON format is valid
- **Check:** Tool count is 25

### Issue: "Unauthorized"
- **Check:** `MCP_SECRET_TOKEN` is not set (or matches)
- **Check:** No auth required if token not set

---

## 📋 Files Created

1. **`test-mcp-server.sh`** - Comprehensive server testing
2. **`CURSOR_MCP_SETUP.md`** - Cursor integration guide
3. **`ELEVENLABS_DEBUG_GUIDE.md`** - ElevenLabs troubleshooting
4. **`cursor-mcp-config.json`** - Cursor config template

---

## 🚀 Next Steps

1. **Run test script** → Verify server works
2. **Set up Cursor** → Validate MCP integration
3. **Check logs** → See what ElevenLabs is requesting
4. **Fix based on findings** → Adjust server if needed

---

## 💡 Pro Tip

**Best debugging approach:**
1. Get Cursor working (validates server)
2. Check what Cursor expects vs ElevenLabs
3. Adjust server format if needed
4. Test ElevenLabs again

---

**Let's start with the test script and Cursor setup!** 🎯

# 🚨 RARI MCP - Critical Fix Needed

**Date:** January 7, 2026  
**Status:** 🔴 **BLOCKED on Authentication**

---

## ⚡ THE PROBLEM

New MCP deployment returns:
```json
{"code":401,"message":"Missing authorization header"}
```

**ElevenLabs can't connect because it doesn't send auth headers!**

---

## ✅ WHAT WORKS (Old URL)

Your OLD MCP server still works fine:
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server
```

Response (no auth needed):
```json
{
  "name":"Rari Fleet Assistant MCP Server",
  "version":"1.0.0",
  "protocol":"MCP (JSON-RPC 2.0)",
  "toolCount":25
}
```

---

## 🔧 TELL SUPABASE AI TO FIX

### **Message to Send:**

```
"The new MCP endpoint requires authentication, but ElevenLabs 
can't provide auth headers when connecting to MCP servers.

Please fix these TWO things:

1. REMOVE authentication requirement
   - Make /messages endpoint publicly accessible
   - Allow anonymous GET and POST requests
   - Keep CORS enabled

2. ADD live tool_code SSE events
   - Broadcast 'event: tool_code' with status: 'executing' 
     when tool starts
   - Broadcast 'event: tool_code' with status: 'completed' 
     when tool finishes
   - Push these to SSE stream during POST tool execution

After deployment, provide test curl commands so I can verify 
both fixes work before connecting ElevenLabs."
```

---

## 🧪 HOW TO TEST AFTER FIX

### **1. Test No Auth Required:**
```bash
curl -N "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/rari-mcp-server/messages?sessionId=test-123"
```

**Success =** No 401 error, see `endpoint` and `ready` events

### **2. Test Tool Discovery:**
```bash
curl -X POST "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/rari-mcp-server/messages?sessionId=test-123" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Success =** JSON response with 25 tools

### **3. Test Tool Code Events:**
Open TWO terminals:

**Terminal 1 (keep running):**
```bash
curl -N "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/rari-mcp-server/messages?sessionId=test-456"
```

**Terminal 2 (run after Terminal 1 connects):**
```bash
curl -X POST "https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/rari-mcp-server/messages?sessionId=test-456" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_fleet_vehicles","arguments":{"status":"all"}}}'
```

**Success =** In Terminal 1, you see:
```
event: tool_code
data: {"status":"executing","toolName":"get_fleet_vehicles"}

event: tool_code
data: {"status":"completed","toolName":"get_fleet_vehicles"}
```

---

## ✅ ONCE FIXED, CONNECT TO ELEVENLABS

1. Go to: https://elevenlabs.io/app/conversational-ai
2. Select agent: `agent_0001k9d5pvdwfmvv7aq0mhaexgd6`
3. Find: **"Add MCP Server"** (not custom tools!)
4. Enter:
   - **Name:** Rari Fleet Tools
   - **Type:** SSE
   - **URL:** `https://mlfzduuclgdscdlztzdi.supabase.co/functions/v1/rari-mcp-server/messages`
   - **No auth/token needed**
5. Click **Test Connection**
6. Should see: ✅ Connected - 25 tools discovered

---

## 🎯 WHY THIS WILL WORK

1. ✅ **Unified endpoint** - GET/POST on same URL (ElevenLabs requirement)
2. ✅ **SSE events** - endpoint + ready + tool_code (all required)
3. ✅ **JSON-RPC** - Standard protocol (tools/list, tools/call)
4. ✅ **Session management** - Per-conversation via sessionId
5. ✅ **No auth** - Public access (after fix)

---

## 📊 COMPARISON

| | Old Server | New Server (Current) | New Server (After Fix) |
|---|---|---|---|
| **Auth** | None ✅ | Required ❌ | None ✅ |
| **Endpoint** | Split | Unified ✅ | Unified ✅ |
| **Tool Code** | No | Inline only 🔶 | SSE broadcast ✅ |
| **Works with ElevenLabs** | Partial | No ❌ | Yes ✅ |

---

## ⏱️ TIMELINE

1. **Now:** Request fixes from Supabase AI
2. **~30 min:** They redeploy
3. **~5 min:** You test with curl
4. **~2 min:** Connect to ElevenLabs
5. **~1 min:** Test with Rari: "What vehicles do I have?"
6. **SUCCESS!** 🎉

---

## 🔄 FALLBACK OPTION

If MCP continues to have issues, **your webhook solution is PROVEN to work:**

```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools
```

I tested this - it returns real fleet data WITHOUT any auth issues.

You can add tools individually as webhooks (takes longer but 100% works).

---

## 💡 BOTTOM LINE

**Current State:** New MCP server deployed but has auth blocking it

**What's Needed:** Two simple fixes (no auth + SSE tool_code)

**Time to Fix:** < 1 hour total (mostly waiting for deployment)

**Confidence Level:** 95% this will work once fixed

---

**Next Step:** Send that message to Supabase AI and wait for redeployment! 🚀

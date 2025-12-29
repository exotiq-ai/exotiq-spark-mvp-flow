# Testing Cursor Integration in ElevenLabs

**Status:** ✅ Cursor API key added to Rari agent

---

## 🧪 Test Commands for Rari

Try these commands with Rari to test the Cursor integration:

### Test 1: List Agents
**Ask Rari:** *"List my Cursor agents"* or *"What Cursor agents do I have?"*

**Expected:** Rari should call the `List Agents` tool and show your Cursor agents.

### Test 2: Launch an Agent
**Ask Rari:** *"Launch a Cursor agent to help with my codebase"*

**Expected:** Rari should call the `Launch Agent` tool and start a background agent.

### Test 3: Get Agent Status
**Ask Rari:** *"What's the status of my Cursor agents?"*

**Expected:** Rari should call the `Get Agent` tool and show agent status.

### Test 4: Combined Task
**Ask Rari:** *"Can you help me understand my codebase structure?"*

**Expected:** Rari might use Cursor tools to explore your code.

---

## ✅ What Success Looks Like

When Cursor integration works:
- ✅ Rari can call Cursor tools (Launch Agent, List Agents, etc.)
- ✅ You see tool execution in ElevenLabs
- ✅ Agents can be launched and managed
- ✅ Rari can work on your codebase

---

## 🔍 If It Doesn't Work

**Check:**
1. **ElevenLabs Dashboard:**
   - Go to your Rari agent
   - Check "Integrations" or "Tools" section
   - Verify Cursor integration is enabled
   - Check for any error messages

2. **Cursor API Key:**
   - Verify key is valid at https://cursor.com/settings
   - Check if key has proper permissions
   - Ensure key is not expired

3. **ElevenLabs Logs:**
   - Check agent logs for tool execution
   - Look for error messages
   - See if tools are being called

---

## 🎯 Next: Test MCP Server

While testing Cursor, let's also verify the MCP server:

```bash
./test-mcp-server.sh
```

This will show if the MCP server is working correctly for fleet data access.

---

## 📊 Integration Status

- ✅ **Cursor Integration:** Added and ready to test
- ⚠️ **MCP Server:** Needs debugging (tools not appearing)

**Once both work, Rari will have full capabilities!** 🚀

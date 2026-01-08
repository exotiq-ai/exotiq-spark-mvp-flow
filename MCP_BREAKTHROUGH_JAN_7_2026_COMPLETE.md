# 🎉 MCP Breakthrough Documentation

**Exotiq FleetCopilot - ElevenLabs + Supabase MCP Integration**

**Date:** January 7, 2026  
**Status:** ✅ WORKING  
**Time to Resolution:** ~20 minutes (after 16 hours of failed attempts)

---

## 🎯 Executive Summary

Successfully connected ElevenLabs Conversational AI (Rari/FleetCopilot) to Supabase database via the Model Context Protocol (MCP). This enables the voice AI to query and interact with the fleet database in real-time.

**The breakthrough:** Supabase released a remote hosted MCP server that supports the transport protocols ElevenLabs requires (SSE and Streamable HTTP). Previous attempts failed because we were trying to use local stdio-based MCP servers which are incompatible with cloud-based AI agents.

---

## 🔗 The Exact URL Format

### **Production URL**
```
https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF
```

### **Exotiq's Configured URL**
```
https://mcp.supabase.com/mcp?project_ref=mlfzduuclgdscdlztzdi
```

### **URL Components**

| Component | Value | Description |
|-----------|-------|-------------|
| **Base URL** | `https://mcp.supabase.com/mcp` | Supabase's hosted remote MCP server |
| **project_ref** | `mlfzduuclgdscdlztzdi` | Your Supabase project reference ID |

### **Where to Find Your Project Reference**

1. Go to Supabase Dashboard
2. Select your project
3. Look at the URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
   **OR**
   Go to: Project Settings → General → "Reference ID"

---

## ⚙️ ElevenLabs Configuration (Exact Settings)

### **Step 1: Access MCP Integration**

1. Navigate to: **ElevenLabs Dashboard → Integrations → MCP Server Integrations**
2. Click: **"Add Custom MCP Server"**

### **Step 2: Basic Information**

| Field | Value |
|-------|-------|
| **Name** | Supabase MCP |
| **Description** | Rari Fleet tools (or your description) |

### **Step 3: Server Configuration**

| Field | Value |
|-------|-------|
| **Server Type** | **Streamable HTTP** ← CRITICAL: Select this, not SSE |
| **Server URL Type** | Value |
| **Server URL** | `https://mcp.supabase.com/mcp?project_ref=mlfzduuclgdscdlztzdi` |

### **Step 4: Secret Token**

| Field | Value |
|-------|-------|
| **Secret** | Leave as default or select existing secret |

### **Step 5: HTTP Headers (Authentication)**

| Field | Value |
|-------|-------|
| **Type** | Value (or Secret for production) |
| **Name** | `Authorization` |
| **Value** | `Bearer sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

**Important:** The value must be `Bearer ` followed by your Supabase Personal Access Token. Note the space after "Bearer".

### **Step 6: Tool Approval Mode**

| Option | Recommended For |
|--------|----------------|
| **Always Ask** | Testing - asks permission before each tool use |
| **Fine-Grained Tool Approval** | Production - configure per-tool permissions |
| **No Approval** | Demo/trusted environments - AI uses tools freely |

### **Step 7: Tool Settings**

| Setting | Recommended Value |
|---------|------------------|
| **Force Pre-tool Speech** | Unchecked |
| **Disable Interruptions** | Unchecked |
| **Execution Mode** | Immediate |
| **Tool Call Sound** | None |

### **Step 8: Final Steps**

1. Check **"I trust this server"**
2. Click **"Add Server"**
3. Wait for connection test (should show available tools)

---

## 🔄 Transport Types Explained

### **What is Streamable HTTP?**

Streamable HTTP is the modern MCP transport protocol that replaced SSE (Server-Sent Events) in March 2025. It's the recommended approach for remote MCP connections.

### **Key Characteristics**

- ✅ **Single endpoint:** Uses one URL for all communication (`/mcp`)
- ✅ **Bidirectional:** Both client and server can initiate messages
- ✅ **Stateless-capable:** Doesn't require persistent connections
- ✅ **HTTP-native:** Works with standard HTTP infrastructure (proxies, load balancers)

### **How It Works**

```
ElevenLabs Agent                    Supabase MCP Server
      |                                     |
      |------ POST /mcp (request) --------->|
      |<----- Response (or SSE stream) -----|
      |                                     |
      |------ POST /mcp (tool call) ------->|
      |<----- Tool result ------------------|
```

### **SSE vs Streamable HTTP**

| Aspect | SSE (Old) | Streamable HTTP (New) |
|--------|-----------|----------------------|
| **Endpoints** | Two (`/sse` + `/message`) | One (`/mcp`) |
| **Connection** | Persistent required | Stateless possible |
| **Direction** | Server → Client only | Bidirectional |
| **Compatibility** | Legacy clients | Modern standard |
| **Recommendation** | Deprecated | ✅ Use this |

---

## ❌ Why Previous Attempts Failed

The 16-hour struggle was caused by trying to use **stdio transport** which only works for local MCP servers:

### **❌ FAILED APPROACH (stdio - local only)**
```
Claude Desktop → spawns local process → MCP Server on localhost
                     ↓
              Uses stdin/stdout
                     ↓
        NOT accessible to cloud services like ElevenLabs
```

### **✅ WORKING APPROACH (Streamable HTTP - remote)**
```
ElevenLabs (cloud) → HTTPS request → Supabase MCP Server (cloud)
                           ↓
                    Uses HTTP/HTTPS
                           ↓
              Accessible from anywhere
```

---

## 🔐 Authentication Setup

### **Generate Supabase Personal Access Token**

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **"Generate New Token"**
3. Name: `ElevenLabs FleetCopilot` (or descriptive name)
4. Copy immediately (won't be shown again)
5. Token format: `sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### **Configure in ElevenLabs**

The token goes in the **HTTP Headers** section:

- **Name:** `Authorization`
- **Value:** `Bearer sbp_your_token_here`

### **Common Mistakes:**

- ❌ Forgetting `"Bearer "` prefix
- ❌ No space after `"Bearer"`
- ❌ Using the wrong token type (anon key vs access token)
- ❌ Token expired or revoked

---

## ✅ Test Results

### **Tools Discovered (29 total)**

After successful connection, ElevenLabs displayed these available tools:

#### **Database Tools**

| Tool | Description |
|------|-------------|
| `list_tables` | Lists all tables in one or more schemas |
| `list_extensions` | Lists all extensions in the database |
| `list_migrations` | Lists all migrations in the database |
| `apply_migration` | Applies a migration to the database |
| `execute_sql` | Executes raw SQL in the Postgres database |

#### **Project Management Tools**

| Tool | Description |
|------|-------------|
| `get_project_url` | Gets the API URL for a project |
| `get_publishable_keys` | Gets all publishable API keys |
| `generate_typescript_types` | Generates TypeScript types for a project |
| `get_logs` | Gets logs for a Supabase project by service type |
| `get_advisors` | Gets advisory notices for the project |

#### **Edge Functions Tools**

| Tool | Description |
|------|-------------|
| `list_edge_functions` | Lists all Edge Functions in a project |
| `get_edge_function` | Retrieves file contents for an Edge Function |
| `deploy_edge_function` | Deploys an Edge Function to a project |

#### **Branch Management Tools**

| Tool | Description |
|------|-------------|
| `create_branch` | Creates a development branch |
| `list_branches` | Lists all development branches |
| `delete_branch` | Deletes a development branch |
| `merge_branch` | Merges migrations from dev to production |
| `reset_branch` | Resets migrations of a development branch |

#### **Documentation Tools**

| Tool | Description |
|------|-------------|
| `search_docs` | Search Supabase documentation using GraphQL |

### **Verification Tests**

**Test 1: List Tables**
- Query: "What tables do I have in my database?"
- Result: ✅ Returned list of 16 existing tables

**Test 2: Schema Discovery**
- Query: "Describe the applications table"
- Result: ✅ Returned column definitions and types

**Test 3: Tool Availability**
- Verified all 29 tools visible in ElevenLabs interface
- Tool approval toggles functional

---

## 📋 Step-by-Step Setup Guide (Replication Instructions)

### **Prerequisites**

- [ ] ElevenLabs account with Agents Platform access
- [ ] Supabase project (any tier)
- [ ] Supabase Personal Access Token

### **Setup Procedure**

#### **Step 1: Generate Supabase Token (2 min)**

1. Open: https://supabase.com/dashboard/account/tokens
2. Click: "Generate New Token"
3. Name: "ElevenLabs MCP"
4. Copy the token (starts with `sbp_`)
5. Store securely - you won't see it again

#### **Step 2: Get Project Reference (1 min)**

1. Open: Supabase Dashboard
2. Select your project
3. Copy from URL: `supabase.com/dashboard/project/[THIS_PART]`
   **OR**
   Go to: Project Settings → General → Reference ID

#### **Step 3: Configure ElevenLabs (5 min)**

1. Open: ElevenLabs Dashboard
2. Navigate: Integrations → MCP Server Integrations
3. Click: "Add Custom MCP Server"

4. **Fill Basic Information:**
   - Name: Supabase MCP
   - Description: Fleet database tools

5. **Configure Server:**
   - Server Type: **Streamable HTTP** (NOT SSE)
   - URL Type: Value
   - URL: `https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF`

6. **Add HTTP Header:**
   - Click: "Add header"
   - Type: Value
   - Name: `Authorization`
   - Value: `Bearer YOUR_SUPABASE_TOKEN`

7. **Set Tool Approval:**
   - Select: "No Approval" for testing
   - (Change to Fine-Grained for production)

8. **Finalize:**
   - Check: "I trust this server"
   - Click: "Add Server"

#### **Step 4: Verify Connection (2 min)**

1. Wait for ElevenLabs to test connection
2. Should see: "Available tools" section populate
3. Verify: 20+ tools listed (`list_tables`, `execute_sql`, etc.)

#### **Step 5: Attach to Agent (2 min)**

1. Go to your ElevenLabs agent (FleetCopilot/Rari)
2. Navigate to: Tools section
3. Enable: "Supabase MCP"
4. Save changes

#### **Step 6: Test with Voice (2 min)**

1. Open agent conversation
2. Ask: "What tables do I have in my database?"
3. Expected: Agent lists your Supabase tables
4. Ask: "Show me the schema for [table_name]"
5. Expected: Agent describes columns and types

---

## 🐛 Troubleshooting

### **"Please enter a valid URL"**

**Cause:** URL is incomplete or malformed  
**Fix:** Ensure URL starts with `https://` and includes full path

### **"Connection failed"**

**Cause:** Invalid token or wrong project ref  
**Fix:**
- Regenerate Supabase token
- Verify `project_ref` matches your project
- Check `"Bearer "` prefix has a space

### **"No tools found"**

**Cause:** Authentication failed silently  
**Fix:**
- Verify token hasn't expired
- Check token has correct permissions
- Try regenerating token

### **Tools appear but don't work**

**Cause:** RLS policies blocking access  
**Fix:**
- Check Row Level Security settings
- Verify service role permissions
- Test with `execute_sql` on public tables first

---

## 🔒 Security Recommendations

### **For Development/Testing**

- ✅ Use "No Approval" mode for faster iteration
- ✅ Connect to development database only
- ✅ Use short-lived tokens

### **For Production**

- ✅ Use "Fine-Grained Tool Approval"
- ✅ Auto-approve: `list_tables`, `execute_sql` (SELECT only)
- ✅ Require approval: `apply_migration`, `deploy_edge_function`, any write operations
- ✅ Store token as ElevenLabs Secret (not plain Value)
- ✅ Enable Supabase Row Level Security
- ❌ Never connect to production database with full write access

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Voice/Text)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ELEVENLABS AGENT (Rari)                      │
│                   Conversational AI Platform                     │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Voice     │  │    LLM      │  │    MCP Client           │ │
│  │  Processing │  │  (Claude)   │  │  (Streamable HTTP)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS (Streamable HTTP)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              SUPABASE REMOTE MCP SERVER                         │
│              https://mcp.supabase.com/mcp                       │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Auth      │  │   Tool      │  │    Query                │ │
│  │  (Bearer)   │  │  Registry   │  │   Execution             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Internal Connection
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE PROJECT                             │
│              (mlfzduuclgdscdlztzdi)                             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  PostgreSQL │  │    Edge     │  │      Storage            │ │
│  │  Database   │  │  Functions  │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 Key Learnings

1. **Transport matters:** ElevenLabs needs SSE or Streamable HTTP. Local stdio MCP servers won't work.

2. **Supabase Remote MCP is new:** Released late 2025/early 2026. Previous documentation may reference the old local-only approach.

3. **URL must be complete:** The "invalid URL" error means `https://` is missing.

4. **Bearer token format:** Must be exactly `Bearer sbp_xxx` with one space.

5. **Project scoping is optional but recommended:** Adding `?project_ref=xxx` limits access to one project.

---

## 📚 Related Documentation

- [Supabase MCP Docs](https://supabase.com/docs/guides/ai/mcp)
- [ElevenLabs MCP Integration](https://elevenlabs.io/docs/conversational-ai/mcp)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [Supabase Remote MCP Announcement](https://supabase.com/blog/mcp)

---

## 📝 Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-07 | Gregory + Opus (Claude) | Initial breakthrough and documentation |
| 2026-01-08 | Gregory + Cursor (Claude) | Formalized documentation, added to project |

---

**Status:** ✅ **PRODUCTION READY**  
**Time Saved:** Hours of future debugging avoided  
**Tools Available:** 29 Supabase database and management tools  
**Next Steps:** Add custom fleet-specific tools, optimize security settings

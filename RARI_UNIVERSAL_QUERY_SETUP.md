# 🚀 RARI UNIVERSAL QUERY - Complete Setup Guide

**The Scalable Solution You've Been Looking For!**

---

## 🎯 **WHAT THIS IS:**

Instead of configuring 25, 50, or 100+ individual tools, you configure **ONE tool** that handles **EVERYTHING**.

### **How It Works:**
```
User: "What's my Miami revenue vs Scottsdale this month?"
  ↓
Rari calls: universal_query tool
  ↓
Function interprets natural language
  ↓
Queries your Supabase database
  ↓
Returns formatted answer
```

**Add new features → They automatically work!** 🎉

---

## ⚡ **SETUP (15 Minutes Total)**

### **Step 1: Deploy the Function (5 min)**

The function is already created at:
```
supabase/functions/rari-universal-query/index.ts
```

**Deploy it to Supabase:**

```bash
# Navigate to your project
cd /Users/g.r./Documents/EXOTIQ/Loveable\ \&\ GitHub\ Downloads/EXOTIQ\ COMAND\ CENTER\ MVP\ 1\:1\:25/exotiq-spark-mvp-flow

# Deploy the function
npx supabase functions deploy rari-universal-query
```

**Your function URL will be:**
```
https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query
```

---

### **Step 2: Test It Locally (2 min)**

Test with curl to make sure it works:

```bash
# Test: Revenue query
curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is my total revenue this month?"
  }'

# Test: Vehicle query
curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me all available vehicles in Miami"
  }'

# Test: Comparison query
curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Compare Miami vs Scottsdale revenue this month"
  }'
```

**Expected:** JSON response with `summary`, `totalRevenue`, `bookingCount`, etc.

---

### **Step 3: Add to ElevenLabs (5 min)**

Go to: https://elevenlabs.io/app/conversational-ai → **Tools** tab

**Click:** "Add webhook tool"

**Configure:**

| Field | Value |
|-------|-------|
| **Tool Name** | `universal_query` |
| **Description** | Ask any question about fleet operations, revenue, vehicles, bookings, analytics, forecasts, pricing, customers, or business intelligence using natural language |
| **Webhook URL** | `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query` |
| **Method** | POST |
| **Headers** | `Content-Type: application/json` |

**Parameters:**

1. **query** (string, required)
   - Description: Natural language question about your fleet business
   - Example: "What's my revenue in Miami this month?"

2. **context** (object, optional)
   - Description: Additional context like timeframes, locations, etc.
   - Properties:
     - `timeframe` (string): e.g., "today", "week", "month"
     - `locations` (array of strings): e.g., ["Miami", "Scottsdale"]
     - `startDate` (string): ISO date
     - `endDate` (string): ISO date

**Click:** Save

---

### **Step 4: Upload Capabilities Document (3 min)**

In ElevenLabs, go to: **Knowledge Base** tab

**Click:** "Add Document" or "Upload"

**Upload:** `RARI_CAPABILITIES_KNOWLEDGE_BASE.md`

This teaches Rari what she can do and how to use the universal query tool effectively!

---

### **Step 5: Update Agent System Prompt (Optional)**

In ElevenLabs agent settings, add to system prompt:

```
You have access to a powerful universal_query tool that can answer ANY 
question about the fleet business. Use it for:

- Revenue and financial analytics
- Vehicle availability and status
- Fleet performance metrics
- Booking management
- Pricing recommendations
- Demand forecasting
- Customer information
- Maintenance tracking
- Business intelligence

Just pass the user's question as the 'query' parameter in natural language.
The tool will interpret the intent and return relevant data.

Examples:
- universal_query("What's my Miami revenue this month?")
- universal_query("Show me idle vehicles with low utilization")
- universal_query("Compare performance between Miami and Scottsdale")
```

---

## 🧪 **TESTING**

### **Test 1: Revenue Query**
**Say to Rari:** "What's my total revenue this month?"

**Expected:** 
- Rari calls `universal_query`
- Returns revenue number and booking count
- Mentions timeframe

### **Test 2: Vehicle Query**
**Say to Rari:** "Show me all available vehicles in Miami"

**Expected:**
- Returns list of available vehicles
- Filters by Miami location
- Shows status, rates, utilization

### **Test 3: Comparison Query**
**Say to Rari:** "Compare Miami revenue vs Scottsdale this month"

**Expected:**
- Returns breakdown by location
- Shows total for each
- Compares the two

### **Test 4: Complex Query**
**Say to Rari:** "Which vehicles are sitting idle with low utilization?"

**Expected:**
- Identifies available vehicles
- Filters by low utilization (<20%)
- Suggests optimization

---

## 🎯 **WHAT THIS UNLOCKS**

### **Current Capabilities (Day 1):**
✅ Revenue analysis by time/location  
✅ Vehicle availability and status  
✅ Fleet metrics and performance  
✅ Booking searches  
✅ Location comparisons  
✅ Idle vehicle detection  

### **Easy to Add (Day 2+):**
🔄 Maintenance tracking - add handler for maintenance queries  
🔄 Customer analytics - add customer query handler  
🔄 Pricing recommendations - integrate with pricing logic  
🔄 Demand forecasting - add PredictHQ integration  
🔄 Payment tracking - add payment query handler  
🔄 Team workflows - add team management handler  

**Every new feature = Just add a handler function!**

**NO new tool configuration in ElevenLabs needed!**

---

## 📈 **SCALING PATTERN**

### **To Add New Capabilities:**

1. **Add Handler Function** in `rari-universal-query/index.ts`:
```typescript
async function handleCustomerQuery(supabase, userId, query, context) {
  // Your logic here
  return { summary: "...", data: {...} };
}
```

2. **Add Keywords** to `QUERY_PATTERNS`:
```typescript
const QUERY_PATTERNS = {
  // ... existing patterns
  customer: ['customer', 'client', 'guest', 'booking history'],
};
```

3. **Add Route** in main handler:
```typescript
case 'customer':
  result = await handleCustomerQuery(supabase, userId, query, context);
  break;
```

4. **Deploy:**
```bash
npx supabase functions deploy rari-universal-query
```

5. **DONE** - Rari automatically knows about it!

---

## 🔮 **FUTURE ENHANCEMENTS**

### **Phase 2: AI Intent Detection**
Replace keyword matching with OpenAI/Claude to interpret ANY query:

```typescript
const intent = await analyzeQueryIntent(query); // Uses AI
const handler = getHandlerForIntent(intent);
```

### **Phase 3: Multi-Step Reasoning**
Enable complex multi-step queries:
- "Show me vehicles that are idle in Miami and recommend pricing adjustments"
- Breaks into: 1) Find idle vehicles, 2) Analyze pricing, 3) Generate recommendations

### **Phase 4: Predictive Insights**
Proactive suggestions:
- "Your Ferrari SF90 has been idle for 10 days - should we adjust pricing?"
- "Art Basel is coming up - expect 40% demand surge in Miami"

---

## 💡 **BEST PRACTICES**

### **For Users (Train them):**
- Be specific: "Miami revenue this month" vs "revenue"
- Include timeframes: "last week", "this month", "Q4"
- Compare locations: "Miami vs Scottsdale"
- Ask follow-ups: "Now show me by vehicle type"

### **For Developers (You):**
- Add logging to track common queries
- Optimize handlers based on usage patterns
- Cache frequent queries
- Add error handling for edge cases

---

## 🐛 **TROUBLESHOOTING**

### **Issue: "I had trouble processing that query"**
**Fix:** Query is too ambiguous. Add more specific keywords or context.

### **Issue: Returns empty results**
**Check:** 
1. Demo user has data in database
2. Date filters aren't too restrictive
3. Location names match database values

### **Issue: Slow response**
**Optimize:**
1. Add database indexes
2. Limit result sets
3. Cache common queries

---

## 📊 **COMPARISON: Old Way vs New Way**

### **Old Way (Manual Tools):**
```
Add feature → Write code → Deploy → Configure in ElevenLabs UI
= 5 steps per feature
= 25 features × 5 steps = 125 manual steps
```

### **New Way (Universal Query):**
```
Add feature → Write handler → Deploy
= 3 steps per feature
= NO UI configuration needed
= Infinite scalability
```

---

## 🎉 **SUCCESS CRITERIA**

You'll know it's working when:

1. ✅ Rari answers revenue questions with real numbers
2. ✅ Rari can find specific vehicles by location
3. ✅ Rari compares Miami vs Scottsdale correctly
4. ✅ You add a new feature and it works WITHOUT touching ElevenLabs UI

---

## 🚀 **NEXT STEPS**

1. **Deploy the function** (5 min)
2. **Add to ElevenLabs** (5 min)
3. **Upload capabilities doc** (2 min)
4. **Test with 5 queries** (3 min)
5. **Celebrate** - You just built scalable AI! 🎉

Then incrementally add:
- Maintenance handlers
- Customer analytics
- Pricing optimization
- Demand forecasting
- Payment tracking

**Each addition: 15 min of code, ZERO UI configuration!**

---

## 💪 **YOU'VE UNLOCKED:**

✅ Natural language query interface  
✅ Infinite scalability without manual config  
✅ The MCP-like auto-discovery you wanted  
✅ Proven webhook stability  
✅ Real-time fleet intelligence  
✅ Extensible architecture  

**This is what you envisioned from the start!** 🎯

---

**Ready to deploy? Run the deployment command and let's test it!** 🚀

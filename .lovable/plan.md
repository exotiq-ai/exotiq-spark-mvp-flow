

# Fix ElevenLabs Tool Inference from URL Query Parameters

## Problem Identified

Looking at the edge function logs, I found the exact issue:

| Request Type | What ElevenLabs Sends | Current Behavior | Result |
|-------------|----------------------|------------------|--------|
| POST with body | `{"timeframe": "today"}` | ✅ Infers `getFleetMetrics` | **Works** |
| GET with query | `?limit=5` (body is `{}`) | ❌ No tool inference | **400 Error** |
| GET with query | `?status=confirmed` (body is `{}`) | ❌ No tool inference | **400 Error** |

The `extractToolCall` function already maps body params like `{"timeframe": "today"}` to tools, but it **doesn't apply the same logic to URL query parameters** when the body is empty.

---

## Solution

Add a new step in `extractToolCall()` that applies the same parameter-to-tool mapping logic to URL query parameters when the body is empty.

### Code Change

**File: `supabase/functions/elevenlabs-tools/index.ts`**

Insert this logic after the existing query param name check (around line 225), before the body-based extraction:

```typescript
// NEW STEP: If body is empty but URL has query params, infer tool from query params
if ((!body || Object.keys(body).length === 0) && url.searchParams.size > 0) {
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    // Skip tool name keys since they're handled above
    if (!['tool_name', 'tool', 'name', 'function_name'].includes(key)) {
      queryParams[key] = value;
    }
  });
  
  const paramKeys = Object.keys(queryParams);
  
  if (paramKeys.length > 0) {
    // Single param: use PARAMETER_TO_TOOL_MAP
    if (paramKeys.length === 1) {
      const k = paramKeys[0];
      if (PARAMETER_TO_TOOL_MAP[k]) {
        console.log(`[extractToolCall] Mapping URL param { "${k}": "${queryParams[k]}" } to tool: ${PARAMETER_TO_TOOL_MAP[k]}`);
        return { toolName: PARAMETER_TO_TOOL_MAP[k], parameters: queryParams };
      }
      // Special case: limit → get_recent_activity
      if (k === 'limit') {
        console.log(`[extractToolCall] Mapping URL param "limit" to tool: get_recent_activity`);
        return { toolName: 'get_recent_activity', parameters: queryParams };
      }
    }
    
    // Multi-param: use same inference as body
    let inferredTool = 'get_fleet_vehicles'; // default
    if (paramKeys.includes('customerName')) inferredTool = 'getCustomerProfile';
    else if (paramKeys.includes('vehicleName')) inferredTool = 'getVehicleDetails';
    else if (paramKeys.includes('timeframe')) inferredTool = 'getFleetMetrics';
    else if (paramKeys.includes('status')) inferredTool = 'get_bookings';
    else if (paramKeys.includes('limit')) inferredTool = 'get_recent_activity';
    
    console.log(`[extractToolCall] Inferred tool from URL params ${JSON.stringify(paramKeys)}: ${inferredTool}`);
    return { toolName: inferredTool, parameters: queryParams };
  }
}
```

---

## Expected Behavior After Fix

| Request | Inferred Tool | Parameters |
|---------|--------------|------------|
| `GET ?limit=5` | `get_recent_activity` | `{"limit": "5"}` |
| `GET ?status=confirmed` | `get_bookings` | `{"status": "confirmed"}` |
| `GET ?timeframe=today` | `getFleetMetrics` | `{"timeframe": "today"}` |
| `GET ?vehicleName=Ferrari` | `getVehicleDetails` | `{"vehicleName": "Ferrari"}` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/elevenlabs-tools/index.ts` | Add URL query param inference in `extractToolCall()` |

---

## Why This Will Work

1. **Existing mapping already works for POST** - `{"timeframe": "today"}` correctly maps to `getFleetMetrics`
2. **Same logic applied to GET query params** - `?timeframe=today` will now also map correctly
3. **No ElevenLabs dashboard changes needed** - The edge function handles all formats


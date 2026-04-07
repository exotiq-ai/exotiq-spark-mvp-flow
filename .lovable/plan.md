

# RBAC for Rari & Pricing — What Needs to Change Where

## Architecture Answer: It's ALL Client-Side

Rari's data tools (`useRariClientTools.ts`) execute **in the browser** as client tools via the ElevenLabs React SDK. The flow is:

1. User speaks to Rari → ElevenLabs agent decides to call a tool (e.g. `getRevenueAnalysis`)
2. ElevenLabs sends a `client_tool_call` event back to the browser
3. The `useConversation` hook runs the matching function from `clientTools` (line 121-124 of RariVoiceInterface.tsx)
4. The function queries Supabase using the user's auth session and returns a string
5. ElevenLabs reads the response and speaks it

**Nothing needs to change in ElevenLabs.** The agent still "offers" all tools — but when an operator triggers a restricted one, our client-side code returns a permission-denied message instead of data. Rari then speaks that message back naturally (e.g. "Revenue data requires manager access — ask your admin for a report").

## Changes Required

### 1. `src/hooks/useRariClientTools.ts`
- Add a third parameter: `userRole?: string`
- In `getRevenueAnalysis` and `getPaymentSummary`: if role is `operator` or `viewer`, return a friendly denial string instead of querying
- All other tools (fleet status, bookings, availability) remain unrestricted

### 2. `src/components/rari/RariVoiceInterface.tsx`
- Import `useUserRole` hook
- Pass `role` to `createRariClientTools(user.id, currentTeam?.id, role)`

### 3. `src/components/rari/RariQuickCommands.tsx`
- Import `useUserRole`
- Filter out "Revenue Report" and "Demand Forecast" commands when role is below manager

### 4. `src/components/dashboard/MotorIQEnhanced.tsx`
- Wrap pricing action buttons in `PermissionGuard minRole="manager"`
- Operators see MotorIQ data read-only (no edit pricing, no apply rate)

### 5. `src/components/fleet/FleetPageEnhanced.tsx`
- Gate "Edit Price" button behind `PermissionGuard minRole="manager"`

### 6. `src/components/dashboard/DashboardOverviewEnhanced.tsx`
- Gate PriceOptimizationDialog trigger behind `PermissionGuard minRole="manager"`

### 7. `src/components/pricing/QuickPriceEditorContent.tsx`
- Add role check before `onApplyRate` — toast warning for non-managers

## What Does NOT Need to Change

| Thing | Why |
|-------|-----|
| ElevenLabs agent config | Tools are client-side; agent still lists them but our code gates execution |
| ElevenLabs system prompt | Rari doesn't need to know about roles — the denial message speaks for itself |
| Edge functions | They use service role, unaffected by RLS or client-side checks |
| Database / RLS | The `rari_insights` policy already scopes by user; vehicle UPDATE RLS is a future hardening task |
| Webhook tools config | Only applies to server-side tool calls, not client tools |

## How Rari Handles Denial Gracefully

When an operator asks "What's my revenue this week?":
1. ElevenLabs calls `getRevenueAnalysis` client tool
2. Our code checks role → returns `"Revenue analytics require manager-level access. Please ask your fleet manager or admin for this information."`
3. Rari speaks this naturally — no error, no crash, just a polite redirect

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useRariClientTools.ts` | Add role param, gate revenue/payment tools |
| `src/components/rari/RariVoiceInterface.tsx` | Pass user role to client tools |
| `src/components/rari/RariQuickCommands.tsx` | Filter revenue/pricing commands by role |
| `src/components/dashboard/MotorIQEnhanced.tsx` | PermissionGuard on pricing actions |
| `src/components/fleet/FleetPageEnhanced.tsx` | PermissionGuard on price edit button |
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | PermissionGuard on PriceOptimizationDialog |
| `src/components/pricing/QuickPriceEditorContent.tsx` | Role check before rate save |

## Risk

**Low.** All changes are additive guards using existing `useUserRole` and `PermissionGuard`. Rari continues to work for all roles — operators just get polite "ask your manager" responses for revenue/pricing tools instead of data.


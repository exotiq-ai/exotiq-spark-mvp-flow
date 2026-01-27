# QA Engineering Roadmap for Production Launch

**Last Updated**: 2026-01-27  
**Target Launch State**: Enterprise Ready (9.0/10)  
**Current State**: Beta Ready (7.8/10)

---

## Quick Status Dashboard

| Category | Status | Priority | Owner |
|----------|--------|----------|-------|
| Security - Edge Functions | ⚠️ Needs Work | P0 | Backend |
| Security - RLS Policies | ✅ Recently Fixed | P1 | Backend |
| Auth Stability | ✅ Recently Fixed | P1 | Full-stack |
| Test Coverage | ❌ 0% | P1 | QA/Dev |
| Error Tracking | ❌ Not Implemented | P2 | DevOps |
| Feature Completion | 🔄 85% | P2 | Product |
| Accessibility | ❓ Not Audited | P3 | Frontend |

---

## Phase 0: Critical Security (P0) - SHIP BLOCKERS

**Timeline**: Immediate (before any production traffic)  
**Risk Level**: Critical

### 0.1 Secure Unprotected Edge Functions

The following edge functions accept requests without authentication, exposing AI credits and business data:

| Function | File | Required Fix |
|----------|------|--------------|
| `ai-pricing` | `supabase/functions/ai-pricing/index.ts` | Add JWT verification |
| `generate-report` | `supabase/functions/generate-report/index.ts` | Add JWT verification |
| `ai-demand-forecast` | `supabase/functions/ai-demand-forecast/index.ts` | Add JWT verification |
| `predicthq-events` | `supabase/functions/predicthq-events/index.ts` | Add JWT verification |

**Implementation Pattern** (from `voice-to-text/index.ts`):
```typescript
// Add after CORS handling
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);

const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
if (claimsError || !claimsData?.user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

- [ ] Secure `ai-pricing` edge function
- [ ] Secure `generate-report` edge function
- [ ] Secure `ai-demand-forecast` edge function
- [ ] Secure `predicthq-events` edge function
- [ ] Test all secured endpoints with valid/invalid tokens
- [ ] Verify frontend passes auth tokens to all AI endpoints

### 0.2 Validate RLS Policy Fixes

Recent migration created non-recursive helpers for `team_members` table.

- [ ] Verify `is_my_team_member()` function works without recursion
- [ ] Verify `is_my_team_admin()` function works without recursion
- [ ] Test team data isolation between different users
- [ ] Test super admin access across all teams
- [ ] Confirm no "infinite recursion detected" errors in logs

### 0.3 Review Sensitive Data Exposure

- [ ] Audit all SELECT queries for unnecessary column exposure
- [ ] Verify customer PII (email, phone) is protected by RLS
- [ ] Ensure payment data is not exposed in client responses
- [ ] Review `entity_comments` RLS policy (recently hardened)

---

## Phase 1: Stability Validation - Week 1

**Timeline**: 1 week  
**Goal**: Confirm recent fixes are stable, establish baseline

### 1.1 Auth Flow Validation

Recent changes to `AuthContext.tsx`:
- Made `onAuthStateChange` synchronous
- Added sequence guards for stale async operations
- Deferred side-effects to `setTimeout(0)`

**Manual Test Cases**:
- [ ] Login → immediate dashboard load (no stuck states)
- [ ] Refresh page while logged in → maintains session
- [ ] Logout → login with different account → correct data shown
- [ ] Rapid login/logout cycles → no deadlocks
- [ ] Close tab → reopen → session restored
- [ ] Leave tab idle 30+ minutes → return → auto-refresh works

### 1.2 Team Context Validation

- [ ] New user signup → auto-creates team → dashboard loads
- [ ] Invited user accepts → joins correct team → sees team data
- [ ] Team switch (if multi-team) → data refreshes correctly
- [ ] Location switch → filters update appropriately

### 1.3 Fleet Context Validation

Recent change: gated realtime subscriptions on `teamLoading`

- [ ] Console shows `Setting up realtime for: userId:teamId` (not `no-team`)
- [ ] Realtime updates work after initial load
- [ ] No duplicate subscription warnings
- [ ] Vehicle changes sync across tabs

### 1.4 "Taking Longer Than Expected" Monitoring

Enhanced diagnostic UI was added to show:
- Auth status
- Team loading status
- Error messages

- [ ] Banner appears after 8 seconds of loading (expected)
- [ ] Retry button works
- [ ] Diagnostic status helps identify stuck component
- [ ] Banner clears when data loads

---

## Phase 2: Testing Infrastructure - Weeks 2-3

**Timeline**: 2 weeks  
**Goal**: Establish testing framework, write critical path tests

### 2.1 Setup Vitest + React Testing Library

- [ ] Create `vitest.config.ts` in project root
- [ ] Create `src/test/setup.ts` with matchMedia mock
- [ ] Update `tsconfig.app.json` to include vitest globals
- [ ] Create `src/test/example.test.ts` to verify setup
- [ ] Add test scripts to `package.json`

### 2.2 Unit Tests - Critical Business Logic

**Priority test files**:

| Component/Hook | Why Critical | Target Coverage |
|----------------|--------------|-----------------|
| `useAuth` | Auth flow | 80% |
| `useLocationFilteredFleet` | Data filtering | 90% |
| Zod validation schemas | Input validation | 100% |
| Price calculation utils | Revenue accuracy | 100% |
| `featureFlags.ts` | Feature gating | 100% |

- [ ] `src/hooks/useAuth.test.ts`
- [ ] `src/hooks/useLocationFilteredFleet.test.ts`
- [ ] `src/lib/featureFlags.test.ts`
- [ ] `src/lib/validation.test.ts` (if exists)

### 2.3 Integration Tests - User Journeys

**Critical user journeys**:

1. **Login → Dashboard Load**
   - [ ] Auth context initialization
   - [ ] Team resolution
   - [ ] Fleet data fetch
   - [ ] Widget rendering

2. **Create Booking Flow**
   - [ ] Customer selection
   - [ ] Vehicle selection
   - [ ] Date validation
   - [ ] Pricing calculation
   - [ ] Form submission

3. **MotorIQ Pricing**
   - [ ] Vehicle selection
   - [ ] AI pricing request
   - [ ] Factor display
   - [ ] Apply price action

### 2.4 Edge Function Tests

Using Deno test runner for edge functions:

- [ ] `ai-pricing/index.test.ts` - auth, response format
- [ ] `generate-report/index.test.ts` - auth, report types
- [ ] `invite-user/index.test.ts` - permissions, email sending
- [ ] `accept-invite/index.test.ts` - token validation, role assignment

### 2.5 Error Tracking Setup (Sentry)

- [ ] Install `@sentry/react` package
- [ ] Add Sentry secret to environment
- [ ] Initialize in `main.tsx`
- [ ] Wrap `App` with Sentry error boundary
- [ ] Configure source maps upload
- [ ] Test error capture in staging

---

## Phase 3: Feature Completion - Weeks 3-5

**Timeline**: 2-3 weeks  
**Goal**: Complete or hide incomplete features

### 3.1 Feature Flag Audit

Current flags in `src/lib/featureFlags.ts`:

| Flag | Current | Action |
|------|---------|--------|
| `exportTranscript` | true | Verify working |
| `conversationHistory` | true | Verify working |
| `bulkActions` | false | Keep hidden |
| `savedViews` | false | Keep hidden |
| `advancedFilters` | false | Keep hidden |
| `customReports` | false | Keep hidden |
| `slackIntegration` | false | Keep hidden |
| `webhookNotifications` | false | Keep hidden |
| `recurringBookings` | false | Keep hidden |
| `customPricing` | false | Keep hidden |
| `maintenanceTracking` | true | Verify working |
| `documentManagement` | true | Verify working |
| `complianceChecks` | true | Verify working |

- [ ] Audit each `true` flag - verify feature works end-to-end
- [ ] Ensure `false` flags hide UI completely (no "coming soon" toasts)
- [ ] Add missing flags for any incomplete features

### 3.2 Telematics Tab (Staying "Coming Soon")

File: `src/components/dashboard/pulse/TelematicsTab.tsx`

**Current state**: Shows "Coming Soon" badge for non-demo users  
**Status**: ✅ Intentionally incomplete - will remain "Coming Soon" for initial launch

- [ ] Verify demo users see sample data
- [ ] Verify non-demo users see clean placeholder
- [ ] Consider adding feature flag `telematicsIntegration: false`
- [ ] Hide from navigation if desired

### 3.3 Empty States Review

EmptyState component exists at `src/components/common/EmptyState.tsx`

**Preset states available**:
- `NoVehiclesState`
- `NoBookingsState`
- `NoCustomersState`
- `NoSearchResultsState`
- `NoDataState`

- [ ] Audit all data views for empty state handling
- [ ] Ensure consistent styling across all empty states
- [ ] Add CTAs where appropriate

### 3.4 Export Functionality

- [ ] Verify CSV export for vehicles
- [ ] Verify CSV export for bookings
- [ ] Verify CSV export for customers
- [ ] Verify Rari transcript export
- [ ] Add PDF export for reports (if enabled)

### 3.5 Global Search Completion

Component: `src/components/common/EnhancedGlobalSearch.tsx`

- [ ] Test search across vehicles
- [ ] Test search across bookings
- [ ] Test search across customers
- [ ] Verify keyboard navigation (Cmd+K)
- [ ] Test result ranking/relevance

---

## Phase 4: Observability & Monitoring - Week 5

**Timeline**: 1 week  
**Goal**: Production visibility and alerting

### 4.1 Error Tracking (Sentry continued)

- [ ] Configure performance monitoring
- [ ] Set up error grouping rules
- [ ] Configure alert thresholds
- [ ] Add release tracking
- [ ] Test alert delivery

### 4.2 Console Log Cleanup

Logger utility exists at `src/lib/logger.ts`:
- `devLog`, `devWarn`, `devError` - only log in dev mode

**Current adoption**: 8 files using it

- [ ] Audit remaining direct console.* calls
- [ ] Replace critical logs with devLog pattern
- [ ] Keep edge function console logs (needed for debugging)

### 4.3 Backend Monitoring

- [ ] Set up Supabase analytics dashboard
- [ ] Monitor RLS policy performance
- [ ] Track edge function latency
- [ ] Alert on error rate spikes

### 4.4 Uptime Monitoring

- [ ] Configure health check endpoint
- [ ] Set up uptime monitoring service
- [ ] Configure PagerDuty/Slack alerts

---

## Phase 5: Pre-Launch QA - Week 6

**Timeline**: 1 week  
**Goal**: Final validation before production traffic

### 5.1 Manual Test Plan Execution

**Critical User Journeys**:

| Journey | Priority | Duration |
|---------|----------|----------|
| New user signup → onboarding → first vehicle | P0 | 15 min |
| Create booking → payment → completion | P0 | 10 min |
| MotorIQ pricing → apply → confirm | P0 | 5 min |
| Invite team member → accept → access | P1 | 10 min |
| Damage claim → photos → resolution | P1 | 10 min |
| Rari AI conversation → action | P1 | 5 min |

- [ ] Execute all P0 journeys in preview
- [ ] Execute all P0 journeys in published URL
- [ ] Document any failures

### 5.2 Cross-Browser Testing

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | P0 |
| Safari | Latest | P0 |
| Firefox | Latest | P1 |
| Edge | Latest | P1 |
| Chrome Mobile | Latest | P0 |
| Safari iOS | Latest | P0 |

- [ ] Test login flow in all P0 browsers
- [ ] Test dashboard rendering
- [ ] Test form submissions
- [ ] Test file uploads

### 5.3 Mobile Responsiveness

- [ ] Dashboard layout on 375px width
- [ ] Navigation menu usability
- [ ] Touch target sizes (min 44px)
- [ ] Form inputs keyboard handling
- [ ] Rari voice interface on mobile

### 5.4 Accessibility Audit

- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader testing (VoiceOver/NVDA)
- [ ] Color contrast validation
- [ ] Focus indicators visible
- [ ] Form labels properly associated

### 5.5 Performance Validation

- [ ] Lighthouse score > 80 (Performance)
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 4s
- [ ] No memory leaks on long sessions

---

## Appendix A: Edge Function Security Template

Use this pattern for all edge functions requiring authentication:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Authentication check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = claimsData.user.id;
  // ... rest of function logic
});
```

---

## Appendix B: Vitest Configuration

**vitest.config.ts**:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

**src/test/setup.ts**:
```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
```

---

## Appendix C: Test Execution Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test src/hooks/useAuth.test.ts

# Run edge function tests (Deno)
deno test supabase/functions/**/index.test.ts --allow-net --allow-env
```

---

## Appendix D: Existing Good Patterns to Leverage

### Logger Utility (`src/lib/logger.ts`)
```typescript
import { devLog, devWarn, devError } from '@/lib/logger';

// Use instead of console.log in components
devLog('[Component]', 'Action completed', data);
devWarn('[Component]', 'Potential issue', warning);
devError('[Component]', 'Error occurred', error);
```

### Feature Flags (`src/lib/featureFlags.ts`)
```typescript
import { isFeatureEnabled, withFeatureFlag } from '@/lib/featureFlags';

// Conditional rendering
{isFeatureEnabled('bulkActions') && <BulkActionsToolbar />}

// Or using helper
{withFeatureFlag('bulkActions', <BulkActionsToolbar />)}
```

### EmptyState Component (`src/components/common/EmptyState.tsx`)
```typescript
import { NoVehiclesState, NoBookingsState } from '@/components/common/EmptyState';

// Use presets for consistent empty states
if (vehicles.length === 0) return <NoVehiclesState />;
```

---

## Summary Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 0 | Immediate | Secured edge functions, validated RLS |
| Phase 1 | Week 1 | Stability confirmed, auth working |
| Phase 2 | Weeks 2-3 | Vitest setup, critical tests written |
| Phase 3 | Weeks 3-5 | Features complete or hidden |
| Phase 4 | Week 5 | Sentry, monitoring, alerts |
| Phase 5 | Week 6 | Manual QA, cross-browser, a11y |

**Total Timeline**: 6 weeks to production-ready  
**Post-Launch**: Continue expanding test coverage, monitor errors

---

## Quick Win Checklist (Can Do Today)

- [ ] Add auth to `generate-report` edge function (copy from `voice-to-text`)
- [ ] Add auth to `predicthq-events` edge function
- [ ] Add `telematicsIntegration: false` to feature flags
- [ ] Test login → dashboard flow 3x in published URL
- [ ] Verify "Taking longer" diagnostic shows useful info

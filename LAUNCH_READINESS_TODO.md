# 🚀 Launch Readiness TODO

> **Created**: January 19, 2026  
> **Status**: Planning Complete - Ready for Phased Execution  
> **Last Updated**: January 19, 2026

---

## 📋 Executive Summary

A comprehensive security audit and code review was performed. The following issues were identified and prioritized for resolution before launch.

| Priority | Category | Issues Found | Status |
|----------|----------|--------------|--------|
| P0 | Critical Security | 3 | ⏳ Pending |
| P1 | Production Logging | 4 files | ⏳ Pending |
| P1 | Stability | 2 | ⏳ Pending |
| P2 | Security Warnings | 5 | ⏳ Pending |
| P3 | Code Quality | 6 | ⏳ Pending |

**Recommendation**: Complete Phases 1-3 before launch. Phases 4-5 can be addressed post-launch.

---

## Phase 1: Critical Security (P0) 🔴

> **Must complete before launch. Zero exceptions.**

### 1.1 Add Authentication to Voice-to-Text Edge Function

- [ ] **File**: `supabase/functions/voice-to-text/index.ts`
- **Priority**: P0 Critical
- **Effort**: 15 minutes
- **Risk**: API abuse, cost overruns from unauthenticated calls

**Current State**: Function has `verify_jwt = false` and no manual auth check.

**Required Changes**:
```typescript
// Add after imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

// Add inside serve(), after CORS OPTIONS check:
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

const { data: { user }, error: authError } = await supabase.auth.getUser(
  authHeader.replace('Bearer ', '')
);

if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

console.log(`Authenticated user: ${user.id}`);
```

**Success Criteria**: 
- Unauthenticated requests return 401
- Authenticated requests work as before

---

### 1.2 Add Authentication to Text-to-Speech Edge Function

- [ ] **File**: `supabase/functions/text-to-speech/index.ts`
- **Priority**: P0 Critical
- **Effort**: 15 minutes
- **Risk**: API abuse, ElevenLabs API cost overruns

**Current State**: Function has `verify_jwt = false` and no manual auth check.

**Required Changes**: Same pattern as 1.1 above.

**Success Criteria**: 
- Unauthenticated requests return 401
- Authenticated requests work as before

---

### 1.3 Fix user_presence RLS Policy

- [ ] **Table**: `public.user_presence`
- **Priority**: P0 Critical
- **Effort**: 30 minutes
- **Risk**: User activity/status visible to anyone

**Current State**: 
```sql
-- DANGEROUS: Anyone can see all user presence data
CREATE POLICY "Anyone can view presence" ON public.user_presence
FOR SELECT USING (true);
```

**Required Migration**:
```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;

-- Create a proper team-scoped policy
CREATE POLICY "Authenticated users can view team presence"
ON public.user_presence
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can always see their own presence
    user_id = auth.uid() 
    OR
    -- Users can see presence of teammates
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() 
      AND tm2.user_id = user_presence.user_id
      AND tm1.is_active = true
      AND tm2.is_active = true
    )
  )
);
```

**Success Criteria**:
- Anonymous users cannot query user_presence
- Users can only see their own presence or teammates' presence

---

### 1.4 Enable Leaked Password Protection

- [ ] **Location**: Lovable Cloud Settings
- **Priority**: P0 Critical
- **Effort**: 5 minutes
- **Risk**: Users with compromised passwords can sign up

**Steps**:
1. Open Lovable Cloud settings
2. Navigate to Authentication settings
3. Enable "Leaked password protection" / "HaveIBeenPwned integration"

**Success Criteria**: Password breach detection is enabled in auth settings

---

## Phase 2: Production Logging (P1) ✅ COMPLETE

> **Clean console output for production. Completed!**

### 2.1 Create Production Logger Utility ✅

- [x] **File Created**: `src/lib/logger.ts` with `devLog`, `devWarn`, `devError`, `devGroup`, `devTable`
- **Priority**: P1
- **Effort**: 10 minutes

**Create this file**:
```typescript
/**
 * Production-safe logging utilities
 * Only outputs in development mode
 */

const isDev = import.meta.env.DEV;

export const devLog = (...args: unknown[]): void => {
  if (isDev) console.log('[DEV]', ...args);
};

export const devWarn = (...args: unknown[]): void => {
  if (isDev) console.warn('[DEV]', ...args);
};

export const devError = (...args: unknown[]): void => {
  // Errors are always logged, but prefixed in dev
  if (isDev) {
    console.error('[DEV]', ...args);
  } else {
    console.error(...args);
  }
};

export const devGroup = (label: string, fn: () => void): void => {
  if (isDev) {
    console.group(`[DEV] ${label}`);
    fn();
    console.groupEnd();
  }
};

export const devTable = (data: unknown): void => {
  if (isDev) console.table(data);
};
```

---

### 2.2 Update FleetContext.tsx ✅

- [x] **File**: `src/contexts/FleetContext.tsx` - 17 console statements replaced
- **Priority**: P1

---

### 2.3 Update TeamContext.tsx ✅

- [x] **File**: `src/contexts/TeamContext.tsx` - 15 console statements replaced
- **Priority**: P1

---

### 2.4 Update AuthContext.tsx ✅

- [x] **File**: `src/contexts/AuthContext.tsx` - 22 console statements replaced
- **Priority**: P1

---

### 2.5 Update Demo.tsx ✅

- [x] **File**: `src/pages/Demo.tsx` - 8 console statements replaced
- **Priority**: P1

---

## Phase 3: Stability Improvements (P1) ✅ COMPLETE

> **Prevent race conditions and improve reliability. Completed!**

### 3.1 Replace Demo Page setTimeout ✅

- [x] **File**: `src/pages/Demo.tsx`
- **Priority**: P1
- **Effort**: 20 minutes
- **Completed**: Replaced fragile `setTimeout` with state-driven `useEffect` that waits for `!authLoading && user?.email === DEMO_EMAIL`

**Implementation**:
- Removed `setTimeout(() => setIsReady(true), 500)` 
- Added dedicated `useEffect` that sets `isReady` only when auth is complete AND user is confirmed as demo user
- Authentication attempt effect no longer sets ready state directly

**Success Criteria**: ✅
- Demo page loads reliably without timing issues
- No race conditions on slow connections

---

### 3.2 Add Debounced Refresh for Real-time Updates ✅

- [x] **File**: `src/contexts/FleetContext.tsx`
- **Priority**: P1
- **Effort**: 30 minutes
- **Completed**: Added per-table debounced refresh with 500ms coalescing window

**Implementation**:
- Created `debouncedRefresh` function using `useMemo` with per-table timeout tracking
- Each of the 7 real-time table subscriptions now uses `debouncedRefresh('tableName')` instead of direct refresh calls
- Added cleanup effect to clear pending timeouts on unmount
- Debounce timeouts stored in ref to prevent stale closure issues

**Success Criteria**: ✅
- Multiple rapid updates coalesce into single refresh
- No UI flicker on bulk operations

---

## Phase 4: Security Warnings (P2) 🟠

> **Tighten policies and document intentional decisions. Can complete post-launch.**

### 4.1 Review entity_comments RLS Policy

- [ ] **Table**: `public.entity_comments`
- **Priority**: P2
- **Effort**: 15 minutes

**Current State**:
```sql
CREATE POLICY "Users can view comments on entities they can access"
ON public.entity_comments FOR SELECT USING (true);
```

**Recommended Change**:
```sql
DROP POLICY IF EXISTS "Users can view comments on entities they can access" 
ON public.entity_comments;

CREATE POLICY "Authenticated users can view comments"
ON public.entity_comments FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
```

---

### 4.2 Review team_conversations RLS Policy

- [ ] **Table**: `public.team_conversations`
- **Priority**: P2
- **Effort**: 15 minutes

**Evaluate**: Should non-members be able to see company-wide conversations?

---

### 4.3 Document Intentional Public Policies

- [ ] **Priority**: P2
- **Effort**: 10 minutes

**Tables with intentionally public INSERT policies** (document in code comments):
- `onboarding_responses` - Pre-auth signup flow, needs public insert
- `investor_contacts` - Public contact form, needs public insert

**Add to security scan ignore list** with reason.

---

### 4.4 Review team_integrations Exposure

- [ ] **Table**: `public.team_integrations`
- **Priority**: P2
- **Effort**: 20 minutes

**Risk**: `config` column may contain API keys visible to admins.

**Options**:
1. Move sensitive config to Supabase Vault
2. Encrypt config column
3. Split into `config` (safe) and `secrets` (encrypted) columns

---

### 4.5 Audit Edge Functions JWT Settings

- [ ] **File**: `supabase/config.toml`
- **Priority**: P2
- **Effort**: 1 hour

**29 functions have `verify_jwt = false`**. Review each and document why:

| Function | JWT Disabled Reason |
|----------|---------------------|
| check-subscription | Webhook endpoint |
| customer-portal | Stripe redirect |
| create-checkout-session | Pre-auth flow |
| ... | Document remaining |

---

## Phase 5: Code Quality (P3) 🟢

> **Nice-to-haves. Complete when time permits.**

### 5.1 Resolve TODO Comments

- [ ] `supabase/functions/rari-email-summary/index.ts:130`
  - **Issue**: Placeholder email service
  - **Action**: Implement Resend integration or remove feature

- [ ] `WIDGET_QUICK_START.md:82-83`
  - **Issue**: "TODO: UI" comments
  - **Action**: Complete documentation or remove

- [ ] `src/hooks/useRariSidebar.ts:72`
  - **Issue**: Placeholder implementation
  - **Action**: Implement or remove feature

---

### 5.2 Clean Migration Files

- [ ] **Priority**: P3
- **Effort**: 30 minutes

Remove commented verification queries from migrations:
```sql
-- These are useful for development but clutter production
-- SELECT * FROM some_table; -- Verify migration worked
```

---

### 5.3 Remove @ts-nocheck

- [ ] **File**: `supabase/functions/elevenlabs-tools/index.ts`
- **Priority**: P3
- **Effort**: 1 hour

Add proper TypeScript types instead of disabling type checking.

---

### 5.4 Consider TypeScript Strictness

- [ ] **File**: `tsconfig.json`
- **Priority**: P3 (Post-launch)
- **Effort**: 4+ hours

**Current Settings**:
```json
{
  "noImplicitAny": false,
  "strictNullChecks": false
}
```

**Recommendation**: Enable after launch with gradual type fixes.

---

## 🧪 Testing Checklist

### Phase 1 Verification

- [ ] **Voice-to-text auth**: Call function without token → expect 401
- [ ] **Voice-to-text auth**: Call function with valid token → expect success
- [ ] **Text-to-speech auth**: Call function without token → expect 401
- [ ] **Text-to-speech auth**: Call function with valid token → expect success
- [ ] **user_presence RLS**: Query as anonymous → expect empty/error
- [ ] **user_presence RLS**: Query as authenticated → expect only own/team data

### Phase 2 Verification

- [ ] **Production build**: Run `npm run build` → no console.log in output
- [ ] **Dev mode**: Verify logs still appear with `[DEV]` prefix

### Phase 3 Verification

- [ ] **Demo page**: Load demo page on slow connection → loads correctly
- [ ] **Real-time**: Bulk update 5 records → single UI refresh (not 5)

### Phase 4 Verification

- [ ] **entity_comments**: Anonymous query → fails
- [ ] **Security scan**: Re-run → fewer warnings

### Phase 5 Verification

- [ ] **Build**: No TypeScript errors
- [ ] **Grep TODO**: Fewer results than before

---

## 📁 Files Reference

### Edge Functions to Modify
- `supabase/functions/voice-to-text/index.ts`
- `supabase/functions/text-to-speech/index.ts`

### Context Files to Update
- `src/contexts/FleetContext.tsx`
- `src/contexts/TeamContext.tsx`
- `src/contexts/AuthContext.tsx`

### Pages to Update
- `src/pages/Demo.tsx`

### New Files to Create
- `src/lib/logger.ts`

### Config Files to Review
- `supabase/config.toml`
- `tsconfig.json`

---

## 📝 Notes

### Why This Phased Approach?

1. **Phase 1 first**: Security issues must be fixed before any public traffic
2. **Phase 2-3 together**: Both improve production quality
3. **Phase 4 deferred**: Important but not blocking
4. **Phase 5 backlog**: Technical debt to address over time

### Rollback Plan

Each phase is independent. If issues arise:
1. Revert the specific phase's changes
2. Re-test
3. Fix and re-apply

### Post-Launch Additions (Future)

- [ ] Add rate limiting to voice/TTS functions
- [ ] Implement Sentry for error tracking
- [ ] Add request logging/analytics
- [ ] Create backup/recovery procedures
- [ ] Set up monitoring alerts

---

## ✅ Completion Log

| Date | Phase | Completed By | Notes |
|------|-------|--------------|-------|
| | | | |

---

*Generated by Lovable AI - January 19, 2026*

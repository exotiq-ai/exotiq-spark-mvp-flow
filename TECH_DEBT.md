# 🎯 Technical Debt Register
**ExotIQ Fleet Management Platform**

**Last Updated:** December 31, 2025  
**Status:** Active MVP Development (Option A: Rollback & Rebuild)

---

## 📋 HOW TO USE THIS DOCUMENT

1. **Add new tech debt** as you discover it
2. **Link to related files** for context
3. **Estimate effort** for planning
4. **Update status** as you fix items
5. **Don't delete** - move to "Resolved" section

---

## 🔴 CRITICAL - Must Fix Before Scaling

### #1 - No Test Coverage
**Status:** 🔴 Open  
**Priority:** Critical  
**Estimated Effort:** 2-3 weeks  
**Impact:** Every change risks breaking something  
**When to Fix:** Before hiring more developers (Month 3-4)

**Details:**
- Current test coverage: 0%
- No unit tests for components
- No integration tests for user flows
- No E2E tests for critical paths
- Manual testing only = slow and error-prone

**Files Affected:** All components

**Action Items:**
- [ ] Set up Vitest + React Testing Library
- [ ] Add tests for critical paths (auth, booking, pricing)
- [ ] Add tests for key components (Dashboard, MotorIQ, etc.)
- [ ] Set up CI/CD to run tests automatically

---

### #2 - Duplicate Dashboard Components ✅ IN PROGRESS
**Status:** 🟡 In Progress (Option A - Week 1)  
**Priority:** High  
**Estimated Effort:** 2 hours  
**Impact:** Confusing for new developers  
**When to Fix:** During Phase 1.3 cleanup

**Details:**
- `DashboardOverview.tsx` - Old, simpler version
- `DashboardOverviewEnhanced.tsx` - New, feature-rich version (currently used)
- Only one should exist

**Files Affected:**
- `src/components/dashboard/DashboardOverview.tsx`
- `src/components/dashboard/DashboardOverviewEnhanced.tsx`
- `src/pages/Dashboard.tsx` (imports DashboardOverviewEnhanced)

**Action Items:**
- [ ] Verify which is used (DashboardOverviewEnhanced)
- [ ] Delete unused version (DashboardOverview.tsx)
- [ ] Verify no imports remain

---

### #3 - Event-Based Navigation (Fragile) ✅ RESOLVED
**Status:** ✅ Resolved (December 31, 2025)  
**Priority:** High  
**Effort:** 30 minutes (estimated 4-6 hours)  
**Impact:** Navigation now reliable, no race conditions  
**Resolution:** Migrated to URL query parameters

**What Was Done:**
- ✅ Updated CommandPalette to use `navigate('/dashboard?module=X')`
- ✅ Updated Dashboard to read from `useSearchParams()`
- ✅ Removed CustomEvent listeners (no longer needed)
- ✅ Tested - no linting errors

**Files Modified:**
- `src/components/common/CommandPalette.tsx` (all navigation now uses query params)
- `src/pages/Dashboard.tsx` (reads module from URL)

**Old Code:**
```typescript
// Fragile:
window.dispatchEvent(new CustomEvent('navigate-module', { detail: 'motoriq' }));
```

**New Code:**
```typescript
// Reliable:
navigate('/dashboard?module=motoriq');
```

**Benefits:**
- ✅ No race conditions
- ✅ Bookmarkable URLs (users can save/share direct links)
- ✅ Browser back/forward works correctly
- ✅ Easy to debug (URL shows current state)
- ✅ No event listener cleanup needed

---

## 🟡 HIGH PRIORITY - Fix Before Enterprise Launch

### #4 - Inconsistent Progressive Disclosure ✅ IN PROGRESS
**Status:** 🟡 In Progress (Option A - Week 2)  
**Priority:** Medium  
**Estimated Effort:** 1 week  
**Impact:** Inconsistent UX  
**When to Fix:** During Phase 4

**Details:**
- Only `RevenueWidget` uses ProgressiveDisclosure
- `FleetStatusWidget`, `ScheduleWidget`, `AIInsightWidget` don't
- Users expect consistent patterns

**Files Affected:**
- `src/components/dashboard/widgets/RevenueWidget.tsx` ✅ Already uses it
- `src/components/dashboard/widgets/FleetStatusWidget.tsx` ❌ Needs it
- `src/components/dashboard/widgets/ScheduleWidget.tsx` ❌ Needs it
- `src/components/dashboard/widgets/AIInsightWidget.tsx` ❌ Needs it

**Action Items:**
- [ ] Apply ProgressiveDisclosure to FleetStatusWidget
- [ ] Apply ProgressiveDisclosure to ScheduleWidget
- [ ] Apply ProgressiveDisclosure to AIInsightWidget
- [ ] Test expand/collapse on all widgets

---

### #5 - No Error Tracking (Sentry/LogRocket)
**Status:** 🔴 Open  
**Priority:** High  
**Estimated Effort:** 2-3 hours  
**Impact:** Can't fix bugs you don't know about  
**When to Fix:** Before public launch (End of Week 3)

**Details:**
- Errors disappear into the void
- No visibility into production issues
- Users experience bugs, you never hear about them

**Files Affected:** All

**Action Items:**
- [ ] Sign up for Sentry (free tier)
- [ ] Install @sentry/react
- [ ] Add Sentry.init() to main.tsx
- [ ] Test error reporting

---

### #6 - No Component Library/Storybook
**Status:** 🔴 Open  
**Priority:** Medium  
**Estimated Effort:** 1-2 weeks  
**Impact:** Hard to reuse components, developers rebuild existing components  
**When to Fix:** Month 4-6 (when team grows)

**Details:**
- Components scattered across codebase
- No visual documentation
- Hard to see all variants/states
- New developers don't know what's available

**Action Items:**
- [ ] Install Storybook
- [ ] Document key components (Button, Card, Dialog, etc.)
- [ ] Document custom components (RacingStripe, Tachometer, etc.)
- [ ] Add interaction tests in Storybook

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### #7 - Unused "Excellence" Components
**Status:** 🟡 In Progress (Option A - Week 1)  
**Priority:** Low  
**Estimated Effort:** 1 hour  
**Impact:** Confusing, takes up space  
**When to Fix:** During Phase 1.3 cleanup

**Details:**
- `QuickOnboarding.tsx` - Created but never integrated
- `EmptyState.tsx` - Created but not used
- `MicroInteractions.tsx` (Celebration, MetallicGradient) - Created but not wired

**Files to Review:**
- `src/components/onboarding/QuickOnboarding.tsx` ❌ Never imported
- `src/components/common/EmptyState.tsx` ⚠️ Created but not used
- `src/components/common/MicroInteractions.tsx` ⚠️ Partial (CountUp works)
- `src/components/automotive/RacingStripe.tsx` ⚠️ Partial (Tachometer used, MetallicGradient not)

**Action Items:**
- [ ] Delete QuickOnboarding.tsx (or keep for future)
- [ ] Evaluate if EmptyState.tsx is useful
- [ ] Wire up Celebration component or remove it
- [ ] Remove MetallicGradient or use it

---

### #8 - Performance Monitoring
**Status:** 🔴 Open  
**Priority:** Low  
**Estimated Effort:** 1 day  
**Impact:** Don't know if app is slow for users  
**When to Fix:** Month 3-4

**Action Items:**
- [ ] Set up Lighthouse CI
- [ ] Track Web Vitals (LCP, FID, CLS)
- [ ] Monitor bundle size
- [ ] Set performance budgets

---

### #9 - Accessibility Audit
**Status:** 🔴 Open  
**Priority:** Low  
**Estimated Effort:** 1 week  
**Impact:** Some users can't use the app  
**When to Fix:** Before enterprise launch

**Action Items:**
- [ ] Run axe DevTools audit
- [ ] Test with screen reader (VoiceOver)
- [ ] Verify keyboard navigation
- [ ] Ensure WCAG AA compliance
- [ ] Add skip navigation (already have?)
- [ ] Test with high contrast mode

---

### #10 - Mobile Real Device Testing
**Status:** 🔴 Open  
**Priority:** Low  
**Estimated Effort:** 2-3 days  
**Impact:** May not work on all devices  
**When to Fix:** Before public launch

**Action Items:**
- [ ] Test on real iOS devices (iPhone SE, iPhone 14, iPhone 15)
- [ ] Test on real Android devices (various)
- [ ] Test touch targets (44px minimum)
- [ ] Test viewport sizes
- [ ] Test performance on older devices

---

## ✅ RESOLVED

### #3 - Event-Based Navigation ✅ RESOLVED
**Resolved:** December 31, 2025  
**Resolution:** Migrated from CustomEvents to URL query parameters. Navigation is now reliable, bookmarkable, and has no race conditions.

### #11 - Missing Dependencies ✅ RESOLVED
**Resolved:** December 31, 2025  
**Resolution:** Ran `npm install`, all dependencies installed successfully

---

## 📊 SUMMARY

| Priority | Open | In Progress | Resolved |
|----------|------|-------------|----------|
| 🔴 Critical | 2 | 1 | 1 |
| 🟡 High | 2 | 0 | 1 |
| 🟢 Medium | 4 | 1 | 0 |
| **Total** | **8** | **2** | **2** |

---

## 📝 NOTES

- This document tracks known technical debt
- Update as you discover new issues
- Estimate effort for planning
- Don't delete resolved items - keep them for history
- Link to this document in code comments

**Example:**
```typescript
// ⚠️ TECH DEBT: See TECH_DEBT.md #3
// TODO: Migrate to URL query params
window.dispatchEvent(new CustomEvent('navigate-module'));
```

---

**Last Review:** December 31, 2025  
**Next Review:** After Phase 1 completion (Week 1)

# Exotiq Launch Sprint TODO
**1-Week Sprint to Production-Ready MVP**
**Generated:** January 12, 2026
**Current Rating:** 7.8/10 | **Target:** 8.5/10

---

## Executive Summary

This document prioritizes improvements for a 1-week sprint to launch Exotiq to real-world users. Items are organized by priority (P0-P3) and categorized by area. Focus on P0 and P1 items for a successful launch.

**Sprint Goal:** Remove launch blockers, improve core UX, and ensure security/stability for production.

---

## P0 - CRITICAL LAUNCH BLOCKERS (Days 1-2)
*Must complete before launch. These are showstoppers.*

### Security & Authentication

- [ ] **SEC-001: Review Demo Login Security**
  - File: `src/contexts/AuthContext.tsx:382-426`
  - Issue: Demo login edge function returns session directly. Ensure rate limiting exists on edge function.
  - Action: Add rate limiting to `demo-login` edge function, add abuse logging.
  - Effort: 2 hours

- [ ] **SEC-002: Environment Variable Exposure Check**
  - File: `.env`
  - Issue: Ensure `.env` is not committed. Verify all secrets are server-side only.
  - Action: Audit all `import.meta.env` usages, ensure only `VITE_*` public vars are client-side.
  - Effort: 1 hour

- [ ] **SEC-003: Input Sanitization on User-Generated Content**
  - Files: `src/lib/validationSchemas.ts`, all form components
  - Issue: Ensure XSS prevention on all user inputs rendered in UI.
  - Action: Audit all `dangerouslySetInnerHTML` usages (if any), ensure proper escaping.
  - Effort: 2 hours

- [ ] **SEC-004: RLS Policy Verification**
  - Files: `supabase/` directory
  - Issue: Row Level Security must be properly configured for multi-tenant data isolation.
  - Action: Test that users cannot access other teams' data. Review all RLS policies.
  - Effort: 3 hours

### Critical Bug Fixes

- [ ] **BUG-001: "Coming Soon" Toasts Must Be Removed or Features Completed**
  - Files: Found in 20+ files (use `grep -r "coming soon"`)
  - Issue: "Coming soon" messages undermine user confidence in production app.
  - Action: Either complete features or remove/hide the buttons entirely.
  - Effort: 4-6 hours
  - Specific locations:
    - `src/components/rari/RariAnalytics.tsx`
    - Various feature buttons throughout dashboard

- [ ] **BUG-002: Hardcoded User Name in Mobile Header**
  - File: `src/pages/Dashboard.tsx:277`
  - Issue: Shows "John Doe" hardcoded instead of actual user name.
  - Action: Replace with actual user name from auth context.
  - Effort: 15 minutes

- [ ] **BUG-003: Error Boundary Fallback Needs User-Friendly Message**
  - File: `src/components/common/ErrorBoundary.tsx`
  - Issue: Error boundaries use `fallback={null}` in several places.
  - Action: Provide helpful error UI with retry/refresh options.
  - Effort: 1 hour

### Core UX Fixes

- [ ] **UX-001: Empty State Designs for All Data Views**
  - Files: Dashboard widgets, Book, Vault, Core modules
  - Issue: Empty data states show blank/confusing UI for new users.
  - Action: Design and implement beautiful empty states with helpful CTAs.
  - Priority Views:
    - Vehicle list (no vehicles)
    - Booking calendar (no bookings)
    - Customer list (no customers)
    - Messages (no conversations)
  - Effort: 4-6 hours

- [ ] **UX-002: Form Validation Error Messages**
  - Files: All dialog forms in `src/components/dialogs/`
  - Issue: Some forms lack field-level validation feedback.
  - Action: Implement inline error messages using existing Zod schemas.
  - Effort: 3-4 hours

---

## P1 - HIGH PRIORITY (Days 3-4)
*Important for good user experience. Complete if possible.*

### Design & UI

- [ ] **UI-001: Reduce Dashboard Visual Density**
  - File: `src/components/dashboard/DashboardOverviewEnhanced.tsx`
  - Issue: Too many widgets visible on initial load (cognitive overload).
  - Current: `expandedSections` defaults to `["metrics"]` but all widgets still render.
  - Action: Implement progressive disclosure - show 3-4 key metrics first, "Show More" for rest.
  - Effort: 3-4 hours

- [ ] **UI-002: Increase Whitespace Throughout App**
  - Files: `src/index.css`, various components
  - Issue: Spacing feels cramped compared to modern SaaS apps.
  - Action: Increase padding/margins by ~20-30%. Focus on cards, widget spacing.
  - Effort: 2-3 hours

- [ ] **UI-003: Module Names Need Subtitles**
  - Files: `src/pages/Dashboard.tsx:108-118`, sidebar component
  - Issue: "MotorIQ", "Pulse", "Core" are not self-explanatory.
  - Action: Add subtitles: "MotorIQ — Pricing Optimization", "Pulse — Fleet Analytics", etc.
  - Effort: 1 hour

- [ ] **UI-004: Consistent Border Weights**
  - Files: Various component files
  - Issue: `border-2` used inconsistently, creates visual noise.
  - Action: Standardize to `border` (1px) for most elements, `border-2` only for emphasis.
  - Effort: 2 hours

### Mobile & Tablet Responsiveness

- [ ] **MOB-001: Tablet Breakpoint Optimization**
  - Files: All major page components
  - Issue: Tablet (768px-1024px) experience not optimized - often shows mobile OR desktop.
  - Action: Add specific `md:` breakpoint styles for tablet-optimized layouts.
  - Focus areas:
    - Dashboard grid: 2-column on tablet
    - Sidebar: Collapsible on tablet
    - Dialogs: Wider on tablet, not full-screen
  - Effort: 4-5 hours

- [ ] **MOB-002: Mobile Navigation Touch Target Audit**
  - Files: `src/components/mobile/`, bottom nav in Dashboard
  - Issue: Some touch targets may be < 44px minimum.
  - Action: Audit all interactive elements, ensure 44x44px minimum.
  - Effort: 1-2 hours

- [ ] **MOB-003: Horizontal Scroll Prevention**
  - File: `src/pages/Dashboard.tsx:333`
  - Issue: `overflow-x-hidden` is set but some content may still overflow on small screens.
  - Action: Test all views on 320px width, fix any overflow issues.
  - Effort: 2 hours

- [ ] **MOB-004: Mobile Data Tables**
  - Files: Vehicle list, booking list, customer list components
  - Issue: Tables don't translate well to mobile - need card-based views.
  - Action: Implement responsive card layouts for data lists on mobile.
  - Effort: 3-4 hours

### User Onboarding

- [ ] **ONB-001: First-Time User Tour Enhancement**
  - File: `src/components/onboarding/InteractiveModuleTour.tsx`
  - Issue: Tour exists but may not adequately explain module purposes.
  - Action: Enhance tour with clearer copy, highlight key features per module.
  - Effort: 2 hours

- [ ] **ONB-002: Contextual Help Tooltips**
  - Files: Key interactive elements across app
  - Issue: No inline help for complex features (MotorIQ pricing, etc.).
  - Action: Add `?` help icons with tooltips on complex UI elements.
  - Effort: 3 hours

- [ ] **ONB-003: Onboarding Progress Recovery**
  - File: `src/pages/Onboarding.tsx`
  - Issue: Uses localStorage for progress - test that recovery works after browser close.
  - Action: Verify and fix any issues with onboarding state persistence.
  - Effort: 1 hour

### Typography & Readability

- [ ] **TYP-001: Font Loading Optimization**
  - File: `src/index.css:2`
  - Issue: Google Fonts loaded via @import (render blocking).
  - Action: Move to `<link rel="preconnect">` in `index.html` for better performance.
  - Effort: 30 minutes

- [ ] **TYP-002: Mobile Font Size Audit**
  - Files: Various components
  - Issue: Some text may be too small on mobile (< 14px body text).
  - Action: Ensure minimum 14px body text, 12px for secondary text.
  - Effort: 1-2 hours

- [ ] **TYP-003: Truncation & Overflow Handling**
  - Files: Card components, table cells
  - Issue: Long text may break layouts or be cut off without ellipsis.
  - Action: Add consistent `truncate` classes where needed, consider "expand" options.
  - Effort: 1-2 hours

---

## P2 - MEDIUM PRIORITY (Days 5-6)
*Polish items that improve overall quality.*

### Codebase Cleaning

- [ ] **CODE-001: Remove Duplicate Dashboard Components**
  - Files: `src/components/dashboard/DashboardOverview.tsx` vs `DashboardOverviewEnhanced.tsx`
  - Issue: Tech debt - old component still exists.
  - Action: Delete `DashboardOverview.tsx` after verifying it's unused.
  - Effort: 30 minutes

- [ ] **CODE-002: Remove Unused "Excellence" Components**
  - Files:
    - `src/components/onboarding/QuickOnboarding.tsx` (never imported)
    - `src/components/common/MicroInteractions.tsx` (partially used)
  - Action: Delete unused components or integrate them.
  - Effort: 1 hour

- [ ] **CODE-003: Console.log Cleanup**
  - Files: Throughout codebase
  - Issue: Development console.logs may leak to production.
  - Action: Remove or gate behind `import.meta.env.DEV`.
  - Effort: 1-2 hours

- [ ] **CODE-004: TypeScript Strictness**
  - File: `tsconfig.app.json`
  - Issue: `noImplicitAny: false` allows type safety gaps.
  - Action: Enable `noImplicitAny: true`, fix resulting errors (can defer to post-launch).
  - Effort: 4-8 hours (defer if needed)

- [ ] **CODE-005: Dead Code Removal**
  - Files: Various
  - Issue: Commented-out code, unused imports.
  - Action: Run ESLint unused imports rule, remove dead code.
  - Effort: 1-2 hours

### Debugging & Error Handling

- [ ] **DBG-001: Add Error Tracking (Sentry)**
  - Files: `src/main.tsx`
  - Issue: No visibility into production errors.
  - Action: Install `@sentry/react`, configure DSN, wrap app in ErrorBoundary with Sentry reporting.
  - Effort: 2 hours

- [ ] **DBG-002: Add Loading State Fallbacks**
  - Files: Components using `useFleet`, `useTeam`, etc.
  - Issue: Some loading states may show blank UI.
  - Action: Audit and add skeleton loaders consistently.
  - Effort: 2-3 hours

- [ ] **DBG-003: Network Error Handling**
  - File: `src/components/common/OfflineBanner.tsx`
  - Issue: Exists but verify it appears correctly on network loss.
  - Action: Test offline behavior, ensure graceful degradation.
  - Effort: 1 hour

- [ ] **DBG-004: Form Submission Error Recovery**
  - Files: All form dialogs
  - Issue: Failed submissions may leave forms in inconsistent state.
  - Action: Ensure proper error handling with form state reset option.
  - Effort: 2 hours

### Performance

- [ ] **PERF-001: Lazy Load Heavy Components**
  - File: `src/pages/Dashboard.tsx`
  - Issue: All modules loaded upfront (MotorIQ, Rari, Charts are heavy).
  - Action: Use `React.lazy()` with `Suspense` for module components.
  - Effort: 2-3 hours

- [ ] **PERF-002: Image Optimization**
  - Files: Vehicle images, logo assets
  - Issue: Images may not be optimized for web.
  - Action: Ensure images use WebP format, proper sizing, lazy loading.
  - Effort: 1-2 hours

- [ ] **PERF-003: Animation Performance Audit**
  - Files: Various Framer Motion usages
  - Issue: Animation overuse may cause performance issues on low-end devices.
  - Action: Reduce non-essential animations, use `will-change` sparingly.
  - Effort: 2 hours

### UX Improvements

- [ ] **UX-003: Add Undo for Destructive Actions**
  - Files: Delete vehicle, cancel booking, etc.
  - Issue: No undo/confirmation for destructive actions.
  - Action: Add confirmation dialogs with clear consequences for destructive actions.
  - Effort: 2-3 hours

- [ ] **UX-004: Global Search Enhancement**
  - File: `src/components/common/CommandPalette.tsx`
  - Issue: Command palette exists but search is basic.
  - Action: Add entity search (vehicles, customers, bookings) to command palette.
  - Effort: 3-4 hours

- [ ] **UX-005: Keyboard Navigation**
  - Files: Tables, lists, dialogs
  - Issue: Limited keyboard navigation support.
  - Action: Ensure tab navigation works through all interactive elements.
  - Effort: 2-3 hours

---

## P3 - NICE-TO-HAVE (Day 7 if time permits)
*Enhancement items for future iterations.*

### Design Enhancements

- [ ] **DES-001: Automotive Design Language Elements**
  - Issue: App looks like generic SaaS, lacks luxury/automotive feel.
  - Action: Add subtle speed-line dividers, gauge-style metrics, premium textures.
  - Effort: 4-6 hours

- [ ] **DES-002: Delight Moments**
  - Issue: Missing celebration/delight animations.
  - Action: Add confetti on milestone achievements, subtle hover interactions.
  - Effort: 2-3 hours

- [ ] **DES-003: Dark Mode Polish**
  - File: `src/index.css` dark mode section
  - Issue: Dark mode exists but may need contrast/color refinement.
  - Action: Audit dark mode colors for proper contrast ratios (WCAG AA).
  - Effort: 2-3 hours

### Feature Completion

- [ ] **FEAT-001: Export Functionality (CSV/PDF)**
  - Issue: Multiple "coming soon" for export features.
  - Action: Implement basic CSV export for vehicles, bookings, customers.
  - Effort: 4-6 hours

- [ ] **FEAT-002: Rari Conversation History**
  - File: `src/components/rari/` components
  - Issue: AI conversations not persisted.
  - Action: Store conversation history in Supabase, allow viewing past conversations.
  - Effort: 4-6 hours

- [ ] **FEAT-003: Bulk Actions**
  - Issue: No bulk select/action for lists.
  - Action: Add multi-select and bulk status change for vehicles/bookings.
  - Effort: 4-6 hours

### Testing & Quality

- [ ] **TEST-001: Set Up Basic Test Framework**
  - Issue: 0% test coverage.
  - Action: Set up Vitest + React Testing Library, add tests for critical auth flows.
  - Effort: 4-6 hours

- [ ] **TEST-002: Accessibility Audit**
  - Issue: No accessibility testing done.
  - Action: Run axe DevTools, fix critical issues (focus, labels, contrast).
  - Effort: 3-4 hours

- [ ] **TEST-003: Real Device Testing**
  - Issue: Only tested in browser dev tools.
  - Action: Test on physical iOS (iPhone SE, 14) and Android devices.
  - Effort: 2-3 hours

---

## Quick Reference: File Locations

| Category | Key Files |
|----------|-----------|
| **Auth** | `src/contexts/AuthContext.tsx`, `src/pages/Auth.tsx` |
| **Dashboard** | `src/pages/Dashboard.tsx`, `src/components/dashboard/` |
| **Mobile** | `src/components/mobile/`, bottom nav in Dashboard |
| **Onboarding** | `src/pages/Onboarding.tsx`, `src/components/onboarding/` |
| **Styles** | `src/index.css`, `tailwind.config.ts` |
| **Forms** | `src/components/dialogs/`, `src/lib/validationSchemas.ts` |
| **AI/Rari** | `src/components/rari/`, `src/hooks/useRari*` |
| **Security** | `supabase/functions/`, `.env` |

---

## Sprint Schedule Recommendation

| Day | Focus | Priority |
|-----|-------|----------|
| **Day 1** | Security audit (SEC-*), Critical bugs (BUG-*) | P0 |
| **Day 2** | Empty states (UX-001), Form validation (UX-002) | P0 |
| **Day 3** | Dashboard density (UI-001), Whitespace (UI-002) | P1 |
| **Day 4** | Mobile/Tablet responsive (MOB-*) | P1 |
| **Day 5** | Codebase cleanup (CODE-*), Error tracking (DBG-001) | P2 |
| **Day 6** | Performance (PERF-*), Typography (TYP-*) | P2 |
| **Day 7** | Buffer/Polish, Testing on real devices | P3/Buffer |

---

## Success Metrics

After completing P0 and P1 items:
- [ ] No "Coming Soon" messages visible in production
- [ ] All forms have proper validation feedback
- [ ] Empty states are helpful, not confusing
- [ ] Mobile experience is smooth (44px touch targets, no horizontal scroll)
- [ ] Error tracking is active (Sentry)
- [ ] Security audit passed
- [ ] Real device testing completed

**Target Rating After Sprint: 8.5/10** (up from 7.8/10)

---

## Notes for Developers

1. **Always test on mobile** - Use Chrome DevTools device mode for initial testing, then real devices.
2. **Dark mode** - Test all changes in both light and dark modes.
3. **Accessibility** - Use tab key to navigate, ensure focus states are visible.
4. **Performance** - Check Network tab for unnecessary requests, bundle size impact.
5. **Security** - Never expose API keys, always use server-side validation.

---

*Last Updated: January 12, 2026*
*Review this document daily during the sprint.*

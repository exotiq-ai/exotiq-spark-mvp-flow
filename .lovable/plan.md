## Problem

Clicking "View Full Profile" in the booking details dialog jumps to FleetCopilot (`/dashboard/fleetcopilot?view=crm&customerId=…`), which doesn't render a customer profile. The CRM actually lives inside the **Book** module (`/dashboard/bookings?tab=customers&customerId=…`), where `CRMSection` reads `customerId` from the URL and opens the profile.

## Root cause

`src/hooks/useModuleNavigation.ts` -> `goToCustomerProfile` targets module `core` (FleetCopilot) instead of `book`. Every call site that funnels through this helper (or duplicates it inline) inherits the wrong route.

## Miswired call sites (audit)

1. `src/hooks/useModuleNavigation.ts:14-17` — `goToCustomerProfile` routes to `core` with `view: 'crm'`.
2. `src/components/dialogs/EnhancedBookingDialog.tsx:1327` — "View Full Profile" button calls `onNavigateToModule("core", { customerId })`; parent handlers in `BookEnhanced.tsx` then invoke the broken `goToCustomerProfile`.
3. `src/components/dashboard/BookEnhanced.tsx:381` and `:583` — treat `moduleId === 'core' + customerId` as "go to customer profile", reinforcing the wrong contract.
4. `src/components/dashboard/DashboardBottomActionBar.tsx:242` — customer command-palette action navigates to `moduleIdToPath("core", { customerId })` inline.

Other callers (`EnhancedGlobalSearch.tsx:319`, `CommandPalette.tsx:162`) already correctly use `book` + `tab: 'crm'`, confirming Book is the right destination.

## Fix

Point every customer-profile navigation at Book/CRM:

- Update `goToCustomerProfile` in `useModuleNavigation.ts` to:
  `navigate(moduleIdToPath('book', { tab: 'crm', customerId }))`
- In `EnhancedBookingDialog.tsx`, change the "View Full Profile" click to emit `onNavigateToModule('book', { tab: 'crm', customerId })` (semantics now match the destination).
- In `BookEnhanced.tsx` (both handlers, lines 375 and 582), replace the `moduleId === 'core' && customerId` branch with a `moduleId === 'book' && context?.customerId` branch that calls `goToCustomerProfile(context.customerId)`. Keeps the vehicle/payments branches untouched.
- In `DashboardBottomActionBar.tsx:242`, replace the inline `moduleIdToPath("core", { customerId })` with `moduleIdToPath("book", { tab: "crm", customerId })` (or reuse `goToCustomerProfile` via the hook to stay DRY).

No changes to CRMSection, no schema/backend changes, no routing table changes — `BookEnhanced` already consumes `tab=customers` (accepts `crm` alias, line 169) and `CRMSection` already consumes `customerId`.

## Verification

- Open a booking from `/dashboard/bookings` calendar → click **View Full Profile** → lands on `/dashboard/bookings?tab=customers&customerId=…` with the customer profile dialog open.
- Trigger the same button from `BookEnhanced` list view and from `CustomerProfileDialog`'s nested booking dialog — both should reach the CRM profile, not FleetCopilot.
- Command palette + bottom action bar customer entries should still open the CRM profile.
- No regression to Change Vehicle (motoriq) or Payments navigation.

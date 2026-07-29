
# Navigation Restructure — Book, Customers, Fleet, Vault

Goal: Sharpen module purpose, align with role-based depth, and remove the "catch-all" feel from Book. No business logic changes — this is a navigation, labeling, and view-composition refactor.

## Sidebar after the change

```
Intelligence
  Dashboard
  FleetCopilot™
  MotorIQ

Operations
  Pulse
  Book          ← Calendar + Bookings + slim Payments only
  Customers     ← promoted from CRM tab (renamed)
  Fleet         ← + Inspections tab
  Vault         ← keeps deep Payments/Refunds/Deposits/Damage
```

Book keeps its Overview tab (per your answer). Margin is unchanged.

## Module responsibilities

### Book (transaction layer)
Tabs: **Overview · Calendar · Bookings · Payments**
- Payments here becomes the *operator* view only (see below).
- CRM tab removed.
- Inspections tab removed.

### Customers (new sidebar item, renamed from CRM)
Landing view: customer directory with Cards ↔ List toggle (as today) plus:
- **Segments/filters**: All · VIP · Repeat · New · At-risk (computed from existing customer fields — no schema change)
- **Import/Export CSV**: reuse existing `useImportHistory` + `exportUtils` patterns
- Clicking a customer opens `CustomerProfileDialog` in the same tab (unchanged — keeps the session-safety fix)
- Roles: Viewer sees list read-only; Operator+ can edit; Manager+ can import/export

### Fleet (vehicle layer)
Add **Inspections** as a new tab alongside existing fleet tabs.
- Move the inspections list, filters, and history view from Book → Fleet.
- Check-in/out dialogs still launch from a booking (deep-linked); the *record* lives in Fleet.
- Deep links from notifications / global search updated to `/dashboard/fleet?tab=inspections&inspectionId=…`.

### Book → Payments (slim, operator-level)
Shows per-booking:
- Payment status + amount paid / due (read-only summary)
- **Record manual payment** (cash/transfer) — existing action
- **Send payment reminder** email — existing action
Removed from Book's Payments view (kept in Vault):
- Refund flows, Stripe fee breakdowns, reconciliation exports, deposit tooling, dispute handling

### Vault (finance/compliance depth) — unchanged surface, gains authority
Continues to own: refunds, deposits (operator reference), damage claims, document archive, deep payment reconciliation. Manager+ / Owner-Admin gated as today.

## Role visibility matrix

| Module      | Viewer | Operator | Manager | Admin/Owner |
|-------------|--------|----------|---------|-------------|
| Book        | read   | full     | full    | full        |
| Customers   | read   | edit     | + I/O   | full        |
| Fleet       | read   | edit     | + OOO   | full        |
| Vault       | —      | —        | read    | full        |

(Matches existing `useUserRole` gating; no new roles.)

## Routing

Add to `src/lib/moduleRoutes.ts`:
- `customers` → `/dashboard/customers`
- Legacy `bookings?tab=crm[&customerId=…]` → redirect to `/dashboard/customers?customerId=…`
- Legacy `bookings?tab=inspections[&inspectionId=…]` → redirect to `/dashboard/fleet?tab=inspections&inspectionId=…`

Update all `useModuleNavigation` helpers (`goToCustomerProfile`, `goToInspection`, `goToCustomerBookings`) to point at the new paths. Update deep links in notifications, global search, Rari, and email templates.

## Files touched (no logic changes)

- `src/lib/moduleRoutes.ts` — add `customers`, update titles, legacy redirects
- `src/components/dashboard/DashboardSidebar.tsx` — add Customers item (Users icon), reorder Operations
- `src/App.tsx` (or dashboard router) — new `/dashboard/customers` route; back-compat redirects
- `src/hooks/useModuleNavigation.ts` — repoint customer + inspection helpers
- `src/components/dashboard/BookEnhanced.tsx` — remove CRM + Inspections tabs; slim Payments tab contents
- `src/components/dashboard/CRMSection.tsx` → mount under new `CustomersPage.tsx`; add Segments filter row
- New `src/pages/dashboard/CustomersPage.tsx` — thin wrapper
- New `src/components/fleet/FleetInspectionsTab.tsx` — mounts existing inspections components
- `src/components/dashboard/FleetPageEnhanced.tsx` — add Inspections tab
- Notification/search/Rari deep-link builders — repoint to new paths
- Email templates using `/dashboard/bookings?tab=crm|inspections` — repoint

## Backwards compatibility

Every legacy URL (bookmarks, notifications sent last week, Rari links) resolves via redirect. Nothing 404s.

## Out of scope

- No DB migrations. No RLS changes. No new roles. No pricing/payment logic changes.
- No new CRM features beyond segments filter + CSV (both reuse existing utilities).
- Marketing site, published marketplace, and Command Center super-admin views are untouched.

## Rollout

1. Ship routing + redirects + sidebar entry (dark, no visible change until pages exist).
2. Move Customers page + verify redirects.
3. Move Inspections into Fleet + verify redirects.
4. Slim Book → Payments.
5. Smoke test across roles (Viewer, Operator, Manager, Owner) on one live tenant before broad announce.

## Why this shape (short rationale)

- **Book stays a transaction module** — advisor is right; five tabs was too many mental models.
- **"Customers" beats "CRM"** — matches operator language, future-proofs for Leads later.
- **Inspections belong to vehicles**, not transactions — operators ask "what's this car's condition history?", not "what did this booking do?"
- **Payments split by depth, not module** — one dataset, two audiences, matches existing RBAC intent. Avoids a third top-level "Payments" module that would bloat the sidebar.

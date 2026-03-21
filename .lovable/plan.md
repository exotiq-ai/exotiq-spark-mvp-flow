

# Booking Overview Tab — UX Redesign

## Current Layout (top to bottom)
1. Pending Approval — large card, up to 3 bookings expanded, dominates viewport
2. Next Pickup — large gradient card with vehicle image, details, value
3. Quick Stats — 4 cards: Today's Revenue, Active Rentals, New Customers, Utilization
4. Today's Schedule — full booking list with "New Booking" button buried inside
5. Upcoming Bookings (next 15 days)
6. Previous Bookings (last 30 days)

## Problems
- "New Booking" is the #1 action but it's hidden inside the Today's Schedule card header — hard to find
- Pending Approval takes disproportionate space for what's often 0-3 items
- Revenue + Utilization stats belong in MotorIQ/Pulse, not the booking module
- Next Pickup card is oversized for a single data point
- The overview reads like an analytics dashboard, not an operations command center

## Proposed Layout

```text
┌─────────────────────────────────────────────┐
│  [+ New Booking]  prominent, top-right      │
│                                             │
│  ┌─ Pending (2) ──────────────────────────┐ │
│  │ ▸ collapsed bar, click to expand       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ Next Pickup ─────┐  ┌─ Today ────────┐ │
│  │ compact inline     │  │ 3 bookings     │  │
│  │ card, 1 row        │  │ 2 active       │  │
│  └────────────────────┘  └────────────────┘ │
│                                             │
│  ┌─ Today's Schedule ────────────────────┐  │
│  │ (full list, same as current)          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Upcoming 15d ────┐ ┌─ Previous 30d ──┐ │
│  │ collapsible        │ │ collapsible     │  │
│  └────────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────┘
```

## Changes

### 1. Promote "New Booking" button to page-level header
Move it out of Today's Schedule and into a sticky header area at the top of the overview tab — large, prominent, always visible. Same pattern as the current `Book.tsx` header but inside the tab content.

### 2. Pending Approval → collapsed notification bar
Replace the large card with a compact collapsible bar (using the existing `CollapsibleSection` pattern). Default collapsed. Shows count badge. Expands to reveal the same approve/decline/view actions. When count is 0, the bar is hidden entirely.

### 3. Remove revenue/utilization stats from overview
Drop "Today's Revenue" and "Utilization" from the 4-stat grid — these live in MotorIQ and Pulse. Keep only **Active Rentals** and **Today's Bookings** as two compact inline metrics alongside the Next Pickup card.

### 4. Compact Next Pickup card
Shrink from a full-width gradient card to a compact card in a 2-column grid alongside the two key stats (Active Rentals, Today's Bookings). Show vehicle name, customer, time, and location in a dense single-card layout. Remove the large vehicle thumbnail and booking value display.

### 5. Today's Schedule keeps "New Booking" as secondary action
The schedule card retains a smaller "+ Add" button but it's no longer the primary entry point.

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookEnhanced.tsx` | Restructure overview tab: move New Booking button to top, collapse pending into bar, remove revenue/utilization stats, compact Next Pickup into grid with remaining stats |

## What Stays the Same
- Today's Schedule booking list (content and interactions)
- Upcoming/Previous booking cards
- All other tabs (Calendar, CRM, Payments, Inspections)
- All dialog logic (NewBookingDialog, EnhancedBookingDialog, etc.)


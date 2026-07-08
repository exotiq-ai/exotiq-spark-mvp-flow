# Simplify the Booking Dialog action row

Keep users focused on the booking they just opened. Stop bouncing them into other modules unless the action is genuinely part of the booking workflow.

## What changes for the user

When you click a reservation on the calendar:

- **Before:** the dialog shows three jump buttons — Vehicle, CRM, Payments. Vehicle sends you to FleetCopilot (the vehicle's full page). CRM sends you to the customer's profile. Both yank you out of the booking flow.
- **After:** only **Payments** remains, because recording/reviewing a payment is part of managing the booking. The Vehicle and Customer info stays visible in the dialog (name, image, contact), but no longer acts as a jump link. You stay in the booking module.

Result: opening a reservation no longer changes the page or closes the calendar day panel. Fewer accidental navigations, less "wait, where did I go?"

## Files touched

1. **`src/components/dashboard/EnhancedBookingDialog.tsx`**
   - Remove the "Vehicle" quick-nav button (the one that calls `onNavigateToModule('motoriq', ...)`).
   - Remove the "CRM" quick-nav button (calls `onNavigateToModule('crm', ...)`).
   - Keep the "Payments" button, and rename its label to something explicit like **"Record / view payments"** so the intent is obvious.
   - Make sure the vehicle and customer blocks in the dialog body remain as read-only info (image, name, plate, phone, email) — no click handler, no cursor-pointer, no hover state that implies navigation.

2. **`src/components/dashboard/BookEnhanced.tsx`**
   - The `onNavigateToModule` handler currently branches on `motoriq` / `crm` / `payments`. Leave the switch intact (other callers may still use it), but the branches for `motoriq` and `crm` become unreachable from the dialog. No behavior change needed here.

3. **No route or module-registry changes.** FleetCopilot and CRM remain fully accessible from the sidebar and global search — we're only removing the in-dialog shortcuts.

## Out of scope (flagged for a later pass)

- The internal naming mismatch where the dialog passes `moduleId="motoriq"` but the route resolves to `/fleetcopilot`. Cosmetic tech debt; doesn't affect users. Worth cleaning up when we next touch `useModuleNavigation`.
- The other three items from the earlier booking review (mobile drawer scroll, Google Calendar cancellation sync, pickup times in GCal notes) — still queued, not part of this change.

## Verification

- Open a booking from the month calendar → dialog opens, only "Record / view payments" appears in the action row.
- Click anywhere on the vehicle or customer info blocks → nothing happens (no navigation).
- Click "Record / view payments" → routes to the booking's payments view as today.
- Close dialog → calendar day panel is still open, still scrolled to the same spot.
- Mobile: same behavior, action row no longer overflows with three buttons.

# CRM List View UX Refresh

## User Experience Recommendation

### Cards vs List
- Add a **Cards / List** toggle in the Customer Database header.
- Cards stay the default. They are best for small databases, visual hierarchy, and surfacing quick actions at a glance.
- List view is best for larger databases, fast scanning, sorting, and comparing many customers. Operators managing 50+ renters need a denser, scannable format.

### Click Behavior: Modal vs New Tab
- **Primary click opens the customer profile modal.**
  - Customer lookup is usually a reference task while the operator is already in a workflow (calendar, booking, approvals). A modal preserves the current navigation context and avoids tab clutter.
- **Deep work gets an explicit new-tab option.**
  - Add an "Open in new tab" icon in the list row, card header, and modal header. Middle-click or Cmd/Ctrl+click also still opens the deep-link URL.
  - This gives operators the best of both worlds: fast modal reference and easy side-by-side comparison when needed.

## What to Build

### 1. View Mode Toggle
- Add a segmented control in the Customer Database header between the title and the Export/Add buttons.
- Use existing shadcn `ToggleGroup` or styled buttons with the existing `outline` / `default` variants.
- Persist the selected mode in `localStorage` as `exotiq-crm-view-mode` with default `cards`.

### 2. Compact List View
- Build a new `CustomerListRow` component or render rows inline in `CRMSection`.
- Row layout (desktop): Name | Status | Email | Lifetime Value | Last Booking | Actions menu.
- Row layout (mobile): Name + Status on top, Email + LTV + Last Booking on the second line, actions menu on the right.
- Hide secondary data from the row: bookings count, tags, and individual phone/email/calendar buttons. Move these into a kebab menu or the modal.
- Clicking the row opens the modal. Hover state uses the existing `hover-scale` / `bg-muted/30` pattern.

### 3. Card View Cleanup
- Keep the existing card grid as the default.
- Add a subtle external-link icon to each card header (next to the status badge) for opening the full profile in a new tab.
- Keep card body fields as they are, or slightly reduce visual density if needed.

### 4. Modal Enhancement
- Add an external-link icon to the `CustomerProfileDialog` header to open the customer in a new tab.
- Ensure the modal can be closed with `Esc` and that focus returns to the triggering row/card.

### 5. Click Behavior Rollback
- Revert the whole-card click from `window.open(newTab)` to opening the modal (`setSelectedCustomerId` + `setShowCustomerProfile(true)`).
- Attach the `window.open` action only to the new explicit external-link icons.
- Keep the deep-link URL support (`/dashboard/bookings?tab=crm&customerId=...`) so direct links and new tabs still work.

### 6. Accessibility
- List rows remain keyboard-focusable with `tabIndex={0}` and `role="button"`.
- Provide `aria-label="Open [name] profile"` on the row and `aria-label="Open [name] profile in new tab"` on the external-link icon.

## Files to Edit
- `src/components/dashboard/CRMSection.tsx` — add the toggle, list rendering, and revised click handlers.
- `src/components/dashboard/CustomerListRow.tsx` (new) — compact list row component.
- `src/components/dialogs/CustomerProfileDialog.tsx` — add external-link icon in the header.

## Design Tokens
- Use only semantic tokens (`bg-muted/30`, `border-primary/10`, `text-muted-foreground`, `text-success`, `hover-scale`).
- No new hardcoded colors or arbitrary hex values.

## Verification
- Run `tsgo` to confirm type safety.
- Run a Playwright check that:
  - the toggle switches between cards and list,
  - clicking a row/card opens the modal,
  - clicking the external-link icon opens the profile in a new tab,
  - the original CRM list remains in the original tab.
- Check mobile list view to ensure no horizontal overflow or clipped text.

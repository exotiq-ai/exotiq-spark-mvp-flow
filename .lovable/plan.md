Change the customer card click behavior in the CRM grid so it opens the customer profile in a new browser tab instead of an inline modal, keeping the existing quick-action buttons untouched.

### Changes
1. `src/components/dashboard/CRMSection.tsx`
   - Replace `handleCustomerClick` inline modal behavior with `window.open(moduleIdToPath('book', { tab: 'crm', customerId: customer.id }), '_blank', 'noopener,noreferrer')`.
   - Keep the inner quick-action buttons (phone, email, new booking) as-is — they already call `e.stopPropagation()` so they won't trigger the new-tab action.
   - Ensure the entire card is still keyboard-accessible (the wrapping div is already focusable via cursor-pointer, but we should verify the click handler works with Enter/Space).

2. Reuse existing deep-link support
   - The URL `/dashboard/bookings?tab=crm&customerId=<id>` is already handled by `CRMSection`'s `useEffect` deep-link that auto-opens the `CustomerProfileDialog` in the new tab. No new route or full-page view needed.

### UX considerations
- Right-click / middle-click on the card will not automatically open the link context menu because it's still a clickable div, not an `<a>` tag. If we want native link affordances (e.g. "Open in new tab" right-click), we should wrap the card in a `<Link>` from `react-router-dom` instead of a click handler. Decision needed.

### Scope question
- Should this apply to the CRM grid cards only, or also to other customer representations (e.g., customer links in `EntityLink`, search results in `EnhancedGlobalSearch`, booking detail customer rows)?

### Verification
- Smoke-test: click a customer card in CRM → new tab opens at `/dashboard/bookings?tab=crm&customerId=<id>` with the customer profile dialog visible.
- Confirm phone, email, and new-booking buttons still work inside the card without opening a new tab.
- Confirm the original tab remains on the CRM list (no state loss).
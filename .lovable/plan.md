

# Booking Overview Enhancements + Calendar Fix

## 4 Changes

### 1. Approval Animation (Booking disappears smoothly)

Wrap the pending bookings list items in `AnimatePresence` with Framer Motion exit animations. When "Approve" or "Decline" is clicked, the booking row will slide out and fade with a smooth spring animation before being removed from the DOM.

**File:** `src/components/dashboard/BookEnhanced.tsx`
- Import `motion, AnimatePresence` from framer-motion
- Wrap the `pendingBookings.slice(0, 3).map(...)` block in `<AnimatePresence>`
- Convert each pending booking row `<div>` to `<motion.div>` with:
  - `initial={{ opacity: 0, x: -20 }}`
  - `animate={{ opacity: 1, x: 0 }}`
  - `exit={{ opacity: 0, x: 100, height: 0, marginBottom: 0 }}` (slides right and collapses)
  - `transition={{ type: "spring", damping: 20, stiffness: 300 }}`
  - `layout` prop for smooth reflow when items leave

---

### 2. Payment Types on Tenant Account

Store accepted payment methods in the existing `teams.settings` JSONB column (no migration needed -- it already exists as a flexible JSON field).

**Structure in settings:**
```json
{
  "accepted_payment_methods": ["cash", "bank_transfer", "credit_card", "zelle", "venmo", "paypal"],
  "default_payment_method": "cash"
}
```

**Files:**
- **`src/components/settings/` (new or existing settings section):** Add a "Payment Methods" settings card where the tenant can toggle which payment methods they accept (checkboxes). Options: Cash, Bank Transfer, Credit Card (note: stored locally until Stripe Connect), Zelle, Venmo, PayPal, Other.
- **`src/components/dialogs/RecordPaymentDialog.tsx`:** Read accepted methods from team settings to populate the payment method dropdown, instead of hardcoded options.
- **`src/contexts/TeamContext.tsx`:** Expose a helper to read/write `settings.accepted_payment_methods`.

A note will display: "Credit card processing will be available once Stripe Connect is activated. Until then, card details are recorded as reference only -- not stored or charged."

---

### 3. Upcoming + Previous Bookings Collapsible Cards

Add two new collapsible cards below the "Today's Schedule" card in the overview tab, using the existing `CollapsibleSection` component.

**File:** `src/components/dashboard/BookEnhanced.tsx` (overview tab, after Today's Schedule card)

**Upcoming Bookings (Next 15 Days):**
- Collapsible, default open
- Shows confirmed/pending bookings starting in the next 15 days
- Each row: Vehicle name, Customer name, Start date, Duration (days), Value, Status badge
- Sorted by start_date ascending
- Max 10 shown, with "+X more" if exceeded
- Summary header shows count and total pipeline value

**Previous Bookings (Last 30 Days Completed):**
- Collapsible, default collapsed
- Shows completed bookings from the last 30 days
- Each row: Vehicle name, Customer name, Dates, Value, Completion status
- Sorted by end_date descending
- Max 10 shown
- Summary header shows count and total revenue collected

Both cards are clickable to open the `EnhancedBookingDialog` for any booking.

---

### 4. Calendar Not Pulling Bookings (Root Cause + Fix)

**Root Cause:** The bookings query in `FleetContext.tsx` fetches with no `.limit()`, but Supabase defaults to **1000 rows max**. The database has **4,155 bookings**. Since the query orders by `created_at DESC`, only the 1,000 most recently created bookings are returned. Any bookings created earlier (which may span the current month) are silently dropped.

**Fix in `src/contexts/FleetContext.tsx`:**
- Add `.limit(5000)` to the bookings query to fetch all bookings (or a much higher ceiling)
- Alternatively, add a date range filter to only fetch bookings where `end_date >= 90 days ago` to keep the payload reasonable while ensuring relevant bookings appear

The recommended approach is adding a range filter:
```typescript
supabase.from('bookings').select('*')
  .eq(filterCol, filterVal)
  .gte('end_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
  .order('start_date', { ascending: false })
  .limit(5000)
```

This ensures the calendar and all other views see relevant bookings without hitting the default 1000-row cap.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookEnhanced.tsx` | Approval animation + Upcoming/Previous collapsible cards |
| `src/contexts/FleetContext.tsx` | Fix bookings query limit (calendar fix) |
| `src/contexts/TeamContext.tsx` | Add payment method settings helpers |
| Settings component (existing) | Payment methods configuration UI |
| `src/components/dialogs/RecordPaymentDialog.tsx` | Use tenant's accepted payment methods |


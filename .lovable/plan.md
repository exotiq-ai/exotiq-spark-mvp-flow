

# Search Bar Improvements + Sunset Bottom Action Bar

## Bottom Action Bar — Sunset It

The bottom bar duplicates the header search (both open ⌘K), duplicates quick actions already available in module headers (New Booking, Add Customer), and adds visual clutter. The only unique element is the Rari mic button — but Rari already has its own sidebar trigger/orb.

**Recommendation: Remove it.** Keep the quick action icons (New Booking, Record Payment, Add Customer, Generate Report, Schedule Maintenance) as they are useful — but relocate them into the header search bar's "Quick Actions" section (they're already there). The Rari orb/sidebar handles AI access.

## Search Bar Improvements

### What already works
- Vehicle search by make/model/plate → deep-links to Vehicle Command Center
- Customer search by name/email/phone → deep-links to CRM card
- Booking search by customer name, vehicle name, status → opens booking dialog
- Booking ref search (e.g., "BK-01001") → opens booking dialog
- Quick actions (New Booking, Add Vehicle, Add Customer)
- Module navigation
- Export actions
- Ask Rari with query passthrough

### What's missing / broken

1. **CRM deep-link incomplete** — search navigates to CRM tab but `CRMSection` doesn't read `customerId` from URL to auto-open the profile card (from the previous approved plan, not yet implemented)

2. **No booking ID search** — users can't paste a UUID booking ID to find a booking. Only `booking_ref` (BK-01001) and customer/vehicle name work.

3. **No vehicle name search** — vehicles have a `name` field (e.g., "Midnight Express") but the cast `(v as any).name` is fragile. Should use the proper typed field.

4. **No license plate prominent display** — plate is in subtitle but not visually distinct. For fleet ops, plate is often the primary identifier.

5. **Customer results lack context** — just shows email. No indication of booking activity (active rentals, pending bookings).

6. **No "no results" guidance** — empty state just says "Try a different search term" with no helpful suggestions.

## Changes

### 1. Remove `DashboardBottomActionBar`
Delete from `DashboardOverviewEnhanced.tsx`. The header ⌘K search already has all quick actions, module nav, and exports.

### 2. CRM deep-link: auto-open customer profile card
In `CRMSection.tsx`, read `customerId` from URL params. If present, auto-select that customer and open `CustomerProfileDialog`. Clear the param after consuming it.

### 3. Add booking UUID search
In `EnhancedGlobalSearch.tsx`, add a filter that matches `b.id` (the UUID) against the search query. This lets users paste a booking ID directly.

### 4. Enrich customer search results
Look up each matched customer's bookings from the already-loaded `bookings` array. Show subtitle like "2 active · 1 pending" instead of just email.

### 5. Better empty state
When no results, show contextual suggestions: "Try searching by booking ref (BK-01001), license plate, or customer name."

## Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardOverviewEnhanced.tsx` | Remove `DashboardBottomActionBar` import and usage |
| `src/components/dashboard/DashboardBottomActionBar.tsx` | Delete file (or keep for future reference) |
| `src/components/dashboard/CRMSection.tsx` | Read `customerId` from URL, auto-open profile dialog |
| `src/components/common/EnhancedGlobalSearch.tsx` | Add booking UUID search, enrich customer subtitles with booking context, improve empty state |


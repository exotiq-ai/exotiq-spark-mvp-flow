

# Clean Up Billing Toggle & Add to Modal

## What's Wrong Now
The "Monthly / Switch to Annual / Annual" toggle on the SubscriptionSection looks clunky — it's a button squeezed between two text labels. The modal shows billing as a static read-only line, so users can't switch billing frequency once they've opened the plan details.

## Changes

### 1. SubscriptionSection — Replace toggle with a proper switch-style UI
**File:** `src/components/dashboard/settings/SubscriptionSection.tsx`

Replace the current awkward "Monthly [Button] Annual" layout (lines 140-151) with a clean segmented toggle using two side-by-side buttons (pill style):
- Two buttons: "Monthly" and "Annual" in a rounded container
- Active state gets filled background, inactive gets ghost
- "Save 2 months" badge next to the Annual option
- Apply the same toggle in both the "no subscription" and "has subscription" plan grids

### 2. PlanSelectionModal — Add interactive billing toggle
**File:** `src/components/landing/pricing/PlanSelectionModal.tsx`

- Make `isAnnual` internal state (initialize from the prop, but let users toggle it inside the modal)
- Replace the static "Billing: Annual/Monthly" display (lines 164-170) with the same segmented toggle component
- Price calculation already reacts to `isAnnual`, so toggling will live-update the total
- Pass the current `billingIsAnnual` state to the checkout call

### 3. Extract a shared BillingToggle component
**File:** `src/components/landing/pricing/BillingToggle.tsx` (new)

Small reusable component:
- Props: `isAnnual: boolean`, `onChange: (annual: boolean) => void`, `size?: 'sm' | 'default'`
- Renders two side-by-side pill buttons with a "Save 2 months" badge on Annual
- Used in both SubscriptionSection and PlanSelectionModal

## Files Changed

| File | Change |
|------|--------|
| `src/components/landing/pricing/BillingToggle.tsx` | New shared toggle component |
| `src/components/landing/pricing/PlanSelectionModal.tsx` | Replace static billing display with interactive toggle, make `isAnnual` local state |
| `src/components/dashboard/settings/SubscriptionSection.tsx` | Use new BillingToggle in both plan grid sections |


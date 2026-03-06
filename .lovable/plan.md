

# Fix: Move MotorIQ from Operations to Intelligence

## The Problem
The active sidebar component is `DashboardSidebarEnhanced.tsx`, not `DashboardSidebar.tsx`. The previous edit moved MotorIQ in the wrong file. In the enhanced sidebar, MotorIQ is still under "Operations" at line 187.

## The Fix

**`src/components/dashboard/DashboardSidebarEnhanced.tsx`** — Move MotorIQ from the `operations` group to the `intelligence` group:

```
operations.items: Dashboard, Bookings, Fleet, Pulse
intelligence.items: FleetCopilot™, MotorIQ, Vault
```

MotorIQ sits between FleetCopilot™ and Vault in the Intelligence group, matching the user's desired layout from screenshot 2.

**`src/components/mobile/MobileMoreMenu.tsx`** — Mirror the same grouping for mobile consistency.

| File | Change |
|------|--------|
| `DashboardSidebarEnhanced.tsx` | Move MotorIQ line from operations to intelligence group |
| `MobileMoreMenu.tsx` | Move MotorIQ to intelligence group (if not already) |


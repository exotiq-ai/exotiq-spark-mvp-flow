

## Answers

**What's the difference?** `DashboardSidebarEnhanced.tsx` is the **active** sidebar used by `Dashboard.tsx`. `DashboardSidebar.tsx` is the **old/legacy** version that's no longer imported anywhere — it's dead code.

**MotorIQ ordering:** Currently in the Enhanced sidebar (line 193-195), the Intelligence group has FleetCopilot™ first, then MotorIQ. You want MotorIQ **above** FleetCopilot™.

## Fix

**`src/components/dashboard/DashboardSidebarEnhanced.tsx`** — Swap the order in the intelligence items array:

```typescript
items: [
  { id: "motoriq", name: "MotorIQ", icon: TrendingUp, minRole: 'manager' },
  { id: "core", name: "FleetCopilot™", icon: Brain, minRole: 'operator' },
  { id: "vault", name: "Vault", icon: Shield, minRole: 'operator' },
]
```

**`src/components/mobile/MobileMoreMenu.tsx`** — Mirror the same order for mobile.

One-line swap in each file. No other changes needed.

| File | Change |
|------|--------|
| `DashboardSidebarEnhanced.tsx` | Swap MotorIQ above FleetCopilot™ |
| `MobileMoreMenu.tsx` | Mirror same order |




# Dynamic Pricing Tab — UI Overhaul + AI-Powered Price Editor

## Problems Identified

1. **Revenue Comparison shows "--" for MoM/YoY** — the calculation works but there's likely no last-year data, so it shows "--". Should gracefully handle this with context.

2. **Pricing factor cards are too large** — 4 big cards with oversized numbers take up prime real estate. Should be compact chips/pills with hover for detail.

3. **"AI Active" badge** — should match the product branding. "FleetCopilot™" is already established across the app (sidebar, chat, alerts). Recommend keeping "FleetCopilot™ Active" for consistency.

4. **QuickPriceEditorDialog is disconnected from AI** — the friend's feedback nails it: clicking "Apply" on an AI recommendation opens a generic slider dialog with no AI reasoning, no event context, no before/after comparison. This is the biggest UX gap.

5. **Vehicle list is dense but lacks progressive disclosure** — all vehicles shown equally, no priority ordering by opportunity size.

6. **Effective Rate Multiplier** is abstract — operators don't think in multipliers, they think in dollars.

---

## Plan

### 1. Redesign Pricing Factors — Compact Chip Layout

Replace the 4 large factor cards with a single horizontal row of compact pills:

```text
┌──────────────────────────────────────────────────┐
│ Base $1,200  │ Demand +25%  │ Season +8%  │ 🎪 Ultra +35%  │
│   (hover → tooltip with full explanation)         │
└──────────────────────────────────────────────────┘
```

- Each pill is a Badge-style chip with the factor name + value
- Hover reveals a tooltip with the data source explanation
- Click opens a popover with detailed breakdown (booking data, event details)
- Active events get a sparkle icon and accent color
- Saves ~200px of vertical space

### 2. Revenue Comparison — Smarter Display

- Show "No prior data" instead of "--" when MoM/YoY can't be calculated
- Add the actual dollar amounts on hover (e.g., "$12,400 last month")
- Make this section a single compact row instead of a 3-column grid

### 3. Rename Badge: "FleetCopilot™ Active"

FleetCopilot is already the established AI brand across sidebar, chat, alerts. Keep it consistent. Replace:
```
AI Active → FleetCopilot™ Active
```

### 4. Transform QuickPriceEditorDialog into AI-Powered Confirmation Flow

This is the biggest change — closing the gap between AI recommendation and pricing action.

**New flow when clicking "Apply" from AI recommendation:**

The dialog gets a new `pricingContext` prop containing:
- `reasoning` (AI's explanation)
- `factors` (what drove the recommendation — events, demand, season)  
- `confidence` score
- `expectedRevenue` impact
- `events` that influenced the suggestion

**New dialog layout:**

```text
┌─────────────────────────────────────────┐
│ 🚗 2024 BMW M4 Competition             │
│ ─────────────────────────────────────── │
│                                         │
│ ⚡ AI Recommendation                    │
│ "Ultra Music Festival drives 35% surge  │
│  in luxury demand Mar 28-30. Combined   │
│  with 67% utilization, increasing rate  │
│  captures peak-season revenue."         │
│                                         │
│ 📊 What's driving this:                │
│  • Ultra Music Festival (Mar 28-30)     │
│  • Current utilization: 67%             │
│  • Seasonal demand: +8%                 │
│                                         │
│ ┌─────────────┐  →  ┌─────────────┐   │
│ │ $1,200/day  │     │ $1,620/day  │   │
│ │  Current    │     │  Suggested  │   │
│ └─────────────┘     └─────────────┘   │
│                                         │
│ 📈 Impact: +$12,600/month              │
│ 🎯 Confidence: 87%                     │
│                                         │
│  [───────────●─────] $1,620/day        │
│  (slider still available for manual)    │
│                                         │
│  [ Cancel ]  [ Confirm $1,620/day ✓ ]  │
└─────────────────────────────────────────┘
```

- AI reasoning block appears at the top with event badges
- Before/after comparison is visually prominent (two cards side by side)
- Slider is still there for manual override, but starts at AI-suggested rate
- Monthly impact shown prominently
- Confidence badge gives trust signal
- Remove the date-range toggle (noted as "future update" anyway — dead UI)

### 5. Vehicle List — Priority Ordering + Compact Layout

- Sort vehicles by opportunity size (highest potential gain first)
- Already-applied vehicles move to bottom with green state
- Show inline AI reasoning snippet when a vehicle has been analyzed (one line: "Ultra Festival surge • 67% util • +$420/mo")
- Remove individual auto-pricing Switch per vehicle (confusing since it doesn't actually do anything yet)

### 6. Effective Rate Multiplier — Replace with Fleet Summary

Replace the abstract "1.28x multiplier" card with:

```text
┌──────────────────────────────────────────┐
│ Fleet Pricing Summary                    │
│ Avg Rate: $1,450/day  │  Fleet Rev: $43K │
│ Vehicles Optimized: 3/12  │  Util: 17%  │
└──────────────────────────────────────────┘
```

Operators understand dollars and counts, not multipliers.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/dashboard/DynamicPricingCard.tsx` | Compact factor chips, priority-sorted vehicle list, fleet summary replacing multiplier, remove auto-pricing switches, rename badge |
| `src/components/dialogs/QuickPriceEditorDialog.tsx` | Add `pricingContext` prop, AI reasoning block, before/after comparison, event badges, remove date-range section |
| `src/components/dashboard/MotorIQEnhanced.tsx` | Pass pricing context when opening dialog from AI recommendation |

No database changes. No new edge functions.




# Tenant-Configurable Gas Fee Settings

## The Problem

The gas fee is hardcoded as `DEFAULT_GAS_FEE = 20.00` across the entire platform. Every tenant gets the same $20 fee with the same toggle behavior. But tenants have different needs:

- **Jay (Denver Exotics)**: Always charges $20, wants the toggle defaulted ON
- **Another tenant**: Might charge $35, or $0, or not want the feature at all
- **Another**: Wants it off by default but available to turn on per-booking

## Proposed Logic

Add three tenant-level settings to Team Settings (Pricing section):

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `gasFeeEnabled` | boolean | `true` | Master switch — hides the gas fee line item entirely when off |
| `gasFeeAmount` | string (number) | `"20"` | The dollar amount charged when enabled |
| `gasFeeDefaultOn` | boolean | `true` | Whether new bookings start with gas fee active or waived |

### Behavior Matrix

```text
gasFeeEnabled=false  → Gas fee line hidden everywhere. No fee charged.
gasFeeEnabled=true, gasFeeDefaultOn=true  → Toggle shown, ON by default (Jay's flow)
gasFeeEnabled=true, gasFeeDefaultOn=false → Toggle shown, OFF by default (opt-in per booking)
```

## Changes

### 1. TeamSettingsSection.tsx — Add gas fee config to Pricing card

Extend the `TeamSettings` interface with `gasFeeEnabled`, `gasFeeAmount`, `gasFeeDefaultOn`. Add UI controls in the existing "Pricing" card section (which already has `minRate`):
- Switch: "Enable Gas/Re-fueling Fee"
- Input: "Gas Fee Amount ($)" — only shown when enabled
- Switch: "Default to ON for new bookings" — only shown when enabled

### 2. New hook: `useTeamGasFeeSettings.ts`

A small hook that reads the team settings for the gas fee config and returns resolved values:
- `gasFeeEnabled: boolean`
- `gasFeeAmount: number`
- `gasFeeDefaultOn: boolean`
- `isLoading: boolean`

This hook reads from the same `user_settings` table (category: 'team') so no DB migration needed.

### 3. pricingUtils.ts — Make DEFAULT_GAS_FEE a fallback only

Keep `DEFAULT_GAS_FEE` as the fallback constant but add an exported helper:
- `getGasFeeForTeam(teamGasFeeAmount?: number): number` — returns team amount or falls back to 20

### 4. Update booking dialogs to use team settings

**NewBookingDialog.tsx**: 
- Use `useTeamGasFeeSettings()` to get the tenant's gas fee config
- If `gasFeeEnabled=false`, hide the toggle and set `gasFee=0`
- If enabled, use `gasFeeAmount` instead of `DEFAULT_GAS_FEE`, and init `gasFeeWaived` from `!gasFeeDefaultOn`

**EditBookingDialog.tsx**: 
- Use team settings for the fee amount display
- If `gasFeeEnabled=false`, hide the gas fee line entirely

**RecordPaymentDialog.tsx**: 
- Same pattern — read team config, conditionally show/hide gas line

**EnhancedBookingDialog.tsx**: 
- Same pattern for the read-only financial summary

### 5. No database migration needed

The `user_settings` table already stores arbitrary JSON per category. The new fields are just added to the `team` category settings JSON. The `bookings.gas_fee` column already stores the per-booking amount, so historical bookings retain their original fee regardless of later setting changes.

## Summary

- **1 new file**: `useTeamGasFeeSettings.ts` hook
- **5 files modified**: `TeamSettingsSection.tsx`, `pricingUtils.ts`, `NewBookingDialog.tsx`, `EditBookingDialog.tsx`, `RecordPaymentDialog.tsx`, `EnhancedBookingDialog.tsx`
- **0 migrations**: Uses existing `user_settings` JSON storage
- **Backward compatible**: Existing bookings keep their stored `gas_fee` value; new defaults only apply to new bookings


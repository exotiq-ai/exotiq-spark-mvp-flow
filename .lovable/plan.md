## Goal

Surface the Margin module in the sidebar. It is already coded into the **Intelligence** group directly under **Vault**, gated to **Manager and above** — only the feature flag is hiding it.

## Change

1. **`src/lib/featureFlags.ts`** — flip `margin: false` → `margin: true`.

That's the entire change. No edits to the sidebar are needed:
- Placement is already correct (`DashboardSidebarEnhanced.tsx:204`): Intelligence group, immediately after Vault, `DollarSign` icon.
- Role gate stays `minRole: 'manager'` (Managers, Admins, Owners). Operators and Viewers won't see it.
- The module route already resolves (why the direct URL works), so enabling the flag only adds the visible nav entry.

## Verification

- Load `/dashboard` as a Manager+ account → confirm "Margin" appears under Vault in the Intelligence group and navigates correctly.
- Confirm an Operator/Viewer account does **not** see the tab.

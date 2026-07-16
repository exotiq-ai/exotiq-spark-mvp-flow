## Goal

Give super admins a no-SQL way to flip `teams.marketplace_visible` and `vehicles.marketplace_visible`, and turn marketplace on for `hello@exotiq.ai` so end-to-end M3 features can be exercised.

## Deliverables

### 1. Data: enable marketplace for Exotiq team
The Exotiq team (`hello@exotiq.ai`) currently has `is_demo_account = true` and `marketplace_visible = false`. The `is_marketplace_team()` gate requires `is_demo_account = false`, so both flags must change for the team to appear on the public marketplace. Seed via an `insert` tool call:
- `teams.marketplace_visible = true`
- `teams.is_demo_account = false`
- `teams.public_description` = short default blurb (only if null)
- Flip every non-archived, non-trashed vehicle on that team to `marketplace_visible = true` so there is real fleet content to test.

### 2. New Super Admin tab: "Marketplace"
Add a tab to `src/pages/SuperAdminDashboard.tsx` alongside the existing ones (Tenant Health, Vehicles, Billing, etc.), backed by a new component `src/components/super-admin/MarketplaceVisibilityTab.tsx`.

Layout:
```text
Marketplace Visibility
┌─ Teams ────────────────────────────────────────┐
│ [search box: team name / owner email]          │
│                                                │
│ Team           Owner            Demo   Visible │
│ Exotiq         hello@exotiq.ai  [off]  [ ON  ] │
│ Acme Rentals   jane@acme.com    [off]  [ off ] │
│ ...                                            │
└────────────────────────────────────────────────┘

Click a team row → expands to a vehicle list:
┌─ Exotiq · Fleet (12) ──────────────────────────┐
│ [Show all] [Only visible]                      │
│                                                │
│ Vehicle              Status     Visible        │
│ 2011 BMW M3          available  [ ON  ]        │
│ 2020 Porsche 911     booked     [ off ]        │
│ ...                                            │
│                                                │
│ [Enable all] [Disable all]                     │
└────────────────────────────────────────────────┘
```

Behaviour:
- Team `Visible` switch toggles `teams.marketplace_visible`. If the team is still `is_demo_account = true`, show an inline warning ("Team is marked as demo — it will not appear on the public marketplace") with a secondary "Mark as production" button that sets `is_demo_account = false`.
- Vehicle `Visible` switch toggles `vehicles.marketplace_visible`. Disabled with a tooltip if the parent team is not marketplace-visible or is archived/trashed.
- Bulk "Enable all / Disable all" applies to the currently filtered vehicle list for that team.
- All toggles are optimistic with TanStack Query invalidation, error toast on failure.
- Every mutation calls `log_admin_action('toggle_marketplace_team' | 'toggle_marketplace_vehicle', target_user_id, { team_id, vehicle_id, value })` so it lands in `admin_audit_log`.

### 3. Access control
No new RLS work required — the existing super admin bypass policies already let super admins `UPDATE` `teams` and `vehicles`. The tab is only reachable through `SuperAdminGuard`, so no additional UI-side gating is needed beyond the existing route protection.

## Technical notes

- Queries: single `select id, name, marketplace_visible, is_demo_account, public_description, owner_id` on `teams` (filter out `deleted_at is not null`), and a lazy `select id, year, make, model, marketplace_visible, status, archived_at, trashed_at` on `vehicles` scoped by `team_id` when a team row is expanded.
- Owner email resolved via existing `profiles` join pattern used elsewhere in Super Admin (avoid touching `auth.users` directly from the client).
- Use shadcn `Switch`, `Input`, `Collapsible`, `Badge`, and `Tooltip` — no new dependencies.
- Audit log RPC: reuse existing `log_admin_action` function; wrap in a helper `logAdminAction()` local to the tab.
- Add a lightweight `useMarketplaceAdmin` hook (in the same file) that owns the two mutations to keep the component tidy.

## Out of scope

- No RLS or migration changes.
- No public marketplace UI changes — this is admin plumbing only.
- No new permission types on `super_admins.permissions`; existing super admin access is sufficient.

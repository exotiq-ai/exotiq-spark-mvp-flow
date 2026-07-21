# Plan: Hybrid Marketplace Request & Approval Flow

## Goal
Let tenants request to be listed on the Drive Exotiq marketplace while keeping final approval as a Super Admin action. Today marketplace visibility is Super Admin-only (`teams.marketplace_visible`). This plan adds a request layer so tenants can opt in, admins can review, and visibility is only effective after approval.

## Current state
- `teams.marketplace_visible` boolean is toggled only in `SuperAdminDashboard → Marketplace` (`MarketplaceVisibilityTab`).
- Tenant Settings has no marketplace section.
- `featureFlags.marketplaceGateEnforced` exists as a future kill-switch.
- Audit logging uses `log_admin_action` RPC.

## Proposed changes

### 1. Database schema (migration)
Add to `public.teams`:
- `marketplace_request_status` text with constraint to `none | requested | approved | rejected` (default `none`).
- `marketplace_requested_at` timestamptz (nullable).
- `marketplace_reviewed_at` timestamptz (nullable).
- `marketplace_reviewed_by` uuid (nullable, references auth.users id loosely — no FK to auth schema).
- `marketplace_rejection_reason` text (nullable).

GRANT `SELECT` on `teams` to authenticated (already present in some form; verify exact grants). Add explicit `UPDATE` policy split:
- Team owners/admins can update `marketplace_request_status` to `requested` only.
- Super admins can update `marketplace_request_status` to `approved`/`rejected`, plus `marketplace_visible`, `marketplace_reviewed_at`, `marketplace_reviewed_by`, `marketplace_rejection_reason`.
- Use `is_team_owner` / `is_team_member_of_record` / super-admin check functions already in the project.

### 2. Effective visibility rule
A team/vehicle is publicly marketplace-visible only when:
- `teams.marketplace_visible = true` AND
- `teams.marketplace_request_status = 'approved'` AND
- `teams.is_demo_account = false` AND
- vehicle-level `marketplace_visible = true`.

Update `rent-public-media` / any marketplace edge function to enforce this combined rule. Update `is_marketplace_team` / `is_marketplace_vehicle` RPCs if they exist to include the `approved` check.

### 3. Tenant UI (Settings → Business)
Add a new "Marketplace listing" card inside `BusinessProfileSection` (or a new `MarketplaceSettingsSection` if the file becomes too large). Visible to owners/admins only.

States shown:
- `none` / `rejected`: explainer text + "Request marketplace listing" button.
- `requested`: pending badge + "Request submitted" + timestamp + optional cancel button.
- `approved`: badge + "Live on marketplace" if `marketplace_visible = true`; otherwise "Approved, waiting for admin activation".

On request, set `marketplace_request_status = 'requested'` and `marketplace_requested_at = now()`. Show toast confirmation. Do not allow editing other fields in this card.

### 4. Super Admin UI updates
In `MarketplaceVisibilityTab`:
- Add a "Requests" filter/pill showing teams with `marketplace_request_status = 'requested'`.
- Show status badges per team: `requested`, `approved`, `rejected`, `not requested`.
- Approve action: sets `marketplace_request_status = 'approved'`, `marketplace_reviewed_at = now()`, `marketplace_reviewed_by = auth.uid()`, and optionally flips `marketplace_visible = true`.
- Reject action: sets `marketplace_request_status = 'rejected'`, prompts for optional reason, stores in `marketplace_rejection_reason`.
- Keep the existing `marketplace_visible` switch, but disable it for teams whose status is not `approved` with tooltip.
- Audit all approve/reject actions via `log_admin_action`.

### 5. Notifications
- When a tenant submits a request, create bell notifications for all active super admins (or use an existing admin notification channel) with deep link to `SuperAdminDashboard → Marketplace`.
- When admin approves/rejects, create a team-level notification for the team owner (optional, nice-to-have).

### 6. Feature flag
Keep `marketplaceGateEnforced` false for now. When the team is ready to enforce it, flipping the flag can hide the marketplace request UI from non-approved plans or block new requests.

## Out of scope
- No changes to `rent-public-media` response shape (only internal filtering).
- No new billing/plan gating in this plan (can be layered on later via `marketplaceGateEnforced`).
- No vehicle-level request flow; vehicles still inherit team approval and are toggled by Super Admin or by a follow-up vehicle-level tenant flow.

## Verification
- Tenant sees request button in Settings → Business.
- Submitting request sets status to `requested` and shows pending.
- Super Admin sees request in Marketplace tab, can approve/reject.
- After approval + `marketplace_visible = true`, `is_marketplace_team` returns true; anon `rent-public-media` returns the team/vehicle data.
- Rejected team sees rejection reason in tenant UI.
- Audit rows exist in `log_admin_action` for approve/reject and tenant request.
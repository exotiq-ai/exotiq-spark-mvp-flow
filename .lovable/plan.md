# Maintenance Mode Overlay + Super Admin Controls

## Goal

When the app (or a specific tenant) is taken down for an upgrade, affected users see a branded "we'll be back shortly" screen instead of a 404 or broken dashboard, and can leave their email to be notified when service is restored. Super admins control everything from the Super Admin dashboard — no code deploy required.

## Scope of overlay

Only shown on **authenticated app surface**:
- `/dashboard/*`
- `/onboarding`, `/team-onboarding`
- `/auth` (sign-in/sign-up)

Public marketing + legal routes (`/`, `/welcome`, `/terms`, `/privacy`, `/acceptable-use`, `/data-processing`) and `/reset` / `/signout` stay live so SEO, legal, and recovery flows always work.

Super admins always bypass the overlay (they need to flip it back off).

## Trigger sources (priority order)

1. **Global maintenance** — affects every tenant.
2. **Per-tenant maintenance** — affects only users whose `team_id` is in the list.
3. Env fallback `VITE_MAINTENANCE_MODE=true` for true infra outages where DB is unreachable.

All three live in one new table read once at app boot, cached, and refreshed every 60s via realtime subscription so toggling from the super admin UI takes effect within seconds for live sessions.

## Database

New table `maintenance_windows`:
- `id`, `scope` (`global` | `tenant`), `team_id` (nullable, required when scope=`tenant`), `is_active` (bool), `message` (nullable, overrides default copy), `eta` (nullable text, e.g. "approx 30 minutes"), `started_at`, `ended_at` (nullable), `created_by`.
- Index on `(is_active, scope)` and `(is_active, team_id)`.
- RLS: `SELECT` allowed to `authenticated` (everyone needs to know if they're locked out); `INSERT/UPDATE/DELETE` restricted to super admins via existing `is_super_admin()` check.

New table `maintenance_notify_subscribers`:
- `id`, `email`, `team_id` (nullable — for tenant-scoped windows), `window_id` (fk to `maintenance_windows`), `created_at`, `notified_at` (nullable).
- RLS: `INSERT` to `anon` + `authenticated`; `SELECT/UPDATE` only to `service_role`.
- Standard `GRANT` block per project conventions.

## UI: tenant-facing overlay

New `src/components/common/MaintenanceOverlay.tsx`:
- Full-viewport, `z-[200]`, backdrop blur, centered card. No nav, no dismiss.
- White-labelled `Logo` (respects team branding per `mem://style/branding`).
- Headline: "We're upgrading to serve your business better."
- Body: "We apologise for the short downtime. Our team is rolling out improvements and we'll be back shortly. Leave your email and we'll let you know the moment service is restored."
- Optional ETA line if `window.eta` is set.
- Email input + "Notify me" button → inserts into `maintenance_notify_subscribers` with the active `window_id`. On insert failure (DB itself down) falls back to a `mailto:support@exotiq.ai` link so the user is never stuck.
- Confirmation state after submit: "Thanks — we'll email {address} as soon as we're back."
- Minimalist styling, semantic tokens only.

Mounted once inside `AppContent` in `src/App.tsx`, inside `ProvidersWrapper` so it can read `AuthContext` + `TeamContext`. Returns `null` when:
- Route is not in the authenticated set above, OR
- User is super admin, OR
- No active window matches (global OR user's `team_id`).

## UI: Super Admin controls

New section on `src/pages/SuperAdminDashboard.tsx` — "Maintenance Mode":

**Global toggle card**
- Big switch: "Global maintenance mode" (off by default).
- When toggled on: confirm dialog ("This will lock every tenant out of the app. Continue?"), then text fields for optional custom `message` and `eta`, then "Activate."
- When on: shows banner with started_at, custom message, and an "End maintenance" button that flips `is_active=false`, stamps `ended_at`, and triggers the notify-restored edge function.

**Per-tenant card**
- Search/select team (reuses existing super-admin team picker pattern).
- List of currently active tenant windows with team name, message, eta, started_at, and "End" button.
- "Add tenant window" → team picker + optional message/eta → inserts row with `scope='tenant'`.
- Same end-flow as global, scoped to that team.

**Subscriber visibility**
- Small expandable list per active window showing how many addresses are queued for notification (count only, no PII unless expanded — owner-only per Core RBAC).

## Restore notification

New edge function `maintenance-notify-restored`:
- Called automatically when a window's `is_active` flips to false (via DB trigger → `pg_notify` → function, or directly from the Super Admin "End maintenance" button — simplest: button calls it explicitly after the update).
- Looks up `maintenance_notify_subscribers` where `window_id = $1 AND notified_at IS NULL`.
- Enqueues a "We're back" email per address via the existing `send-transactional-email` queue.
- Stamps `notified_at = now()` on each row.
- Service-role-only; validates caller via super admin JWT claim.

## Live propagation

`MaintenanceOverlay` subscribes to `postgres_changes` on `maintenance_windows` so the lockout appears within ~1s of the super admin flipping the switch, and disappears the moment it's turned off.

## Files

- `src/components/common/MaintenanceOverlay.tsx` (new)
- `src/components/super-admin/MaintenanceModeSection.tsx` (new)
- `src/hooks/useMaintenanceWindow.ts` (new — resolves active window for current user + subscribes to changes)
- `src/App.tsx` (mount overlay inside `ProvidersWrapper`)
- `src/pages/SuperAdminDashboard.tsx` (mount new section)
- `src/lib/featureFlags.ts` (env fallback only — no flag for the feature itself, since it's controlled from the UI)
- Migration: `maintenance_windows` + `maintenance_notify_subscribers` with grants, RLS, indexes
- `supabase/functions/maintenance-notify-restored/index.ts` (new)

## Out of scope

- Scheduled future maintenance windows (only "active now" toggle).
- SMS notifications.
- Per-feature/per-route maintenance (it's all-or-nothing for the affected scope).

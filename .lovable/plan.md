# Super Admin: Tenant Health & Vehicle Audit

## Trust posture
Aggregates + business-account contact info = OK. Renter PII, messages, photos, payment instruments = never. Every RPC writes to `role_audit_log`.

## Decisions locked in
1. **Seat cap source of truth:** `teams.assumed_plan_fleet_size` (with `assumed_plan_tier` for label).
2. **Actions:** read-only. No "Force notify owner" button in v1 — outreach stays a human decision via copy-to-clipboard summary. We can revisit once we see real overage volume.
3. **Owner email:** include it. Rationale — it's the *business* contact (not a renter), we already have it via auth/Stripe, and support work (overage outreach, troubleshooting, billing) genuinely needs it. Guardrails:
   - Show owner name + email only inside the **Tenant Detail drawer**, never in the list/table rows.
   - Drawer open writes `role_audit_log` with `p_action='open_tenant_detail'` + `team_id`.
   - List/table rows show team name + city only.
   - Still excluded everywhere: renter names/emails, message content, photos, payment instruments.

## What we're building

### 1. Platform Pulse strip (replaces top 4 stat cards)
- Active rentals now
- Trials ending in 7 days (click → filtered Tenant Health)
- Accounts over plan (count + $ est. monthly leakage)
- Stuck onboarding (>3d idle)
- Failed payments 7d
- Platform 7d revenue (sparkline)

### 2. Tenant Health tab (new)
Searchable list, one row per team. Columns: Team · City · Plan · Vehicles · 30d util % · Active rentals · 30d revenue · Last login · Risk flags.

Risk flag chips: `Trial <7d`, `No Stripe`, `No payment 30d`, `Over plan`, `Stuck onboarding`, `Demo`.

Click row → **Tenant Detail drawer**:
- Header: team name, city, plan tier, owner name + email (audit-logged on open)
- Fleet: total / active / maintenance / retired / missing hero photo
- Utilization: 7d, 30d, vehicles idle 30d
- Bookings: active now, pending, week-over-week trend
- Revenue: 30d gross, MRR estimate, last payment date
- Activity: last login, active users 7d, onboarding %
- Buttons: "Copy support summary" (clipboard), "View in Billing tab"

### 3. Vehicle Audit tab (new) — seat compliance
Top summary: total seats sold vs in use, total est. monthly leakage $.

Table: Team · Plan tier · Fleet size (cap) · Vehicles in use · Overage · Est. monthly leakage · Last reviewed.
- Sort by overage desc; filters: Over plan / Trial / Unconverted.
- Row actions: **Mark reviewed** (audit-logged), **Copy outreach summary** (clipboard text).
- "Vehicles in use" = `count(vehicles where status != 'retired' and trashed_at is null)`.
- Leakage math (placeholder until pricing confirmed): `overage × per-seat rate from plan tier`. We'll tune the per-seat rate constant after first review.

## Out of scope (v1)
- Force-notify / outbound email from super admin.
- Realtime subscriptions; periodic refresh only.
- Renter PII reveal, message/photo viewing.
- Saved filters, CSV export (easy follow-up).

## Technical notes

**Migration (new RPCs, all `SECURITY DEFINER` + `is_super_admin()` gated, all log to `role_audit_log`):**
- `get_super_admin_platform_pulse()` → single row of platform aggregates.
- `get_super_admin_tenant_health()` → one row per team with list-view fields only (no owner email).
- `get_super_admin_tenant_detail(p_team_id uuid)` → drawer payload incl. owner email + name, logs `open_tenant_detail` with team_id.
- `get_super_admin_vehicle_audit()` → seat overage table.
- `mark_tenant_seat_review(p_team_id uuid, p_note text)` → writes `role_audit_log` entry, stores `reviewed_at` (new column on `teams`: `seat_audit_reviewed_at timestamptz`).

Allowlist guard: each function's SELECT list is reviewed to ensure no renter/message/photo columns leak.

**Schema add (single small migration):**
- `teams.seat_audit_reviewed_at timestamptz` (nullable). Used by Vehicle Audit "Last reviewed" + Mark reviewed.

**Frontend:**
- `src/pages/SuperAdminDashboard.tsx` — swap 4-card grid for `<PlatformPulseStrip />`, add two new tabs between Customers and Billing.
- New: `src/components/super-admin/PlatformPulseStrip.tsx`
- New: `src/components/super-admin/TenantHealthTab.tsx` (+ `TenantDetailDrawer.tsx`)
- New: `src/components/super-admin/VehicleAuditTab.tsx`
- Reuse existing shadcn primitives. No new deps.

## Files touched
- `supabase/migrations/<new>.sql` — 5 RPCs + `seat_audit_reviewed_at` column.
- `src/pages/SuperAdminDashboard.tsx`
- 4 new components under `src/components/super-admin/`

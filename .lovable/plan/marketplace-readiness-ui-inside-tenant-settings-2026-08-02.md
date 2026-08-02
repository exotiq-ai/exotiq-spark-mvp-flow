# Marketplace readiness UI inside tenant Settings

## Goal
Give team owners/admins a self-service view of why their team is (or is not) visible on the public marketplace, with clear, actionable next steps to fix each missing requirement. The Super Admin toggle remains the only place to flip `teams.marketplace_visible`; tenant UI is read-only plus "Request review".

## Current state
- A readiness checklist already exists in **Super Admin > Marketplace Visibility** (`src/components/super-admin/MarketplaceReadinessPanel.tsx`). It calls `get_marketplace_readiness(team_id)` and shows green/red checks for Stripe, profile, terms, vehicles, and platform fee.
- The checklist is hidden from tenants. Tenants only see Business profile, Payments (Stripe Connect), and Legal settings. They have no unified view connecting these pieces to marketplace go-live.
- Settings already has 10 tabs: Account, Team, Business, Locations, Notifications, Billing, Integrations, Data, Payments, Legal.

## Recommendation
**Ship a dedicated "Marketplace" tab** in tenant Settings, visible only to Owner/Admin. It surfaces the same checklist, removes the Super Admin-only "Test mode" control, and adds deep-link CTAs to the exact place where each failing item can be fixed. This is the clearest path because the go-live concept is distinct from Business profile, Payments, or Legal.

### Alternative considered (pushback)
Embedding the panel as a card inside the **Business** tab is lower-risk and avoids adding an 11th tab. However, Business tab is already dense (name, currency, tax, address, support email). The marketplace readiness concept spans Payments, Legal, and Vehicles too, so it would feel buried and require duplicate CTAs. A dedicated tab is cleaner for a first-class go-live feature.

## What we will build

### 1. New Settings tab: "Marketplace"
- Add `marketplace` to `allSettingsTabs` in `src/components/dashboard/settings/SettingsLayout.tsx`, gated to Owner/Admin only.
- Use a storefront icon (e.g. `Store` from `lucide-react`).
- Position it after **Payments** so the money-to-marketplace flow is logical.

### 2. Tenant-facing marketplace panel
- Create `src/components/dashboard/settings/MarketplaceSection.tsx`.
- Reuse `get_marketplace_readiness` via a shared hook (extract from `MarketplaceReadinessPanel.tsx` into `src/hooks/useMarketplaceReadiness.ts`).
- Display:
  - Overall status: **Live on marketplace** / **Not yet visible** / **Ready for review**.
  - Per-item checklist with pass/fail icons and the same labels as Super Admin.
  - Platform fee confirmation date and percentage (read-only for tenant).
  - Publish-ready vehicle count and total vehicle count.
- Include **no Super Admin test-mode toggle** and **no visibility switch**.

### 3. Actionable CTAs on every failing item
Each red check links to the right place:
- Stripe charges/payouts → `/dashboard/settings?tab=payments`.
- Business name, logo, address → `/dashboard/settings?tab=business`.
- Terms not accepted → `/dashboard/settings?tab=legal` (or open the Terms dialog if one exists).
- No publish-ready vehicles → `/dashboard/fleet`.
- Platform fee not confirmed → show a help card explaining the 10% marketplace fee and a **Request review** button (this is an admin action, so the CTA opens an email/intercom or writes to a new `marketplace_requests` table).

### 4. "Request marketplace review" flow
- Add a primary button in the panel when the team is ready but not yet visible: **"Request marketplace review"**.
- This writes a row to a new `marketplace_requests` table (or reuses `entity_comments` / `role_audit_log` if simpler) with `team_id`, `requested_by`, `requested_at`, and `status` (pending/approved/rejected).
- Super Admin sees pending requests in the Marketplace Visibility tab as a badge or filter, so the review queue is actionable.
- If the team is already live, the button is replaced with **"Open public storefront"** linking to `/{team_slug}`.

### 5. Vehicle readiness drill-down
- Expandable section listing vehicles with their per-vehicle checks (photos, rate, location, status).
- Each vehicle row deep-links to the vehicle detail/edit page.
- Red/green per-check icons help the owner understand which cars can be published.

### 6. Responsive and mobile-safe
- Use the same card/panel style as other settings sections.
- Vehicle drill-down is vertically scrollable and uses the existing grid/list patterns.
- No horizontal overflow on mobile; CTAs stack vertically.

### 7. Security and role gates
- Route-level: tab only appears for Owner/Admin (reuse `useUserRole`).
- API-level: `get_marketplace_readiness` is already `SECURITY DEFINER` and team-scoped; tenants can only call it for their own `team_id` because it reads from `teams` and RLS policies enforce access.
- No new mutation permissions are granted to tenants for `marketplace_visible` or `marketplace_test_mode`.
- "Request review" writes to a new table with RLS scoped to `team_id` and Super Admin reads.

### 8. Copy standards
- Use non-technical language: "Your public storefront" instead of "marketplace_visible".
- "Go-live checklist" instead of "readiness".
- Tooltips explain why each item matters (e.g. "Stripe payouts are required before we can release rental income to your bank account").

## Schema additions

```sql
-- Tenant-initiated marketplace review requests
CREATE TABLE public.marketplace_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requested_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_requests TO authenticated;
GRANT ALL ON public.marketplace_requests TO service_role;

ALTER TABLE public.marketplace_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view own requests" ON public.marketplace_requests
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = marketplace_requests.team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can create requests" ON public.marketplace_requests
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = marketplace_requests.team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Super admins can manage requests" ON public.marketplace_requests
    FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER marketplace_requests_updated_at
    BEFORE UPDATE ON public.marketplace_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

If `public.is_super_admin(auth.uid())` does not exist, use the existing Super Admin check pattern (e.g. `super_admins` table).

## Files to change
- `src/components/dashboard/settings/SettingsLayout.tsx` — add Marketplace tab.
- `src/components/dashboard/settings/MarketplaceSection.tsx` — new tenant-facing panel.
- `src/hooks/useMarketplaceReadiness.ts` — extract shared hook from `MarketplaceReadinessPanel.tsx`.
- `src/components/super-admin/MarketplaceReadinessPanel.tsx` — refactor to use the shared hook.
- `src/components/super-admin/MarketplaceVisibilityTab.tsx` — add pending-request badge/filter.
- `src/components/super-admin/SuperAdminDashboard.tsx` — add badge to Marketplace tab if requests pending.
- New migration: `supabase/migrations/20260802040000_marketplace_requests.sql` (table above).

## Verification
- Owner/Admin sees the Marketplace tab; Manager/Operator/Viewer do not.
- The checklist loads for the current team and matches the Super Admin view (minus test mode).
- Clicking each CTA lands on the correct settings tab or module.
- "Request review" inserts a row and appears in the Super Admin queue.
- No tenant can flip `marketplace_visible` from the tenant UI.
- Mobile/tablet: panel is readable, no clipped CTAs, drill-down scrolls vertically.
- Type-check and existing tests pass.

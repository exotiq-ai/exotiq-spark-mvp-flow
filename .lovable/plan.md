## Command Center — Deposit Hold Configuration (P2 UI)

Backend is live: `teams.default_deposit_cents`, `vehicles.deposit_override_cents`, and `resolve_deposit_cents(vehicle_id)` RPC are all confirmed. This work is UI-only in SPARK, plus swapping the hold path to use the RPC. No migrations.

### 1. Tenant default — Team Settings

File: `src/components/dashboard/TeamSettingsSection.tsx` (the "Pricing" card that already holds Minimum Rate + Gas Fee).

- Add a **Security Deposit** subsection under Pricing (below Gas Fee), with `ShieldCheck` icon.
- New field: **"Default deposit hold amount"** — currency input in dollars, tenant currency label via `useMoney()`.
- Persist directly to `teams.default_deposit_cents` (× 100 on save, ÷ 100 on load). Not via `user_settings` — this is a team-scoped policy, not per-user.
  - Load: read `currentTeam.default_deposit_cents` from `TeamContext`.
  - Save: `supabase.from('teams').update({ default_deposit_cents }).eq('id', currentTeam.id)` then refresh team context.
- Helper text: "Manual-capture hold placed at pickup. Overridable per vehicle. Leave blank for no default (defaults to $1,000)."
- Validate: non-negative integer; block save if negative. Empty = null.
- Gate write with `PermissionGuard minRole="admin"` (deposit policy is admin-level, matching payment settings).

### 2. Per-vehicle override — Rate Card

File: `src/components/dashboard/RateTiersPanel.tsx` (rate tier table).

- Add a **5th editable column** "Deposit Hold" after Multi-Day, before the actions column.
  - Display: `formatRate(deposit_override_cents / 100)` when set; otherwise render muted "Default ($X)" using the resolved team default.
  - Edit: currency input, empty = clear override (null), value = override in dollars.
- Extend `VehicleRates` interface with `deposit_override_cents: number | null`; extend `EditingRates` with `deposit_override: string`.
- Save path: include `deposit_override_cents: editingRates.deposit_override ? Math.round(parseFloat(...) * 100) : null` in the `updateVehicle` payload. `useLocationFilteredFleet.updateVehicle` already forwards arbitrary columns.
- Validate: non-negative; no min-rate coupling (deposits are unrelated to rental min).
- Update the info Alert copy to mention deposit override behavior.

### 3. Swap hold path to `resolve_deposit_cents`

Search results confirm the RPC is only referenced by docs today. Find every place SPARK computes/reads a deposit amount for a booking (likely `NewBookingDialog`, `EnhancedBookingDialog`, any check-in / hold-placement path) and replace hardcoded values with:

```ts
const { data: depositCents } = await supabase.rpc('resolve_deposit_cents', { _vehicle_id: vehicleId });
```

Scope of this step during build: grep for `deposit` in `src/` + `supabase/functions/` first, list the call sites, and swap each to the RPC. If a site is renter-app-only (e.g. `rent-checkout`), leave it — that's Claude's repo.

### 4. Types

`src/integrations/supabase/types.ts` already includes `default_deposit_cents`, `deposit_override_cents`, and `resolve_deposit_cents` — no regen needed.

### 5. Verify

- Set tenant default in Team Settings → confirm `teams.default_deposit_cents` updated via `supabase--read_query`.
- Set an override on one vehicle in Rate Tiers → confirm `vehicles.deposit_override_cents` updated.
- Call `select public.resolve_deposit_cents('<that-vehicle-id>')` → returns override; clear override → returns team default; clear both → returns null (caller falls back to $1,000).
- Typecheck.

### Out of scope (handed off, not in this plan)

- Renter app checkout / hold placement lives in `exotiq-rent`.
- P3 email-link money battery — separate pass after this lands.
- Insurance spec + SPARK edge-function commit chore — flagged, not part of this UI work.

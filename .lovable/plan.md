## Plan: marketplace test bypass + Exotiq go-live checklist

Doing both in parallel. Option 1 gets us clicking through the marketplace today; Option 2 makes Exotiq a real, passing-the-checklist tenant so the bypass isn't load-bearing.

### Part A — Super-admin test-mode bypass (Option 1)

**1. Migration**
- `ALTER TABLE public.teams ADD COLUMN marketplace_test_mode boolean NOT NULL DEFAULT false;`
- Update `public.get_marketplace_readiness(p_team_id)`:
  - Report every check honestly (no lying about photos/Stripe).
  - Add `test_mode: <bool>` to the returned payload.
  - If `test_mode` is true, set top-level `ready: true` at the end.
- Update the `enforce_marketplace_readiness` trigger to `RETURN NEW` early when `teams.marketplace_test_mode = true`, so writes that would otherwise be blocked when the gate is enforced still succeed for the test team.
- New RPC `public.set_marketplace_test_mode(p_team_id uuid, p_enabled boolean)` — `SECURITY DEFINER`, checks `is_super_admin(auth.uid())`, writes the flag, and logs to `admin_action_log` via `log_admin_action` so we have an audit trail.

**2. Super Admin UI**
- `src/components/super-admin/MarketplaceVisibilityTab.tsx`: add a "Test mode" toggle in the expanded team row, super-admin only.
- `src/components/super-admin/MarketplaceReadinessPanel.tsx`: when `test_mode` is true, render an amber "Bypass active — checklist ignored" banner above the checklist. Checks still render red/green so we can see the real state.

**3. Enable on Exotiq**
- Flip `marketplace_test_mode = true` for team `Exotiq` (id `c1de6533-…`). Leave every other team off.

### Part B — Finish Exotiq's real checklist (Option 2)

Track this so we can retire the bypass ASAP.

**1. Logo + business address** (no code)
- Sign into `hello@exotiq.ai`, go to Settings → Business Profile, upload the D Exotiq logo and fill in the business address. `logo_set` and `business_address_set` flip green immediately.

**2. Stripe Connect onboarding** (no code)
- The Connect account `acct_1TcPJy…` already exists on Exotiq. Resume onboarding from Settings → Payments; complete identity, bank details, and ToS. Once Stripe fires the account.updated webhook, `stripe_charges_enabled` / `stripe_payouts_enabled` flip to true automatically (existing webhook handler already writes these).

**3. Photos — 5 hero test vehicles** (no code, done through the app)
- Pick 5 marquee cars (e.g., Aston Martin Valkyrie, Bugatti Chiron Sport, Ferrari 296 GTB, Bentley Mulliner Batur, Rolls-Royce Cullinan) and upload the missing photos through the Photo Hub so each has ≥5 visible rows. Real content, no data hacks.
- With those five ready and `test_mode` still on, we can turn `test_mode` off and confirm the real gate lets Exotiq through.

### Guardrails

- `marketplace_test_mode` defaults to false everywhere, requires super-admin to flip, and is audited on every change.
- The readiness panel keeps showing red where things are actually broken, so it's obvious the bypass is doing the lifting.
- No changes to public marketplace RPCs, no lowered thresholds, no impact on any other tenant (Saucy included).

### Order of operations

1. Ship the migration + UI toggle.
2. Flip `marketplace_test_mode` on for Exotiq → click through the marketplace end-to-end.
3. In parallel, knock out logo, address, Stripe, and the 5 hero-vehicle photo sets.
4. When the real checklist passes, flip `marketplace_test_mode` back off and confirm nothing regresses.

Ready to implement Part A on approval. Part B is your click-through work in the tenant UI, and I'll help with any snags as they come up.

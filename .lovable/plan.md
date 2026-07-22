## Goal
Repoint the Exotiq tenant to the fully-onboarded Stripe Connect account (`acct_1TvnfgQfNJmCrgjR` — Exotiq Inc, charges + payouts enabled) so the marketplace readiness check clears its Stripe blocker.

## Current state (verified last turn)
- Exotiq team row `c1de6533-ab44-4973-a123-007a8007b5ba` currently points to `acct_1TcPJyQchd6jAAl0` (unfinished Express sub-account).
- `acct_1TvnfgQfNJmCrgjR` is fully live: `details_submitted=true`, `charges_enabled=true`, `payouts_enabled=true`, bank verified, branding set.
- The orphan `acct_1TcPJyQchd6jAAl0` is harmless and can be left alone (or rejected later).

## Plan

1. **Repoint Exotiq's Stripe pointer in the DB** (insert tool, single UPDATE):
   - `stripe_account_id = 'acct_1TvnfgQfNJmCrgjR'`
   - `stripe_charges_enabled = true`
   - `stripe_payouts_enabled = true`
   - `stripe_onboarding_complete = true`
   - Scoped to `teams.id = 'c1de6533-ab44-4973-a123-007a8007b5ba'`.

2. **Re-verify against Stripe** — call the Stripe API for `acct_1TvnfgQfNJmCrgjR` to reconfirm the three flags right before the DB write, so we're not caching stale state.

3. **Refresh marketplace readiness for Exotiq**:
   - Read back the team row to confirm the three Stripe fields are correct.
   - Call `get_marketplace_readiness(p_team_id => c1de6533-…)` and report which checks now pass/fail. Stripe row should flip to green; `marketplace_test_mode` remains on so any remaining non-Stripe items (logo, business address, ready-vehicle count) don't block testing.

4. **Report back** with the new readiness snapshot so you know exactly what's green and what's still open before flipping `marketplace_test_mode` off.

## Not touching
- `acct_1TcPJyQchd6jAAl0` in Stripe (leave orphan alone; reject later at your convenience).
- Any migrations, edge functions, webhooks, or code.
- Saucy Rentals (already cleared).
- `marketplace_test_mode` on Exotiq (stays on).

## Risk
Very low. It's a single-row UPDATE on `teams`, gated to Exotiq's id, mirroring what the `stripe-webhook` would write automatically once Stripe fires a fresh `account.updated` for that account. If anything looks off in Step 2's Stripe re-check, we abort before writing.
## What's happening

When you toggled Fredo D'Lima's fleet, the readiness panel (right side of the Marketplace tab) failed to load with:

> `invalid input value for enum terms_acceptance_event: "accept"`

The toggle itself still worked ("On marketplace" pill lit up), but the readiness checks blew up.

## Root cause

`public.get_marketplace_readiness(team_id)` (migration `20260716040619_...`) checks whether the team owner has accepted terms with:

```sql
event_type IN ('accept','accepted','acceptance')
```

None of those values exist in the `terms_acceptance_event` enum. The real values are:

```
signup, reacceptance, terms_update, order_form, sms_opt_out
```

Postgres rejects the cast of `'accept'` to the enum and the whole RPC errors out — which is why the panel says "Failed to load readiness" for every team, not just Fredo's.

## Fix

Ship a small migration that replaces the RPC's terms check with the actual enum values that count as an acceptance:

```sql
event_type IN ('signup','reacceptance','terms_update','order_form')
```

(`sms_opt_out` is intentionally excluded — it's not a marketplace-terms acceptance.)

Everything else in `get_marketplace_readiness` stays as-is. No schema changes, no other RPC touched, no UI change.

## Verification

- Reload `/super-admin` → Marketplace tab. The red "Failed to load readiness…" banner is gone.
- Fredo D'Lima's Fleet readiness panel renders team checks + per-vehicle checks.
- Spot-check one other tenant (e.g. Exotiq) to confirm readiness loads for them too.

## Out of scope

- The hybrid marketplace request/approval flow (still queued from the previous plan) — this is a standalone bug fix.
- No change to how terms acceptance is recorded elsewhere.
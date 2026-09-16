# ARK marketplace readiness audit

## What I found

ARK's cars are fine. Nothing is wrong with the vehicle records — the block is at the account level.

Per-car checks (photos, daily rate, pickup location, status) for all 9 ARK vehicles:

| Vehicle | Photos | Rate | Location | Status | Car ready? |
|---|---|---|---|---|---|
| Lamborghini Urus | 9 | $600 | yes | available | yes |
| Lamborghini Huracan Sterrato | 11 | $1,500 | yes | available | yes |
| McLaren 720S Spider | 12 | $900 | yes | available | yes |
| McLaren GT | 7 | $600 | yes | available | yes |
| Mercedes G550 Professional | 9 | $300 | yes | available | yes |
| Mercedes G550 | 8 | $300 | yes | available | yes |
| Mercedes Maybach GLS 600 | 9 | $500 | yes | **maintenance** | no |
| Mercedes AMG G63 | 10 | $400 | yes | available | yes |
| Rolls-Royce Cullinan Chrome Hearts | 11 | $800 | yes | available | yes |

Account-level status for ARK: business name, logo, address, owner email, terms, payouts/charges all pass. Three things fail:

1. **Platform fee not confirmed.** The fee is set to 10% but was never explicitly confirmed, so the system refuses to publish anything.
2. **Default security deposit not confirmed.**
3. **"Has at least one publishable car" fails** — not because the cars are incomplete, but because none of them have been switched on for the marketplace yet, and the readiness rule only counts cars that are *already* published. That is the circular logic causing the confusing "vehicles are not publish ready" message: it counts published cars, not eligible cars.

## Plan

1. Fix the circular check: change the readiness rule so "has a publishable car" counts cars that *pass* every per-car check, whether or not they are already switched on for the marketplace. Report both numbers — eligible cars and published cars — so the panel can say "8 of 9 cars ready, 0 published" instead of a blanket not-ready.
2. Make the readiness panel wording specific: list the exact account-level items still outstanding (confirm fee, confirm deposit) and, per car, the exact missing item. Today a car in maintenance and a car with no photos read the same.
3. In the Super Admin readiness panel, surface the two confirmations as explicit actions so ARK can be cleared without a database edit: confirm platform fee (records the confirmation timestamp) and confirm default deposit.
4. Flag the Maybach GLS 600 to ARK as out of service — it will stay unpublishable while its status is maintenance. Not a bug, just needs their attention.

## Technical notes

- `get_marketplace_readiness` (database function): `has_ready_vehicle` currently derives from `ready_vehicle_count`, which filters on `marketplace_visible`. Split into `eligible_vehicle_count` (all per-car checks pass) and `published_vehicle_count` (eligible AND `marketplace_visible`), and base `has_ready_vehicle` on the eligible count. Return both in the JSON payload; keep `ready_vehicle_count` as-is so existing callers do not break.
- ARK's `teams` row needs `platform_fee_confirmed_at` and `deposit_source_confirmed_at` set — enforced by the `enforce_platform_fee_on_marketplace_visible` and `enforce_deposit_source_on_marketplace_visible` triggers, which raise on any attempt to publish while they are null.
- Panel updates in `MarketplaceReadinessPanel.tsx` / `useMarketplaceReadiness.ts` to read the new counts and render per-check failure reasons.

# Checkout Compliance (Track B) — reviewed plan

The handoff is sound. Below are the gaps found against the current system, the improvements, and the build order. Nothing changes for live renters until the coordinated release date.

## What I found in the current system

- ARK Safehouse (Miami, FL) has no tax rate set at all, which is why the Miami booking showed no tax.
- Bookings default to the "premium" protection option when the renter sends nothing. Hiding Protect in the renter app is not enough — the server must force "no protection" while the flag is off.
- Taxes ("state fee") and processing currently ride on the Exotiq charge, described to Stripe as "Exotiq booking fee + protection". That wording breaks two of the new rules (Protect/coverage wording, and taxes on the wrong side).
- Each booking stores a fee snapshot at request time. The flip must respect that: bookings requested before the switch keep the old split; only new ones use the new split.
- There is no fuel type field on vehicles yet.

## Improvements to the handoff

1. **Version the fee model.** Every booking records which split it was priced under (old vs new). Checkout, the second charge, refunds, extensions and receipts read that tag. This avoids a half-paid booking being re-split mid-flight and makes the flip a single switch.
2. **Settle the service-fee math now (recommended):** the processing recovery covers only the cost of the Exotiq charge itself (the operator already absorbs its own card costs), and uses the exact gross-up `(fee + 0.30) / (1 − 0.029)` instead of the linear estimate. Written into the config comments either way.
3. **Server-side Protect kill switch:** while off, protection is forced to none in quotes, saved bookings, Stripe, emails and receipts — regardless of what the renter app sends.
4. **Banned-words check:** a test fails the build if "card processing", "surcharge", "convenience fee", "coverage" or "insurance" appear in any renter-facing Stripe text, email or receipt template.
5. **Assent log is tamper-proof:** inserts only through one endpoint (rate-limited), no edits or deletes possible, linked to the booking. Stripe's own terms-consent result is copied onto the booking from the payment confirmation.
6. **Publish guardrails without surprise takedowns:** new requirements (pickup-state tax setup + deposit) block new publishes and show a setup prompt in Fleet and readiness. Already-live listings that fail are flagged to the operator and to Super Admin, not pulled automatically (see question 2).
7. **Tax setup per location, itemized:** each location gets a list of named tax lines (percent or per-day), so quotes return "FL sales tax 6%", "Miami-Dade surtax 1%", "FL rental surcharge" separately. The existing single location rate keeps working as a fallback.

## Build order

```text
Now        ARK tax lines -> quote returns itemized taxes, service fee, deposit, fuel type
           Protect server kill switch + banned-words sweep (Stripe text, emails)
Anytime    Assent log + Stripe terms consent on checkout (hidden until Terms v2)
Before     Publish guardrails + operator setup prompt + Super Admin flag list
onboarding
Release    Fee model v2 switch: taxes move to operator transfer; Exotiq charge =
day        service fee only. Flipped together with renter app MP-31.
```

Each step ships without changing what live renters pay until "Release day".

## Questions to confirm (defaults in brackets)

1. ARK's Miami taxes: FL 6% sales tax, Miami-Dade 1% surtax, FL $2/day rental surcharge? [use these, operator can edit]
2. Live listings that fail the new tax/deposit check: flag only, or unpublish? [flag only, 14-day notice]
3. Service-fee recovery: exact gross-up on the Exotiq charge only? [yes]
4. Assent log retention: how long? [7 years, matching booking records — needs Privacy Notice line from counsel]
5. Rename of the "exotiq" demo operator: you're doing it, or should I? [you]

## Technical details

- Fee snapshot: add `fee_model_version` (default 1) to bookings; new columns `service_fee_cents`, `tax_lines jsonb`, `deposit_hold_cents`, `terms_consent_status`. Additive only.
- New `location_tax_lines` (team-scoped RLS) with label, kind (percent/per_day/flat), value; quote RPC sums them; fallback to `locations.tax_rate_percent`.
- `vehicles.fuel_type` nullable enum-like text (Gasoline/Electric/Hybrid), editable in Edit Vehicle, returned by public fleet/detail RPCs via additive JSON field (no RETURNS TABLE change, or drop/create with dependency check per MP-9 rules).
- v2 split in rent-checkout: `transfer_data.amount = rental + taxes − operator processing estimate`; webhook Exotiq leg = `service_fee_cents` only, description "Service fee — {ref}". v1 bookings keep current path.
- `consent_collection.terms_of_service: "required"` + `custom_text.terms_of_service_acceptance` linking /terms; requires the platform Terms URL set in Stripe account settings (Gregory). Read `session.consent.terms_of_service` in the webhook.
- `legal_assents`: insert-only via `rent-log-assent` Edge Function (anon, token-gated by booking ref, rate-limited); UPDATE/DELETE revoked from all roles; service_role read; Super Admin read RPC.
- Publish guardrail added to the existing marketplace readiness trigger for transitions into Listed only.
- Tests: fee math (v1 parity, v2 split sums to the renter total), Protect-off quote, banned words, assent append-only.

# Handback — Checkout Compliance Track B (2026-10-06)

## Shipped (backend, additive, no live price change)
- ARK Safehouse: 6% "FL sales tax" set; FL $2/day rental surcharge already in `state_rental_fees`.
- `bookings`: `fee_model_version` (default 1 = legacy split), `service_fee_cents`, `tax_lines`, `deposit_hold_cents`, `terms_consent_status`.
- `vehicles.fuel_type` (Gasoline | Electric | Hybrid, nullable).
- `legal_assents` append-only table (trigger blocks UPDATE/DELETE; Super Admin read only).
- `rent-log-assent` edge function. POST `{ booking_ref, token, storefront_path, assents: [{ doc_id, doc_version, checkbox_text_hash }] }`. IP + user agent captured server-side.

## Decisions recorded
- Service fee recovery = exact gross-up on the Exotiq charge only: `(fee + 0.30) / (1 − 0.029)`. Operator absorbs its own processing (M6-D2).
- Fee model v2 flip is per-booking (`fee_model_version`); in-flight v1 bookings keep the old split.
- Live listings failing tax/deposit checks: flag + 14-day notice, then unpublish.

## Remaining (backend), in order
1. Quote API v2 fields (itemized tax lines, service_fee_cents, deposit_hold_cents, fuel_type) — needs drop/create of `public_vehicle_quote` per MP-9 rules, coordinated with renter app.
2. Server-side Protect kill switch (`PROTECT_ENABLED`) — flip together with renter MP-30 so displayed and charged totals match.
3. Banned-words sweep + test on Stripe text/emails ("Exotiq booking fee + protection" must become "Service fee").
4. Stripe `consent_collection.terms_of_service` on rent-checkout — needs the platform Terms URL set in Stripe account settings (Gregory) and ToS v2.
5. Publish guardrails (tax + deposit) + operator prompt + Super Admin flag list.
6. v2 split in rent-checkout / rent-payment-webhook — release day with MP-31.

## For Claude Code — Privacy Notice additions (counsel review)
Add a "Booking agreements" section stating:
- What we log when a renter accepts Terms, Privacy Notice or Release: email, booking reference, document name and version, a fingerprint of the exact checkbox text, time (UTC), IP address, browser/device string, operator and storefront page.
- Why: to prove which terms were accepted and when (contract formation, dispute and chargeback defence, legal obligations). Lawful basis: contract performance and legitimate interests.
- Retention: 7 years from acceptance, matching booking records; then deleted.
- Access: Exotiq compliance staff; shared with the operator or payment processor only for a dispute about that booking.
- Records cannot be edited; renters can request a copy via the existing data request process (deletion requests are limited while the legal hold applies).
- Mirror in the EU/UK and UAE notices.

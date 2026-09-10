# First-run experience — remaining work

The reliability pass is already in: the walkthrough can be skipped, stepped back through and jumped chapter-to-chapter; "I'll set it up myself" is now remembered on the account; the getting-started checklist reflects real team members; and a booking-readiness card is on the dashboard. This plan covers what is left.

## 1. Guided setup: add the two missing steps

Today signup asks for business profile, then fleet size and locations, then vehicles or an import — and stops. Tax rates and getting paid never come up, so accounts arrive at the marketplace half-ready.

New shape, five steps, each with Back, Skip and a visible "Step 3 of 5":

1. **Business** — name, contact, address, country (unchanged, plus logo upload moved here).
2. **Locations & tax** — first pickup location with its tax rate, tax label and whether prices include tax. Defaults suggested from the address and country.
3. **Fleet** — import a spreadsheet, add one manually, or skip (unchanged).
4. **Getting paid** — connect payments, or skip and be reminded on the dashboard.
5. **You're set** — lands on the dashboard with the readiness score.

Rules that apply to every step:
- Skip never blocks and never loses the step; it moves to the dashboard readiness list.
- Progress saves as you go, so closing the laptop and signing in elsewhere resumes on the same step.
- No step can be a dead end: Back always works, including from step 1 back to the welcome screen.

## 2. Readiness score on the dashboard

Turn the existing readiness card into a single honest score:

```text
Booking ready      4 / 6
Marketplace ready  6 / 9
```

Every unfinished item is one click to exactly the field that fills it — business name, address, logo, contact email, terms, payments enabled, payouts enabled, a pickup location, tax rate set, at least one vehicle with photos and a rate. The card disappears once everything is green. Existing accounts see it too, since that is how current tenants get marketplace-ready.

## 3. Walkthrough polish

- Remember whether the walkthrough was taken or skipped, and offer "Replay walkthrough" from the help menu rather than re-prompting.
- Show the chapter list up front so people can see how long it is before starting.

## Technical notes

- Extend `onboarding_progress` (`current_step`, `steps_completed`, `form_data`) to cover the two new steps; the debounced save and resume-on-load already work.
- Step 2 writes to the existing nullable location tax columns (`tax_rate`, `tax_label`, `prices_include_tax`) via the same path as `EditLocationDialog`; defaults come from `src/lib/countryDefaults.ts` and `src/lib/taxResolution.ts`.
- Step 4 reuses the existing Stripe Connect onboarding entry point; no new payment logic.
- The score reads `get_marketplace_readiness` (already used by `useMarketplaceReadiness`) plus the location/tax check — no new readiness rules, just a customer-facing view with deep links.
- New steps sit behind the existing feature-flag pattern until switched on, so live tenants are unaffected.

## Sequencing

Readiness score first (it helps existing tenants immediately), then the two new setup steps, then walkthrough polish.

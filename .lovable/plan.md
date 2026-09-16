# Onboarding prefill, deposit location, and address duplication

Three related problems, all fixable without changing any existing behavior or data.

## What I confirmed first

- **The address is stored in two separate places.** Onboarding step 1 saves the business address onto the *user profile*. The Business tab in Settings saves it onto the *company record* — and the company record is the one used for tax invoices, receipts, and the marketplace readiness check.
- Because of that split, several accounts (Revel + Roam, GM LUXE, Denver Exotic Rental Cars) typed a business address during onboarding and still have an empty one on the company record, so their readiness checklist can still say "business address missing".
- **The deposit field exists but is hidden.** It lives under Settings → **Team** → **Settings** sub-tab, not under Business or Payments. That is why it can't be found. ARK's value is currently 0.
- **Onboarding does not read what's already in the system.** Resumed or "edit company info" mode reads only from the user profile, so anything entered in the Business tab, or preloaded by us (company name, address, locations), shows up blank and has to be retyped.

## What I'll change

### 1. Make the deposit easy to find
- Add the same "Default deposit amount" card to Settings → **Business** (same single stored value, so both places always agree).
- Leave the existing Team → Settings card exactly where it is, with a short line saying it's the same setting.

### 2. Onboarding carries existing information
- One prefill loader for steps 1-2 with a clear priority: company record first (authoritative), then user profile, then saved onboarding progress.
- Applies in both cases: "edit company info" and a resumed/skipped onboarding.
- Prefill never overwrites something the user has already typed in the open form.
- Existing locations already saved for the account appear in step 2 pre-filled rather than empty.

### 3. Stop asking for the address more than once
- Step 1 saves the business address to **both** the profile and the company record, so it lands where invoices and the readiness check look. This fixes the "business address missing" checklist item for new signups.
- One-time data backfill: for accounts where the profile has an address and the company record doesn't, copy it across. Nothing is overwritten if the company record already has one.
- Step 2's first location gets a "Same as business address" fill button — one tap instead of retyping.
- The "Default pickup address" field in the Business tab gets clearer wording: it is only a fallback used when a vehicle has no location, so most operators can leave it blank.

Net result: the address is typed once in onboarding, optionally reused for the first location with one tap, and never asked for again.

## Guardrails

- No columns removed or renamed; no existing field stops working. The two address stores both keep being written, so anything already reading either one is unaffected.
- The readiness rules, booking flow, invoices, and payment logic are untouched.
- Backfill is copy-only, and only where the destination is empty.

## Technical notes

- Prefill source order: `teams` (name, country, `business_address`, phone/support) → `profiles` (`company_name`, `phone`, `website`, `business_address`) → `onboarding_progress.form_data`; merge is shallow and skips keys already non-empty in local form state.
- `handleSaveStep1` gains a `teams.business_address` write alongside the existing `profiles` write, mapping `{street, city, state, zip}` to the `{line1, city, region, postal_code}` shape `BusinessProfileSection` and `generate-vat-invoice` expect.
- Backfill migration: `UPDATE teams SET business_address = <mapped profile address> ... WHERE (business_address IS NULL OR business_address::text IN ('{}','null'))`, owner-joined, no deletes.
- Deposit card in `BusinessProfileSection` reads/writes `teams.default_deposit_cents` through the same validation path already used in `TeamSettingsSection` (extracted into a shared component so the two can't diverge).
- Files: `src/pages/Onboarding.tsx`, `src/components/dashboard/settings/BusinessProfileSection.tsx`, `src/components/dashboard/TeamSettingsSection.tsx`, `src/components/onboarding/LocationInput.tsx`, one additive migration.

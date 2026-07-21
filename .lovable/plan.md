## Goal

Every "Verified" badge must reflect a real, live signal. Today two signals exist:

- **ID:** `customers.identity_status === 'verified'` (Stripe Identity — real, wired end-to-end)
- **Insurance:** `customers.insurance_verified` (manual upload → boolean flip)

The insurance flow is about to be reworked (next task), so this pass:
1. Removes every hardcoded "Verified" badge (chips tied to nothing).
2. Drops the legacy `id_verified` boolean from all UI reads — ID state comes only from `identity_status`.
3. Neutralizes the insurance "Verified" badge until the new verification flow lands. It becomes "On file / Not on file" instead of "Verified / Pending" so we're not asserting a verification we don't actually perform.

## Current state (verified via rg)

### Hardcoded (not tied to any data)
- `src/components/dashboard/settings/MyAccountSection.tsx:221-226` — static `<Badge>Verified</Badge>` under avatar.

### ID badges reading legacy `id_verified`
- `src/components/dashboard/VerificationSection.tsx`
  - `isIdVerified` = `id_verified || identity_status === 'verified'`
  - `getVerificationStatus` reads `customer.id_verified`
  - Row-badge fallback (~line 434) reads `customer.id_verified`
  - Stat counts / progress text derive from `isIdVerified`
- `src/components/dialogs/EnhancedBookingDialog.tsx:1245-1247` — "ID Verified/Pending" from `customer?.id_verified`

### Insurance badges asserting "Verified"
- `VerificationSection.tsx:504-507` — green "Insurance" pill when `insurance_verified === true`; "Upload Insurance" otherwise
- `VerificationSection.tsx:112-114, 133-136` — `insurance_verified` folded into fully/partial/unverified stats
- `EnhancedBookingDialog.tsx:1249-1251` — "Insurance Verified/Pending" from `customer?.insurance_verified`

### Out of scope this pass
- `IDUploadDialog.tsx` — legacy path, unreachable in prod (DPA-gated flag off).
- `InsuranceUploadDialog.tsx` — will be reworked next task; leaving as-is so uploads still store the document + provider metadata. We just stop labeling the resulting state as "Verified" in the UI.

## Changes

1. **`MyAccountSection.tsx`** — delete the static "Verified" chip block (lines 221-226).

2. **`EnhancedBookingDialog.tsx` (~1245-1251)**
   - ID badge: read `customer?.identity_status === 'verified'`; label "ID Verified" / "ID Not verified".
   - Insurance badge: label becomes "Insurance on file" (when `insurance_verified` truthy — treated as "document present" not "verified") / "Insurance missing" (falsy). Use a neutral tone rather than the green success variant so we don't imply verification.

3. **`VerificationSection.tsx`**
   - `isIdVerified(c)` → `c.identity_status === 'verified'` (drop legacy fallback).
   - `getVerificationStatus` → check `identity_status === 'verified'` for the ID half.
   - Row-badge fallback (~434) → same.
   - Insurance row pill (~504-519): rename "Insurance" (green) to "Insurance on file" (neutral) when doc present; "Upload Insurance" CTA stays for the empty case.
   - Stat cards + headline copy: rename the "Fully Verified" tile to "ID Verified & Insurance on file" (or shorter: "ID verified · Doc on file"). Counts continue to combine `identity_status === 'verified'` AND `insurance_verified`. This is honest until the insurance verification flow lands, at which point we'll flip the copy back to "Fully Verified".
   - Update the small helper text under the tile from "ID & Insurance verified" → "ID verified + insurance document on file".

## Out of scope (call out, don't change)

- Legacy DB columns `customers.id_verified` / `insurance_verified` — not dropped; UI just stops asserting truth from them (ID) or softens the copy (insurance).
- Insurance verification workflow itself — separate upcoming task.
- Edge functions, migrations, RLS — untouched.

## QA (after build)

- **My Account:** no free-floating "Verified" chip under the avatar.
- **Vault → Verification:**
  - Customer with `identity_status = 'verified'` → green "ID Verified · <date>" badge.
  - Customer with only legacy `id_verified = true` and no Stripe session → "Not started" (intended correction).
  - Insurance chip on a customer with `insurance_verified = true` reads "Insurance on file" in neutral styling — not green "Verified".
  - Stat tile no longer says "Fully Verified"; copy reflects the honest state.
- **EnhancedBookingDialog** for a Stripe-verified customer with insurance doc → "ID Verified" (green) + "Insurance on file" (neutral).
- Run `tsgo` typecheck.

## Files touched

- `src/components/dashboard/settings/MyAccountSection.tsx`
- `src/components/dialogs/EnhancedBookingDialog.tsx`
- `src/components/dashboard/VerificationSection.tsx`

No edge functions, no migrations, no schema changes.

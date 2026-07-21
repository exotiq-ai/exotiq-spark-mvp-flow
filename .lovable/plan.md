## Scope

Three-part cleanup around Stripe Identity: redeploy the session-create function, surface real ID verification everywhere a customer card renders, and give ID events proper bell-icon notifications.

---

### 1. Redeploy `identity-create-session`

Redeploy the edge function from repo main (no code changes needed — the dual-secret fallback + team-membership check are already in place). Smoke test with a `vs_` lookup afterward.

### 2. CRM CustomerProfileDialog — show verification, ensure scroll

`src/components/dialogs/CustomerProfileDialog.tsx`

- The "Verification Details" section (lines 229–260) only renders sub-rows when `drivers_license` / `insurance_provider` exist. For most customers those fields are empty, so the section reads as blank. Replace with a real block that always renders:
  - **ID Verification row** — pill driven by `customer.identity_status` (verified / processing / requires_input / manual_review / canceled / none), with `verified_name` + `document_expiry` when present. "Verify ID via Stripe" button (calls `identity-create-session` like VerificationSection does) when not verified. "View in Stripe" link for staff when a session id exists (env-aware live vs test URL, matching VerificationSection).
  - **Insurance on file row** — neutral pill (matches the recent honesty pass; no "verified" claim). Shows provider / policy / expiry when present, "Not on file" otherwise.
  - Legacy `drivers_license` block kept only as a secondary line under the ID row when the column has data.
- Scroll: `DialogContent` already has `max-h-[90vh] overflow-y-auto`, but on short viewports the flex column doesn't compute correctly because inner action buttons push past the max height without a min-h-0 guard. Add `flex flex-col` + wrap the tab content in a `min-h-0 overflow-y-auto` container so the Overview tab scrolls independently of the header/tabs. Confirmed with the screenshot: content is clipped, not scrolling.

### 3. Booking module customer card

`src/components/dialogs/EnhancedBookingDialog.tsx` already shows the `identity_status === "verified"` badge (lines 1243–1252). Two small additions:
- When status ≠ verified, show a compact "Verify ID" action next to the badge that opens the same Stripe hosted-URL flow used in VerificationSection (share the helper — extract to `src/lib/identityVerification.ts` so both call sites and the CRM dialog use one implementation).
- Insurance pill stays neutral "on file / missing" (no change to logic).

### 4. Bell notifications for ID events

`supabase/functions/identity-webhook/index.ts`
- Extend the notify block (currently manual_review only) to insert a row for two more events:
  - `identity.verification_session.verified` → type `identity_verified`, title "ID verified", success tone.
  - `identity.verification_session.requires_input` when attempts < cap → type `identity_requires_input`, warning tone, message names attempts remaining.
- Manual review notification stays as-is.
- All three carry `data: { customer_id }` so the existing deep-link (`module=vault&view=verification&customerId=...`) works.

`src/components/common/UnifiedNotificationCenter.tsx`
- Map the two new types in `systemNotifications` memo (line 82) → tone: verified=success, requires_input=warning, manual_review=error.
- Add Shield icon branch in `getSystemIcon` (or an ID-specific helper) so identity notifications render with the Shield glyph instead of the generic Info dot.
- Extend `handleSystemAction` (line 308) so `identity_verified` and `identity_requires_input` route the same way manual_review already does.

Redeploy `identity-webhook` after the edit.

### 5. Verification

- Redeploy identity-create-session; confirm a `vs_...` create still succeeds for an authenticated operator.
- Force a webhook fire (or replay the last verified event on Greg's test customer) and confirm a bell notification appears with a Shield icon, deep-links to Vault → Verification → that customer.
- Open a CRM customer card on desktop and mobile: identity row renders regardless of legacy fields, section scrolls.
- Open a booking's customer card: "Verify ID" button opens the Stripe hosted URL when the customer isn't verified.

### Technical details

- New shared helper `startIdentityVerification(customerId: string)` in `src/lib/identityVerification.ts`: invokes `supabase.functions.invoke('identity-create-session', { body: { customer_id } })`, opens `data.url` in a new tab, returns `{ status, url }`. Used by VerificationSection, EnhancedBookingDialog, CustomerProfileDialog.
- No migrations. No schema changes. `notifications` table already accepts arbitrary `type` strings.
- Feature-flag: `idVerification` is already on; no flag changes.
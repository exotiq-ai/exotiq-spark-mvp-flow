# Remove DPA §3.8 Prohibited Data from Lovable Path

Disable ID/receipt scanning flows and hide the typed driver's license number field. Keep license expiry (date only — not a government identifier on its own). All changes are frontend gating + TODO documentation. No edge function, migration, types, or storage bucket changes.

## Files to change

### 1. `src/lib/featureFlags.ts`
Add two off-by-default flags with a DPA §3.8 header comment explaining why:
- `idVerification: false` — driver's license image/OCR uploads
- `receiptScanning: false` — receipt/invoice OCR via Gemini
- `driversLicenseNumberField: false` — typed government identifier input

TODO block: re-enable only after migration off Lovable, or behind a confirmed non-Lovable path (Stripe Identity / Persona for ID; direct Document AI for receipts). Reference signed DPA §3.8.

### 2. `src/components/dashboard/VerificationSection.tsx`
Wrap the "Upload ID" button in `isFeatureEnabled('idVerification')`. When off, render a disabled button with a tooltip ("ID verification coming soon — pending compliant provider integration").

### 3. `src/components/dialogs/IDUploadDialog.tsx`
Add DPA §3.8 TODO header comment. File stays in tree for future Stripe Identity/Persona wiring, but no entry point invokes it while the flag is off. Note in TODO: when provider lands, persist only verification token + status + expiry — never raw DL number or image.

### 4. `src/components/margin/ReviewTab.tsx`
Gate "Upload Receipts" button under `isFeatureEnabled('receiptScanning')`; disabled affordance + tooltip when off.

### 5. `src/components/margin/ReceiptUploadDialog.tsx`
Defensive early-return rendering "Coming soon — pending compliant OCR path" when flag is off. Already a no-op, this makes it explicit.

### 6. `src/components/dialogs/AddCustomerDialog.tsx` and `EditCustomerDialog.tsx`
- **Hide** the License Number `<Input>` field behind `isFeatureEnabled('driversLicenseNumberField')`. Keep the surrounding "Driver's License" section heading and the **Expiry Date** field visible (expiry alone is not a government identifier — it's a compliance reminder).
- When the flag is off, render the section as a single-column with just Expiry Date.
- Do **not** clear existing `drivers_license` values on save — preserve any data already in the column. Just omit the field from the form submission when hidden so users can't add new values via this path.
- Add inline TODO comment referencing DPA §3.8 and pointing to the future Stripe Identity/Persona migration where the verification token replaces the raw number.

## Out of scope (separate follow-up)
- Migration to null out existing `customers.drivers_license` values — defer until provider is live so we don't lose data prematurely.
- Edge function changes to `parse-expense-receipt` — function stays deployed but unreachable from UI.
- DB column drops — keep schema stable.

## Verification
- Build passes.
- Visit Dashboard → Verification: "Upload ID" is disabled with tooltip.
- Visit Margin → Review: "Upload Receipts" is disabled with tooltip.
- Open Add/Edit Customer: License Number input is gone; Expiry Date remains; existing customers' stored license numbers are unaffected.
- Grep confirms no remaining UI path invokes `IDUploadDialog`, `ReceiptUploadDialog`, or writes to `drivers_license` from a visible input.

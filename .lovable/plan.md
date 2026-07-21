## Goal

Replace the disabled "Upload ID" button in `src/components/dashboard/VerificationSection.tsx` with a Stripe Identity flow that calls the existing `identity-create-session` edge function. No image storage, no edge-function or migration changes, insurance flow untouched.

## Changes

### 1. `src/lib/featureFlags.ts`
Flip `idVerification: false` → `true`. Leave the DPA §3.8 comment intact but note that ID verification is now routed through Stripe Identity (no PII stored in Lovable Cloud).

### 2. `src/components/dashboard/VerificationSection.tsx`

Extend the `CustomerVerification` interface with the two new columns already present on `customers`:
- `identity_status: string | null`
- `identity_session_id: string | null`

Replace the disabled Upload ID branch (lines 280–292) with a **"Verify ID"** button that:
- Calls `supabase.functions.invoke('identity-create-session', { body: { customer_id } })` with the operator's JWT (auto-attached by the client).
- On `{ status: 'verified', reused: true }` → refresh customers, toast "Already verified".
- On HTTP 409 `{ status: 'manual_review' }` → toast + set local state so the row shows the manual-review badge.
- On success (`url` returned) → open a small popover/dialog with:
  - **Copy verification link** (writes `url` to clipboard, toast confirmation).
  - **Email to customer** button → opens `mailto:` prefilled with subject "Verify your ID for your upcoming rental" and body containing the URL. Kept simple, no server-side send.

Add a `getIdentityBadge(identity_status)` helper that returns badge props for each status per spec:

```text
created         → "Link sent"          (secondary, Clock)
processing      → "Processing"         (secondary, Clock)
verified        → "ID Verified"        (default/green, CheckCircle2) + id_verified_at date
requires_input  → "Action needed"      (amber/secondary, AlertTriangle)
manual_review   → "Needs review"       (destructive, AlertTriangle)
canceled        → "Canceled"           (outline, XCircle)
redacted        → "Expired / redacted" (outline, XCircle)
null/none       → show "Verify ID" button (existing fallback)
```

The badge sits in the same slot the current "Upload ID" button / "ID Verified" badge occupies, matching the existing `Badge variant=…` visual language already used for insurance/verified/partial.

Add a small **"View in Stripe"** ghost link (external icon) rendered only when `customer.identity_session_id` is set, pointing to:
`https://dashboard.stripe.com/test/identity/verification-sessions/${identity_session_id}`
Opens in a new tab with `rel="noopener noreferrer"`.

Adjust the top-of-card counters so `id_verified` OR `identity_status === 'verified'` counts as ID-verified (keeps the summary cards honest without touching insurance logic).

Remove the now-unused `IDUploadDialog` import + `idUploadOpen` state and the `<IDUploadDialog />` render at the bottom. The dialog file itself is left in place (unrelated file — leaving it untouched per the ask).

### 3. Notifications (verification only, no code change)

`identity-webhook` already inserts `type: 'identity_manual_review'` notifications. Confirm they render through the existing `NotificationCenter` / `useNotifications` pipeline (generic type-agnostic renderer) and that clicking them deep-links to the customer. If deep-linking already routes via `data.customer_id` on the notification row, no change needed; if it doesn't, that's out of scope for this task and I'll flag it rather than modify unrelated files.

## Out of scope (explicitly not touching)

- `supabase/functions/identity-*` edge functions
- Any migration or grants
- `InsuranceUploadDialog` / insurance flow
- `IDUploadDialog.tsx` itself (just no longer wired up here)
- Any ID image upload/storage path

## Verification

- Typecheck touched file with tsgo.
- Manual: with `hello@exotiq.ai`, click Verify ID on an unverified customer → confirm popover shows link, status updates to `created`, badge renders. Simulate `verified` / `manual_review` rows via existing test data to confirm badge variants.
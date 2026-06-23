## Goal

Make the "Current policies" list on the Legal settings page actionable: owners and admins can accept any document inline (one at a time) via a small confirm dialog. The existing forced re-acceptance modal, DPA card, and acceptance history are untouched.

## Scope

Only `src/components/dashboard/settings/LegalSection.tsx`. No DB, RLS, or edge-function changes — the existing `record-terms-acceptance` function already handles everything we need.

## Behavior

For each row in "Current policies":

- **Already accepted at current version** → keep the existing `Accepted` badge. No action.
- **Older version on file** → show the badge plus an `Accept update` button (owner/admin only).
- **Not yet accepted** → show the badge plus an `Accept` button (owner/admin only).
- **Non-owner / non-admin** → status badge only, no buttons. Hover tooltip: "Only an account owner or admin can accept on behalf of your organization." This matches the answer "Owners and admins only".

Clicking the button opens a small confirm dialog with:

- Doc title, version, effective date, and a link to open the full text in a new tab.
- A single checkbox bound to a per-document consent statement (see below).
- `Cancel` and `Accept` buttons. `Accept` is disabled until the checkbox is ticked and shows a spinner while submitting.

On submit:

- Call `supabase.functions.invoke("record-terms-acceptance", { body: { team_id, event_type: "terms_update", documents: buildDocumentsPayload([docType]), consent_statement, acceptance_method: "checkbox_click", page_url, is_authorized_representative: true } })`.
- For `dpa`, use `event_type: "order_form"` and the existing `DPA_CONSENT_STATEMENT` so it stays consistent with the dedicated DPA card. The DPA card stays as a richer, more prominent entry point but the row button also works.
- On success: toast, close dialog, `await load()` to refresh the badge.
- On error: toast destructive, leave dialog open so the user can retry.

## Per-document consent statements

A small lookup keyed by `LegalDocType`, each phrased to match what the document actually binds:

- `terms` — "I have read and agree to the Exotiq Terms and Conditions. I represent that I am authorized to bind my organization to these terms."
- `privacy` — "I acknowledge the Exotiq Privacy Policy and how my organization's data is processed."
- `aup` — "On behalf of my organization, I agree to the Exotiq Acceptable Use Policy."
- `dpa` — reuse `DPA_CONSENT_STATEMENT`.
- `sms` — reuse `SMS_CONSENT_STATEMENT` from `src/lib/legal/versions.ts`.
- `cookies` — "I acknowledge the Exotiq Cookie Policy."
- `dmca` — "I acknowledge the Exotiq DMCA and Copyright Policy."
- `transfer_addendum` — "On behalf of my organization, I execute the International Data Transfer Addendum (SCCs / UK IDTA) for transfers of personal data outside the EEA/UK."

These will live as a `PER_DOC_CONSENT_STATEMENT: Record<LegalDocType, string>` constant inside `LegalSection.tsx` (kept local for now since no other surface needs them; promote to `versions.ts` only if a second consumer appears).

## Out of scope

- No bulk "Accept all outstanding" button (per the user's answer).
- No changes to the forced re-acceptance gate.
- No DB schema changes.
- Audit fields (`ip_address`, `user_agent`) continue to be filled in by the edge function exactly as today.

## Verification

- As `hello@exotiq.ai` (owner): the SMS, Cookies, DMCA, Transfer Addendum rows show `Accept` buttons; clicking one opens the dialog, ticking the box and confirming records the acceptance and the badge flips to `Accepted` without a refresh. New row appears in "Acceptance history".
- As a viewer: no buttons shown anywhere; status badges only.
- Forced re-acceptance gate is unaffected when stale required docs exist.

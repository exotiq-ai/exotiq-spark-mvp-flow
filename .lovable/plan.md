
# Clickwrap Acceptance — Implementation Plan

Build an ESIGN/UETA-grade clickwrap system: conspicuous notice → affirmative click → server-side immutable audit trail → re-acceptance gate when terms change materially.

## 1. Legal document versioning (source of truth)

Create `src/lib/legal/versions.ts` as the single registry:

```ts
export const LEGAL_DOCS = {
  terms:   { version: "2026-03-01", effectiveDate: "2026-03-01", url: "/legal/terms" },
  privacy: { version: "2026-03-01", effectiveDate: "2026-03-01", url: "/legal/privacy" },
  aup:     { version: "2026-03-01", effectiveDate: "2026-03-01", url: "/legal/acceptable-use" },
  dpa:     { version: "2026-03-01", effectiveDate: "2026-03-01", url: "/legal/data-processing" },
} as const;

export const CURRENT_CONSENT_STATEMENT =
  "I have read and agree to the Exotiq Terms and Conditions, Privacy Policy, and Acceptable Use Policy. I represent that I am authorized to bind my organization to these terms.";
```

Each legal page (`Terms.tsx`, `Privacy.tsx`, etc.) reads its version from this registry instead of hardcoded props, so version and effective date stay in sync.

A small build script `scripts/legal/hash-docs.ts` renders each legal page to normalized plain text (strip tags, collapse whitespace) and produces `src/lib/legal/hashes.generated.ts` with the SHA-256 of each version. Re-run on every doc edit; CI verifies it's up to date.

## 2. Versioned document archive (in DB)

Migration creates `legal_document_versions`:
- `document_type` (enum: terms, privacy, aup, dpa, order_form)
- `version` (text), `effective_date` (date)
- `content_hash` (text, SHA-256 of normalized text)
- `content_text` (text — the normalized rendered text)
- `published_at`, unique on `(document_type, version)`
- Public read for `anon` + `authenticated` (read-only); writes only via migrations/service_role

Each time `versions.ts` bumps, a migration inserts the new row with the snapshot.

## 3. Acceptance record table

Migration creates `terms_acceptances` (append-only, scoped by `team_id`):

| Column | Notes |
|---|---|
| `id` uuid pk | server-generated |
| `user_id` uuid | from JWT |
| `team_id` uuid | the team being bound |
| `actor_email`, `actor_display_name` | denormalized snapshot |
| `event_type` | enum: `signup`, `reacceptance`, `terms_update`, `order_form` |
| `documents_accepted` jsonb | array of `{document_type, version, url, content_hash, effective_date}` |
| `acceptance_method` | enum: `checkbox_click`, `button_click` |
| `consent_statement` text | verbatim text shown |
| `accepted_at` timestamptz | server clock |
| `ip_address` inet | from request headers |
| `user_agent` text | from request headers |
| `page_url` text | submitted by client |
| `auth_context` text | session id reference, **never the token** |
| `is_authorized_representative` boolean | |
| `created_at` timestamptz default now() | |

Immutability:
- `GRANT SELECT, INSERT` to `authenticated` (no UPDATE/DELETE).
- `GRANT ALL` to `service_role`.
- RLS: users select rows where `team_id` is in their teams; insert only via the edge function (service role).
- BEFORE UPDATE/DELETE trigger raises an exception as belt-and-suspenders.

## 4. Server-side capture: `record-terms-acceptance` edge function

New function `supabase/functions/record-terms-acceptance/index.ts`:

- Validates JWT via `getClaims()` (no anonymous accepts).
- Body schema (zod): `{ team_id, event_type, documents: [{document_type, version}], consent_statement, acceptance_method, page_url, is_authorized_representative }`.
- For each `(document_type, version)`, looks up the row in `legal_document_versions` and copies `url`, `content_hash`, `effective_date` server-side — client cannot forge them.
- Pulls `ip_address` from `x-forwarded-for`, `user_agent` from header, `accepted_at = now()`, `actor_email`/`actor_display_name` from the JWT/profiles.
- Inserts using service_role client. Returns `{ acceptance_id }`.

## 5. Signup UI changes (`src/pages/Auth.tsx`)

In the sign-up form only (not sign-in):
- Add an unchecked `Checkbox` (`id="accept-terms"`) directly above the submit button.
- Label = `CURRENT_CONSENT_STATEMENT` with the three doc names as `<a target="_blank">` to their canonical URLs.
- Submit button is `disabled` until checked.
- After `signUp` / `signUpWithInvite` succeeds **and** a team_id is available (immediately for new teams; from the invite for invitees), call `supabase.functions.invoke('record-terms-acceptance', { body: { event_type: 'signup', ... } })` inside the same code path. If the call fails, surface the error and roll the user back to a "please re-accept" state — they cannot enter the app without a row.

## 6. Re-acceptance gate (full build now)

New component `<TermsReacceptanceGate>` mounted inside `ProtectedRoute`:
- On mount, queries: for the current `user_id` + `team_id`, what is the latest `documents_accepted[*].version` per `document_type`?
- Compares against `LEGAL_DOCS[*].version`.
- If any required doc is outdated, renders a non-dismissable modal that blocks the rest of the app:
  - Shows what changed (list of doc names with new effective dates, links to diff or full text).
  - Unchecked checkbox + the same `CURRENT_CONSENT_STATEMENT` (or an update-flavored variant).
  - Submit calls `record-terms-acceptance` with `event_type: 'terms_update'`.
- Only the account owner role can accept on the team's behalf; non-owners see a "your account owner must re-accept the updated terms" screen with the owner's name/email, and are blocked.

Order-form acceptance (subscription change) is wired the same way from the existing Stripe checkout return path with `event_type: 'order_form'`.

## 7. Owner-facing audit view

Small page at `/dashboard/admin/terms-acceptances` (owner-only, reuses RBAC):
- Lists all acceptance rows for the team, newest first.
- Row detail shows the full snapshot (who, when, IP, UA, doc versions + hashes, consent statement verbatim).
- "Export CSV" for the dispute/audit case.

## 8. Tests

- Vitest: `versions.ts` ↔ `hashes.generated.ts` consistency check; consent statement contains all three doc links.
- Edge function unit: rejects missing JWT, rejects unknown `(document_type, version)`, rejects pre-filled `content_hash` from client (server overwrites).
- Smoke test: signup flow blocked until checkbox checked.

## Technical details

- All three legal pages already exist; only their version/effective-date wiring changes.
- `is_authorized_representative` defaults to `true` at signup (consent statement asserts it); exposed as a separate checkbox only on order-form flows if you want it.
- `auth_context` stores `session.access_token`'s `jti`/issued-at, never the token itself.
- `content_hash` is computed over normalized plain text (lowercased, collapsed whitespace) so HTML/CSS tweaks don't invalidate it but real text changes do.
- Retention: rows are never deleted by app code. Account deletion cascade is updated to **anonymize** acceptance rows (null out `actor_email`/`actor_display_name`, keep the rest) rather than delete, preserving the audit trail.
- Re-acceptance modal uses existing `Dialog` with `onOpenChange` no-op; `z-[60]` per project dialog standards.

## Out of scope

- Diff UI between old and new doc versions (we list what changed in plain English in the modal copy when a version bumps).
- Renter-side acknowledgements (already handled separately per `mem://legal/renter-acknowledgements`).
- SMS consent (separate 5-year retention system, untouched).

## Status

Requirements 1–5 in your prompt are already live in `src/components/dashboard/VerificationSection.tsx` and `src/lib/featureFlags.ts` from the earlier turn (we successfully ran an end-to-end sandbox verification). The wiring — create-session call, hosted URL dialog with Copy / Email actions, `identity_status` badges (`created` / `processing` / `verified` / `requires_input` / `manual_review` / `canceled` / `redacted`), `reused: true` short-circuit, 409 `manual_review` toast, "View in Stripe" icon link, insurance path untouched, `idVerification` flag flipped on — is all in place.

Reviewing it fresh against the live notification center + upcoming live-mode cutover, two small gaps remain. Neither touches edge functions or migrations.

## Gaps to fix

### 1. Notification deep-link for `identity_manual_review`

`identity-webhook` inserts `notifications` rows with `type = "identity_manual_review"` and `data.customer_id` on the 3rd failed attempt. `UnifiedNotificationCenter.handleSystemAction` has cases for booking / payment / damage / maintenance / tenant docs, but no case for identity — so the "View Details" button on the notification currently no-ops.

Fix: add one branch in `handleSystemAction` that routes to the Verification tab and pre-filters to the customer.

```ts
} else if (nType === 'identity_manual_review') {
  params.module = 'vault';
  params.view = 'verification';
  if (data.customer_id) params.customerId = String(data.customer_id);
}
```

Then in `VerificationSection`, read `customerId` from the URL once on mount and either scroll/highlight that row or seed `searchQuery` with the matching customer's name so it filters to a single row. Seeding search is the smallest change and matches how other modules "deep-link" today.

### 2. Stripe dashboard link is hardcoded to test mode

The "View in Stripe" anchor points at `https://dashboard.stripe.com/test/identity/verification-sessions/...`. That's correct for the sandbox we just verified, but the moment live-mode Identity flips on it will 404 for live sessions.

Fix: switch the path segment based on the session id prefix rather than build mode (matches what Stripe itself does — test sessions start with `vs_` in test acct, live sessions in live acct; simpler to key off `import.meta.env.PROD`, but session-prefix has zero risk of mismatch when both modes coexist during rollout). Use:

```
const isTest = !import.meta.env.PROD; // preview + dev = test
const stripePath = isTest ? 'test/identity' : 'identity';
href={`https://dashboard.stripe.com/${stripePath}/verification-sessions/${customer.identity_session_id}`}
```

This keeps sandbox behaviour identical today and auto-switches when the app is served from production.

## Files touched

- `src/components/common/UnifiedNotificationCenter.tsx` — one extra `else if` branch in `handleSystemAction`.
- `src/components/dashboard/VerificationSection.tsx` — read `customerId` search-param on mount, seed `searchQuery`; make Stripe link mode-aware.

No edge function, migration, or unrelated file changes. Insurance flow untouched. Feature flag stays on.

## Verification after build

1. Insert a fake `identity_manual_review` notification for a known customer via the Verification tab's own notification list (or trigger the webhook path), click "View Details" → Vault opens on Verification tab with that customer filtered.
2. Confirm the "View in Stripe" link on a sandbox customer still resolves (test path) and, once we ship, that a live-mode session id opens the non-`/test/` URL.

I'll stop after these two edits.
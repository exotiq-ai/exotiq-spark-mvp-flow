## Problem

"Open in new tab" from a customer card/row/modal opened as a different tenant. Root cause is not the click handler — it's that the app is served from two different origins:

- Lovable editor preview iframe: `*.lovableproject.com`
- Published app: `exotiq-spark-mvp-flow.lovable.app` (and `app.exotiq.ai`)

Supabase stores its session in **localStorage, scoped per origin**. Each origin holds an independent signed-in user. `window.open(relativeUrl, '_blank')` from inside the editor iframe opens a top-level tab that can resolve to the sibling origin, which reads that origin's own (possibly stale) session. Auth logs confirm two different users active on this project within the same browser in a 10-minute window.

This is a tenant-safety hazard: any operator with an older session on the sibling origin will silently land in the wrong tenant. We cannot make cross-origin `localStorage` sessions share, and we should not paper over it by shipping access tokens through the URL.

## Fix

Remove the "open in new tab" affordance and instead navigate to the profile in the **same tab**. Same-tab navigation reuses the exact session that was authenticated in the current tab — no cross-origin session lookup, no risk of tenant swap. Users who genuinely want a second tab can still Cmd/Ctrl-click any link in the app; the browser will open same-origin with the correct session for that origin.

### Changes

1. `src/components/dashboard/CRMSection.tsx`
   - Remove `handleOpenCustomerInNewTab` and the `ExternalLink` icon buttons on cards.
   - Keep the click behavior that opens the `CustomerProfileDialog` modal (unchanged).

2. `src/components/dashboard/CustomerListRow.tsx`
   - Remove the "Open in new tab" ghost button.
   - Row click still opens the modal.

3. `src/components/dialogs/CustomerProfileDialog.tsx`
   - Remove the `ExternalLink` icon in the dialog header (which used `window.open`).
   - If we want to keep an "expand to full page" affordance, replace it with `navigate(moduleIdToPath('book', { tab: 'crm', customerId }))` (same tab) — but default plan is to remove it entirely, since the modal already shows everything.

4. `src/hooks/useModuleNavigation.ts` — no changes; still used for in-app `navigate()`.

### Non-goals

- No auth/session refactor. The multi-origin serving of the app is a platform reality; the fix is to stop relying on new tabs for authenticated navigation.
- No changes to the Cards/List toggle or the modal contents.

## Verification

- Playwright: sign in, open a customer card and a list row — both open the modal, no `window.open` fires, no new tab appears.
- Grep confirms no remaining `window.open(` calls in the CRM surfaces except `tel:` / `mailto:` (which are safe).
- Manual: with a stale session on the sibling origin, confirm no path in CRM navigates cross-tab.

## Follow-up (optional, not in this change)

If you want a genuine "open in new tab" later, the safe pattern is:
- Only render it when `window.location.origin` matches your canonical production origin (e.g. `app.exotiq.ai`), never inside the editor preview.
- Never inside the Lovable editor iframe.
- Still uses same-origin only — no token passing through URLs.

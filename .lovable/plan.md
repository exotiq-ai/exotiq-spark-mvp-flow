## Goal
Make the CRM customer card show real ID verification detail + verification history in the Activity timeline, and confirm the Overview scroll actually works so nothing is hidden.

The user's screenshot shows a "Verification Details" header with no rows under it — jumping straight to Make VIP / Blacklist. The current code already renders an ID Verification row + Insurance row unconditionally, so what they see is a stale build (this iteration hasn't been rebuilt yet on their side). Once the app rebuilds, that block appears — but there are two real gaps worth closing now.

## Changes

### 1. Activity tab — surface verification history
Extend `src/components/crm/CustomerTimeline.tsx` to accept a new `identityEvents` prop and render Shield-icon rows for:
- Verification link sent (`identity_verifications.created_at`, status `created`)
- Retry needed (`requires_input`, uses `last_error_reason`)
- Manual review flagged (`manual_review`)
- Verified (`verified_at`, shows verified name + document expiry when present)
- Canceled / redacted (muted rows)

Fetch the rows in `CustomerProfileDialog.tsx` via a small `useEffect` on `customer.id`:
```ts
supabase.from("identity_verifications")
  .select("id,status,verified_at,document_expiry,verified_name,last_error_reason,attempt_count,created_at")
  .eq("customer_id", customer.id)
  .order("created_at", { ascending: false })
```
Pass the results into `CustomerTimeline` alongside bookings + notes. Sort merged events by date. Empty state stays as-is.

### 2. Overview tab — make the ID block harder to miss + confirm scroll
- Move the "Verification Details" section directly under the stat cards (above Contact Information) so it's visible without scrolling. This is the highest-signal block on the card.
- Add a small helper row under the ID line that summarises: "Last activity: {relative time}" pulled from the same identity_verifications fetch, so operators know when the last attempt happened without switching tabs.
- Keep the existing `flex flex-col` / `min-h-0 overflow-y-auto` scroll wiring on Overview — already correct in code; the user's screenshot predates the last deploy.

### 3. No backend changes
- No migrations, no edge function edits, no schema changes.
- `identity_verifications` already has team-scoped RLS via the customer's team; authenticated members can select their own team's rows.

## Files touched
- `src/components/dialogs/CustomerProfileDialog.tsx` — reorder Overview blocks, add identity_verifications fetch, pass to timeline.
- `src/components/crm/CustomerTimeline.tsx` — new `identityEvents` prop + rendering.

## Out of scope
- No insurance verification logic (that's the next workstream).
- No changes to bell notifications, webhook, or edge functions — those already ship verified / retry / manual_review events.
- No layout changes to Bookings / Notes tabs.

## Verification
- Open Gregory IDV Ringler in CRM → Overview shows Verification Details near the top with the green "Verified" badge, verified name, and document expiry.
- Switch to Activity → verification link sent + verified events appear in the timeline, interleaved with bookings/notes.
- Resize dialog / mobile viewport → Overview scrolls end-to-end (VIP / Blacklist / Delete reachable).
- Typecheck clean.

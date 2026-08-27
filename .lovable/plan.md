# Hide a vehicle from the public booking site

## Verdict: good idea, and the backend already supports it

Two flags already exist on each vehicle and the public read paths already honour them:

- `marketplace_visible` — the master switch. When false, `is_marketplace_vehicle` returns false, so the car disappears from the catalog **and** its direct link and quote/booking RPCs stop working.
- `marketplace_unlisted` — added 18 Aug. Hides the car from the public catalog list, but a direct link still quotes and books.

What's missing is only the tenant-facing UI: today those flags can be changed only from Super Admin. So this is a UI feature, not a new system — no schema change needed.

One correction to the framing: this should **not** behave like Out of Order. Out of Service is an operational state that blocks *all* bookings including yours. Listing visibility is a sales decision that changes nothing internally. Keeping them visually and physically separate is exactly right.

## Where it goes

Inside **Edit Vehicle**, as its own bordered section titled **Public booking site**, placed after Location and before Ownership — away from the Status dropdown and nowhere near the quick-status controls on the card.

Three radio options, one clear state at a time:

| Option | Effect |
|---|---|
| **Listed** (default) | Shows in your public catalog, bookable online. |
| **Link only** | Hidden from the catalog; anyone with the direct link can still book. Sets `marketplace_unlisted = true`. |
| **Hidden** | Removed from the public site entirely; direct links stop working. Sets `marketplace_visible = false`. |

Under it, one line of plain-language help and a reminder that this has no effect on internal bookings, the calendar, or availability.

## Guardrails

- The whole section only renders when the team is actually live on the public marketplace; otherwise it shows a single muted line ("Your public booking site isn't live yet") so there's no false affordance.
- Only Owner/Admin/Manager can change it — Staff and Viewer see the current state read-only, matching how other commercial settings are gated.
- A database trigger blocks re-listing when the team's platform fee isn't confirmed. If a save is rejected, the dialog surfaces the reason in plain English instead of the raw error.
- Changing visibility does not touch existing bookings, and a car with active reservations can be hidden — a short confirmation notes the current renters are unaffected.

## Fleet card signal

A vehicle that isn't fully Listed gets a small neutral (not amber, not red) chip on its fleet card — "Link only" or "Not public" — so the state is visible at a glance without another control. Purely informational; the chip isn't clickable, so nobody can flip listing state by accident. Out of Service keeps its existing amber treatment, and the two never share a colour.

## Technical notes

- `src/components/dialogs/EditVehicleDialog.tsx` — new section, local state for the three-way choice, mapped to `marketplace_visible` / `marketplace_unlisted` in the existing `updates` diff so nothing writes unless the value changed.
- Team live-state comes from the same `teams.marketplace_visible` + `marketplace_request_status === 'approved'` check used in `src/components/dashboard/settings/MarketplaceSection.tsx`.
- `src/components/fleet/FleetVehicleCard.tsx` — read-only chip derived from the two flags.
- Error surfacing reuses the existing error Alert in the dialog; the fee-confirmation trigger message gets a friendly rewrite.
- No migration, no RLS change, no edge function change. `marketplace_unlisted` is already in the generated types.

## Verification

- Hiding a car removes it from `public_team_fleet` for that team; a "Link only" car stays absent from the list but still resolves by slug.
- Internal booking creation for a hidden car still works.
- A Viewer sees the state but cannot change it.

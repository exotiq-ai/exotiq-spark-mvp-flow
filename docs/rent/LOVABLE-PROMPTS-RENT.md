# Lovable Prompts — Renter App Backend (M2 + M3)

Written 2026-07-16 after PRs #20/#21/#22 merged to main. Paste into Lovable
one at a time, top to bottom. Wait for each to complete and report before
sending the next. Per decision D3, this file is the tracking record of
backend changes Lovable is asked to apply for the renter marketplace.

> **STATUS 2026-07-16:** Prompts 1–4 are DONE (applied via the amended
> five-migration sequence: 20260530203000 minus the realtime block +
> 20260530224500 + the three M2/M3 files; `rent-public-media` verified
> 400/404 + visibility gate active). Remaining: the positive-path test
> (needs Gregory to designate an opt-in team + vehicle) and Prompt 5 below,
> which is now RECOMMENDED so visibility can be managed from Settings
> instead of SQL. Prompt 6 added for awareness of the D1 fee-hardcode
> retirement.

---

## Prompt 1 — Apply the security hardening migration (M2)

```text
Do not modify any frontend code or regenerate any files in this task.

Our repo main now contains a new migration file:
supabase/migrations/20260715211500_vehicle_photos_team_rls_and_webhook_events_select.sql

Please apply this migration to the cloud database exactly as written, without
editing it. It replaces the uploader-keyed storage policies on the
vehicle-photos bucket with team-scoped policies (using the helper functions
from the 20260530203000 hardening migration), and adds a super-admin-only
SELECT policy on stripe_webhook_events.

After applying, confirm: (1) the four new vehicle-photos policies exist on
storage.objects, (2) the old "Users can view own vehicle photos" policy is
gone, (3) team members can still see their team's vehicle photos in the app,
and (4) run the security linter and report any new findings.
```

## Prompt 2 — Apply the marketplace catalog migration (M3 part 1)

```text
Do not modify any frontend code or regenerate any files in this task.

Our repo main now contains a new migration file:
supabase/migrations/20260715220000_rent_public_catalog_schema.sql

Please apply it to the cloud database exactly as written, without editing it.
It adds: vehicles.slug (with deterministic backfill and a collision-suffixing
trigger, unique per team), teams.marketplace_visible + teams.public_description,
vehicles.marketplace_visible (all defaulting to false), and the
is_marketplace_team / is_marketplace_vehicle helper functions.

After applying, confirm: (1) every vehicle row has a non-null slug, (2) no
duplicate (team_id, slug) pairs exist, (3) all marketplace_visible values are
false, and (4) creating a vehicle in the app still works and gets a slug
automatically.
```

## Prompt 3 — Apply the public read RPCs migration (M3 part 2)

```text
Do not modify any frontend code or regenerate any files in this task.

Our repo main now contains a new migration file:
supabase/migrations/20260715220100_rent_public_read_rpcs.sql

Please apply it to the cloud database exactly as written, without editing it.
It creates five SECURITY DEFINER read functions for the future public renter
marketplace (public_team_by_slug, public_team_fleet, public_vehicle_by_slug,
public_vehicle_availability, public_vehicle_quote) and grants EXECUTE to anon.
They return only safe public fields and every one of them routes through the
is_marketplace_team/is_marketplace_vehicle checks, so with all visibility
flags false they return zero rows today.

After applying, verify with the anon key: (1) select * from
public_team_by_slug('any-team-slug') returns no rows (nothing is visible yet),
(2) anon still cannot select from teams, vehicles, or bookings directly, and
(3) run the security linter and report any new findings.
```

## Prompt 4 — Confirm the rent-public-media edge function deployed

```text
Do not modify any frontend code in this task.

Our repo main now contains a new edge function at
supabase/functions/rent-public-media/index.ts, registered in config.toml with
verify_jwt = false. It returns 1-hour signed URLs for vehicle photos of a
single marketplace-visible vehicle, re-validating visibility on every call.

Please confirm it deployed from the repo sync (or deploy it), then test:
GET /functions/v1/rent-public-media?team=x&vehicle=y should return 404
"Not found" (no team is marketplace-visible yet), and a request with missing
params should return 400. Report the results.
```

## Prompt 5 — NOW RECOMMENDED: Command Center visibility toggles

```text
Add marketplace visibility controls to the Command Center. In Settings ->
Business (team level), add a toggle "List my fleet on Exotiq Rent" bound to
teams.marketplace_visible, plus a textarea "Public storefront description"
bound to teams.public_description. On the vehicle edit dialog, add a toggle
"Show on Exotiq Rent" bound to vehicles.marketplace_visible, visible only
when the team toggle is on. Both default off. Do not change any other
settings sections, do not touch booking or pricing logic, and leave all
unrelated files untouched.
```

## Prompt 7 — Verification badge polish + email-send audit (queued 2026-07-21, V4 finding)

```text
Two small fixes in the identity verification UI (VerificationSection):

1. The badge for identity_status = 'created' currently reads "Link sent",
   which is misleading — a session can be created without any email going
   out. Rename that badge to "Link created". Show "Link sent" only as a
   confirmation after the "Email to customer" action actually succeeds.

2. Audit the "Email to customer" action on the Verify ID flow: confirm it
   actually sends an email (e.g. via the existing Resend pipeline) rather
   than being a placeholder. If it is a placeholder, wire it to send the
   hosted verification link with a short branded message, and report what
   you wired. Do not touch the identity edge functions or any migration.
   Leave unrelated files untouched.
```

## Prompt 6 — Awareness only (no action): D1 fee hardcode retired

```text
Heads-up, no code changes requested: per the decision register
(docs/rent/DECISIONS.md, D1), the hardcoded 20% marketplace application fee
in create-payment-checkout and stripe-create-hold has been removed in the
repo — these operator-side functions now never attach an application fee.
The Exotiq renter booking fee (10% of rental subtotal, charged to the renter
separately) will be implemented in the renter payment flow later (M6).
These functions redeploy automatically from the repo sync. Please do not
reintroduce application_fee_amount to either function in future edits.
```

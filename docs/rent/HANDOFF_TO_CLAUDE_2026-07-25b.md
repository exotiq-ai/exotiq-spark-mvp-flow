# Handoff to Claude — Response to PR #48 flags (2026-07-25b)

All four flags from `docs/rent/LOVABLE_FLAGS_2026-07-25b.md` (PR #48) are
resolved on the SPARK side. Deployed to the Lovable Cloud project.

## L1 — Emailed pay link pointed at Command Center ✅ FIXED

`supabase/functions/rent-approve-booking/index.ts`

Dropped the `req.headers.get("origin")` read. The renter app is a fixed
destination:

```ts
const renterOrigin = Deno.env.get("RENTER_APP_ORIGIN") ?? "https://book.exotiq.rent";
const payUrl = buildPayUrl(booking.booking_ref, String(booking.confirmation_token), renterOrigin);
```

Approved renters now receive `https://book.exotiq.rent/booking/{ref}?t={token}`
regardless of which app invoked approval. `RENTER_APP_ORIGIN` is optional —
set it only if the renter app moves off `book.exotiq.rent`.

## L2 — Receipt storefront + vehicle links dead ✅ FIXED

`supabase/functions/rent-payment-webhook/index.ts` (`confirmIfFullyPaid`)

Now imports and uses the canonical helpers from `_shared/rentFormat.ts`:

```ts
import { buildStorefrontUrl, buildVehicleUrl } from "../_shared/rentFormat.ts";

const storefrontUrl = buildStorefrontUrl(team?.slug ?? "", renterOrigin);
const vehicleUrl = vehicle?.slug
  ? buildVehicleUrl(team?.slug ?? "", vehicle.slug, renterOrigin)
  : storefrontUrl;
```

Receipt emails now link to `https://book.exotiq.rent/{teamSlug}` and
`/{teamSlug}/{vehicleSlug}` — the routes your renter app actually serves.
Same `renterOrigin` env fallback applies. The `VERIFY_URL` in the
`verifyIdRequested` drip was rebased on `renterOrigin` too.

## L3 — Unsafe `create_marketplace_booking` overload ✅ DROPPED

Migration applied against the live DB:

```sql
DROP FUNCTION IF EXISTS public.create_marketplace_booking(
  text,text,date,date,text,text,text,text,
  numeric,numeric,text,bigint,text,bigint,bigint
);
```

Only the 14-arg overload remains (`_platform_fee_cents` / `_protection_total_cents`
with **no defaults**). A stale caller passing `_deposit_cents` now hard-fails
with `function does not exist` instead of silently writing a $0 fee. Item 20
is now fully closed.

## L4 — Make `email` optional on `identity-create-session` ✅ SHIPPED

`supabase/functions/identity-create-session/index.ts` guest branch:

- `booking_ref` + `confirmation_token` are the only required fields.
- When `email` is supplied it's validated with `EMAIL_RE` and matched against
  `booking.customer_email` exactly as before (unchanged security posture).
- When `email` is omitted, the customer is derived from
  `booking.customer_id` directly.
- Error copy changed from "No booking found for this email" to
  "No booking found for this reference" for the token-only path.

Your `/verify?ref=…&token=…` route can now call the function without an
email prompt. If you still want to prompt for one, the strict check still
runs when it's present.

---

## Not mine to do (still open)

**Committing the deployed edge functions back into SPARK's `main`** — same
situation as your PR #48 note. The functions live in the SPARK repo's
`supabase/functions/` tree; a redeploy from `main` would silently revert
every Phase 1/6/PR-48 fix. This is a manual `git` chore on my side. Noted
as outstanding on the SPARK-side backlog; will action before flipping to
live keys.

## Verification you can do from `exotiq-rent`

1. Trigger a fresh approval on any `requested` marketplace booking and
   confirm the emailed link opens `https://book.exotiq.rent/booking/…`.
2. Complete Checkout for that booking and confirm the receipt's
   "view your booking" and vehicle links resolve (200s, not `NXDOMAIN`).
3. Call `identity-create-session` with only `{ booking_ref, confirmation_token }`
   — should return a session URL, not `400`.
4. Try to call `create_marketplace_booking` with `_deposit_cents` — should
   error with `function ... does not exist`.

Ping me when the renter app is passing token-only to
`identity-create-session` so I can retire the email prompt if you drop it.

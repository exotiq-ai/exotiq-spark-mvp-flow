## What's left before Claude can flip the marketplace on

Since the handoff doc was written, two of the three blockers are gone:

- **Booking endpoint (was gap #1):** `rent-create-booking` edge function + `create_marketplace_booking` RPC shipped this afternoon (M5). Marketplace lifecycle statuses (`requested`, `pending_documents`, `pending_payment`, `declined`, `refunded`) are live in the DB and now render correctly in the operator UI.
- **Fee mismatch (was gap #2):** the 20% hardcoded application fee was ripped out of `create-payment-checkout` and `stripe-create-hold` today (D1). Exotiq's `platform_fee_percent = 0` is now internally consistent.

That leaves a short list before Claude's renter UI can drive a real end-to-end booking on Exotiq:

### Must-do (blocks a real booking)

1. **Publish `rent-create-booking` contract to Claude.** Write a one-pager (endpoint URL, required body, response shape, error codes, status-lifecycle diagram) and append it to `docs/rent/MARKETPLACE_TESTING_HANDOFF.md`. Claude's UI can't call it without this.
2. **Wire the confirmation page path.** M5 gave every booking a `confirmation_token`, but there is no public read endpoint yet. Add a `public_booking_by_ref(_ref, _token)` RPC or `rent-booking-status` edge function that returns a redacted booking view for the renter's post-checkout page. Without it, the renter has nothing to land on after Stripe redirects back.
3. **Hero-image coverage on Exotiq.** 30 of 52 marketplace-visible vehicles still have no hero image. Either (a) filter `hero_image_url IS NOT NULL` server-side in `public_team_fleet` behind a flag so Claude's cards never render blank, or (b) seed hero images. Option (a) is a 10-minute RPC edit and unblocks Claude immediately; (b) is the real fix but slower.

### Should-do before real money moves (can happen in parallel with Claude's UI work)

4. **Server-side overlap check inside `rent-create-booking`.** The new partial GiST exclusion covers marketplace-vs-marketplace, but a marketplace booking can still collide with an operator-created booking (different `booking_source`). Add an explicit overlap query against all blocking statuses inside the RPC transaction before insert.
5. **Identity-verification gate in `rent-create-booking`.** Reject the call unless a `customers.identity_status = 'verified'` row exists for the renter email. This is the "tomorrow, ID checks + payment flow" work you already flagged — noting it here so we don't forget it's the gate on this endpoint specifically, not a separate feature.
6. **Grep sweep for stray fee references.** Confirm no other function or client path re-introduces `application_fee_amount` for marketplace. Fast; closes out D1 for good.

### Nice-to-have (not blocking flip-on)

7. Sitemap / SEO for marketplace pages once Claude picks the URL structure.
8. Rate-limiting on the anon RPCs (currently unbounded).
9. `rent-create-booking` telemetry (structured logs for quote-mismatch, availability-race, identity-reject).

### Suggested order for tomorrow

```text
morning:   1  Publish endpoint contract           (unblocks Claude)
           3a Hero-image server-side filter       (unblocks Claude)
           2  Confirmation-page RPC               (unblocks Claude)
afternoon: 5  Identity gate in rent-create-booking (ties into ID-check work)
           4  Overlap check in rent-create-booking
           6  Fee grep sweep
```

Items 1, 2, 3a are the actual "Claude can flip it on" set. 4/5/6 pair naturally with the ID-check + payment-flow session you already have on tomorrow's calendar.

### Technical notes

- Confirmation RPC signature I'd propose: `public_booking_by_ref(_booking_ref text, _confirmation_token uuid) returns json` — matches the pattern of the other `public_*` RPCs, `SECURITY DEFINER`, locked `search_path`, returns only renter-safe columns (dates, vehicle name, totals, status, team brand).
- Hero-image filter: add `_require_hero boolean default false` arg to `public_team_fleet` rather than a hard filter, so we can turn it off once photos are seeded.
- Identity gate: check `customers.identity_status` on the row matched by lowercased email + team_id; return a typed error (`identity_required`) so Claude's UI can route to Stripe Identity before retrying.
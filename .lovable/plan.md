## BK-03456 Smoke Test + Hero Image Public Bucket Flip

### Part 1 — Approval smoke test (BK-03456)

1. Read current state of BK-03456 to confirm `status = 'requested'` and capture baseline (`payment_due_at`, `confirmed_at`, `identity_verified`).
2. Invoke `rent-approve-booking` with the booking id.
3. Re-read the row and verify:
   - `status = 'pending_payment'`
   - `payment_due_at ≈ now() + 48h`
   - `confirmed_at IS NULL`
   - `payment_approved_at` set
4. Check `email_send_log` (or Resend log via edge function) for the `paymentApproved` send to the renter, and confirm Reply-To resolves to the Exotiq team `support_email` (`support@exotiq.ai`).
5. Sanity-check the guard trigger: attempt a direct `requested → confirmed` update in a transaction and confirm it's rejected (rollback).

### Part 2 — Hero image public bucket flip (H1 close-out)

1. Flip `vehicle-photos` bucket to public via `storage_update_bucket`.
2. Update `generate-hero-image` (and any sibling writers) to return `getPublicUrl(...)` instead of signed URLs; remove the 7-day TTL workaround.
3. Backfill: replace existing `hero_image_url` values that point to signed URLs with public URLs for the same object path.
4. Verify `public_team_fleet.hero_image_url` returns stable public URLs (no `token=` query param, no expiry).
5. Spot-check one marketplace vehicle page loads the hero image.

### Rollback

- Approval test: if anything looks off, revert BK-03456 back to `requested` and clear `payment_due_at` / `payment_approved_at`.
- Bucket flip: if public URLs misbehave, flip bucket back to private and restore signed-URL generation in `generate-hero-image`.

### Reporting

Post a short results block: booking state before/after, email send id + resolved Reply-To, trigger-guard result, bucket visibility, and one sample public hero URL.

# Red-Team Fixes + Saucy Tenant Sunset

Backend/Lovable Cloud only. Test mode throughout. Ordered by the work order's own priority.

## 0. Sunset Saucy Rentals (immediate, reversible)

- Data update via insert tool: `UPDATE teams SET marketplace_visible=false WHERE slug='fredo-d-lima'`.
- Verify: `public_team_by_slug('fredo-d-lima')` returns empty; `public_team_by_slug('exotiq')` still returns Exotiq.

## 1. Persistent rate limiting (pre-launch) — items #1

Replace per-isolate `Map` limiter across `rent-create-booking`, `rent-checkout`, `rent-cancel-booking`.

- Migration: new table `public.rate_limit_counters(bucket text, window_start timestamptz, count int, primary key(bucket, window_start))` + `check_rate_limit(_bucket text, _limit int, _window_seconds int)` SECURITY DEFINER function that upserts current window row, increments, returns boolean allow. GRANT execute to `service_role` only. Add a small janitor (delete rows older than 1 day) called opportunistically.
- Update the three edge functions: replace `allowRequest` with an RPC call to `check_rate_limit` using bucket `"<fn>:<ip>"`. Same 20/hr default on create-booking; pick tighter limits for checkout (e.g. 30/hr) and cancel (e.g. 20/hr). Fail-open on RPC error but log.
- Turnstile: request `CLOUDFLARE_TURNSTILE_SECRET` via add_secret; in `rent-create-booking`, require `turnstile_token` in body, verify server-side against `https://challenges.cloudflare.com/turnstile/v0/siteverify`, 400 on failure. Ship the server-side check now; front-end widget wiring will be a follow-up on the exotiq-rent repo (out of scope here) — noted in response.

## 2. Availability status-set alignment (pre-launch) — item #2

Decision to encode: **unverified holds (`requested`, `pending_documents`) DO block public availability** — matches the transactional create's overlap check and prevents the "green calendar → 409 at submit" trap.

- Migration updates `public_vehicle_availability` RPC so busy set = same statuses `create_marketplace_booking` blocks on (currently includes `requested`, `pending_documents`, `confirmed`, `active`, etc.). Read current function body first, then rewrite to share a single status list.
- New auto-expiry: function `expire_unverified_holds()` deletes/cancels `requested`/`pending_documents` bookings older than 4h with no payment intent, mirroring `expire_overdue_payment_bookings`. Register a `pg_cron` job every 15 min via the insert tool (contains project URL + anon key, per rules).

## 3. Confirm/register payment-scheduler cron — item #3

- Query `cron.job` via `supabase--read_query` (schema requires elevated access — use the DB read tool, not psql).
- If missing, register with `cron.schedule` posting to `/functions/v1/rent-payment-scheduler` every 15 min with `x-cron-token` header (secret already used by the function). Use insert tool since it contains project-specific URL/keys.
- Verify one clean run in edge function logs after registration.

## 4. Reject unknown protection tiers — item #4

- Edit `supabase/functions/rent-create-booking/index.ts` line 85–87: if `body.protection` is present and not in `{premium, standard, decline}`, return 400. Only default to `premium` when the field is absent/empty.
- Redeploy the function.

## 5. Opaque booking references — item #5

Choice: **require the confirmation token for `public_booking_by_ref` reads** (lower blast radius than changing the ref format, no client changes since the confirmation URL already carries the token).

- Migration: alter `public_booking_by_ref` to require `_token uuid` and return empty when it doesn't match `bookings.confirmation_token`. Keep the column set unchanged.
- Grep for callers in edge functions; update any server callers to pass the token. Client (renter app) already appends `?token=` on confirmation links.

## 6. Shorten hero-image signed-URL TTL — item #6

- Alter `public_team_fleet` RPC to sign hero URLs at 3600s (1h), matching `rent-public-media`. Trade-off: signed URLs will expire in browser tabs left open past an hour; acceptable given the renter session length.

## Verification pass (after apply)

- `public_team_by_slug` before/after for both slugs.
- Fire 25 rapid `rent-create-booking` calls; expect 429 after threshold.
- Two overlap probes: `public_vehicle_availability` vs `create_marketplace_booking` return the same busy dates.
- `protection:"free_lol"` → 400.
- `public_booking_by_ref('BK-…')` with wrong token → empty.
- `cron.job` shows both scheduler + unverified-holds jobs `active=true` with recent successful runs.

## Out of scope (call out, do not touch)

- Renter web-app Turnstile widget install (exotiq-rent repo).
- Any live-mode Stripe changes.

## Technical notes

- Insert-tool vs migration split: schema/RPC/policy changes → migration; cron registrations that embed the project URL + anon key → insert tool per project rules.
- All new tables get GRANT + RLS in the same migration.
- `check_rate_limit` is SECURITY DEFINER, `service_role`-only GRANT, no anon path.

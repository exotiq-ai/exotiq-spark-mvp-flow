## Decisions locked
- **C.** Platform fee → set `teams.platform_fee_percent = 10` for Exotiq (consistent with D1/D9).
- **D.** Publishable key `pk_live_51S30O7HO7nC3pJiP...` — **valid and correct.** The account prefix (`S30O7HO7nC3pJiP`) matches the platform Stripe account `acct_1S30O7HO7nC3pJiP` ("Exotiq Inc"), which is the same account that mints Identity VerificationSessions via `STRIPE_IDENTITY_SECRET_KEY`. Safe to hand to Claude for the renter app's `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

## Plan

### 1. Single data update on the Exotiq team
One `UPDATE` on `public.teams` where `id = c1de6533-ab44-4973-a123-007a8007b5ba`:
- `slug = 'exotiq'` (drop trailing hyphen)
- `name = trim(name)` (removes the trailing space that regenerates the bad slug)
- `timezone = 'America/Phoenix'` (Scottsdale, no DST)
- `platform_fee_percent = 10`

### 2. Verify
- `SELECT slug, name, timezone, platform_fee_percent FROM teams WHERE id = '…';`
- `SELECT * FROM public_team_by_slug('exotiq');` returns the Exotiq row.
- `SELECT platform_fee_percent FROM public_vehicle_quote(...)` on one Exotiq vehicle returns `10.0`.

### 3. Confirm to Claude
- Slug is `exotiq`; they can drop the `/exotiq → /exotiq-` 307 redirect and set `NEXT_PUBLIC_DEFAULT_TEAM_SLUG=exotiq` on Netlify.
- Timezone fixed to `America/Phoenix`.
- Platform fee now 10% on Exotiq quotes.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_51S30O7HO7nC3pJiP...` is validated against the Exotiq Inc Stripe account and matches the Identity secret key's account — embedded Identity modal will work.
- Photos (item 3) and marketplace_test_mode awareness (item 6) already resolved; no action.

### Risk / rollback
- Slug change breaks any external link using the old `exotiq-` string. Claude's temporary 307 covers the transition; we can also keep both working by leaving the 307 in place until they confirm.
- Fee change affects only quotes generated after the update. No existing bookings mutate.

## Technical notes
- Uses the `supabase--insert` tool (data update, not schema).
- No code changes required in this repo — every surface already reads `teams.platform_fee_percent`, `teams.timezone`, and `teams.slug` dynamically.
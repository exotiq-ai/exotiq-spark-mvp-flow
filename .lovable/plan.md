## Goal

Write a single downloadable markdown artifact (`/mnt/documents/exotiq-ecosystem-context-response.md`) addressed to Avi/Codex. It is a **discovery/context response**, not a build instruction — same framing as the doc they sent.

## Structure

1. **Header / framing** — restate that this is advisory context, not approval to ship, and that nothing in §23 ("What Lovable Should Not Do") is touched.

2. **Section A — Confirmed accurate**
   What the v2 doc correctly captured from our prior corrections:
   - `teams` as canonical entity, `teams.slug` already unique
   - existing booking statuses (`pending, confirmed, active, completed, cancelled, declined`) + payment statuses
   - missing marketplace lifecycle states (`requested`, `pending_documents`, `pending_payment`)
   - deposit ownership rule (operator-only, never platform revenue)
   - broker fee = 10% of operator daily rate only
   - hero photo precedence
   - `booking_ref` use in public confirmation routes
   - PII-minimized availability RPC contract
   - rate limiting requirement on public RPCs
   - signed URL TTL ≤1h, no embed in SSR caches
   - `exotiq.rent` origin handling on Stripe + upload functions
   - webhook routing decision before adding renter event types
   - duplicate `customers` across teams accepted by design
   - `marketplace_renter_intent` intermediate object
   - audit row tagging `source = 'marketplace'`
   - shared `public.is_marketplace_visible(team_id)` helper
   - hardcoded `0.20` is in `stripe-create-hold` (not a final product decision)

3. **Section B — Answers to the 14 review questions in §22**
   Direct, short answers each (2–4 lines), no rebuild of full rationale. Key positions:
   - Q2: yes, `teamSlug` everywhere in code/contracts; renter copy can still say "operator/host"
   - Q4: SECURITY DEFINER RPCs are the right primitive; public views are a fine secondary layer for purely static fields (team profile, vehicle marketing fields). Avoid loosening base-table RLS.
   - Q5: keep core operational columns on `teams`; put public marketing/policy fields in a new `team_public_profile` to keep the public surface narrow and reviewable.
   - Q6: public vehicle eligibility rule (concrete predicate).
   - Q7: short-lived signed URLs via edge function; if SEO needs stable URLs, derive a public/optimized image into a deliberate public bucket — never proxy private originals.
   - Q8: add `bookings.marketplace_substate` rather than expanding the main status enum — avoids breaking operator UI switches.
   - Q9: guest checkout for v1; design renter auth-ready (anonymous → claim flow), don't build it now.
   - Q10: minimum `protection_products` + `booking_protection` shape (4–6 columns each).
   - Q11: Stripe sequencing — operator destination charge for rental (with 10%-of-daily-rate `application_fee_amount`), separate operator-side manual-capture PI for deposit, separate platform-account PI for Protection if approved.
   - Q12: two charges is a UX/legal call; recommend single combined operator charge with internal split via `application_fee_amount` unless legal requires a distinct Exotiq line item — flag for Gregory.
   - Q13: missing risks — Supabase project ref baked into anon-key consumers, edge-function CORS allowlists, Resend sender domain, GCal OAuth redirect, ElevenLabs widget origin.
   - Q14: yes, CI linter for SECURITY DEFINER functions — recommend a simple regex/AST check in a migration review script.

4. **Section C — Remaining mismatches / things to flag for Gregory**
   - Broker fee math contradiction: §14 says "10% of operator daily rate only" but §11 lists `total_value` as the snapshot source — clarify that `platform_fee_base` must be `daily_rate × billable_days` only, excluding delivery/gas/mileage/discount/deposit. Confirm whether existing `compute_rental_base()` (which we already implemented for the Margin module) is the canonical implementation Exotiq Rent should align to.
   - Deposit handling: Exotiq Rent quote adapter must not even surface deposits in any Exotiq-revenue context; recommend the quote response split into `operator_charges`, `operator_hold`, `platform_charges` so the frontend can't accidentally combine them.
   - `vehicles.slug` uniqueness scope: confirmed unique per `team_id`, but reserve a small denylist (admin, api, preview, booking) so vehicle slugs can't collide with future top-level marketplace routes.
   - Protection presentation: if Protection is charged to platform account, renter sees two statement descriptors; recommend a single operator charge with platform fee split unless legal requires separate.
   - Auto-confirm setting: `teams.settings->>'auto_confirm_marketplace_bookings'` is fine for v1, but recommend a per-vehicle override (`vehicles.settings->>'auto_confirm'`) since high-value cars typically need manual review.
   - Renter document upload: recommend `renter-upload-document` also write a hash/fingerprint so the same passport/license re-uploaded across operators can be detected later when the global `renters` table arrives.

5. **Section D — What Lovable will and will not touch next**
   Mirror their §23 — restate explicitly that no migrations, RLS changes, RPCs, edge functions, Stripe edits, or protection tables will be written until Gregory issues a scoped prompt with acceptance criteria.

## Style/formatting

- Plain markdown, no backticks-inside-text-prose issues, proper fenced code blocks for any SQL/route snippets, no emoji.
- Match the tone of the v2 doc: declarative, non-promotional, "discovery/context" framing.
- Output path: `/mnt/documents/exotiq-ecosystem-context-response.md`
- After writing, emit a `<presentation-artifact>` tag so Gregory can download/forward to Avi.

## Not in scope

- No code changes
- No migrations
- No edge function edits
- No memory updates (this is a doc deliverable, not a project decision)

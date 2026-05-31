# Lovable Staging Review Handoff

Lovable should review only the restored staging app after Codex/Claude completes
the technical restore and smoke tests.

## Review Goal

Evaluate whether the restored staging app feels correct from a UI/product
perspective. Do not change database, backend, auth, Stripe, Edge Function, cron,
or migration code.

## Lovable Should Review

- Dashboard
- Booking create/edit/cancel flow
- CRM customer create and customer detail screens
- Vault document upload, preview, and download
- Fleet vehicle detail and photo display
- Rari booking and vehicle lookup
- Settings and team/admin surfaces
- Mobile dashboard, bookings, fleet, and Rari

## Lovable Deliverable

Return:

1. UI bugs or broken visual states.
2. Confusing or duplicate screens.
3. Product-flow concerns.
4. Screens that appear stale or unfinished.
5. Recommended E2E priority order.

## Lovable Must Not Edit

- Supabase migrations
- RLS or storage policies
- Auth export/import
- Storage migration scripts
- Edge Functions
- Stripe backend
- Cron jobs
- Old PRs #1-#5

Any backend/security finding should be sent back to Codex/Claude as a technical
handoff.


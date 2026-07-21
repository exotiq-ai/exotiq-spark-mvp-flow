## Review

**Migration file** `supabase/migrations/20260721180000_identity_verifications.sql` — 70 lines, additive:

1. `CREATE TABLE public.identity_verifications` — session ledger, FK to `customers` with `ON DELETE CASCADE`, status CHECK constraint (7 values), unique on `stripe_verification_session_id`, index on `customer_id`.
2. `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS identity_session_id TEXT / identity_status TEXT` — nullable, no backfill.
3. `set_identity_verification_updated_at()` trigger function + BEFORE UPDATE trigger — `SET search_path = public`, correct pattern.
4. RLS enabled on new table + single SELECT policy scoped through `customers` via `is_team_member_of_record(auth.uid(), c.team_id)` (helper exists in cloud, confirmed earlier in drift work). No INSERT/UPDATE/DELETE policies — writes are intentionally service-role only from the two edge functions.

**Edge functions consuming the schema** (already in repo, verified):
- `identity-create-session` — service-role insert into ledger, updates `customers.identity_session_id / identity_status`. Operator path checks team membership; guest path re-derives customer by email (never trusts client-supplied ids).
- `identity-session-status` — read-only status by session id.
- `identity-webhook` — service-role updates ledger status, stores only verified name + document expiry (no PII beyond DPA 3.8), notifies team on 3rd-attempt manual review.

Behavioral test stub `scripts/rls-verify/test_idv.sql` exists and asserts: check constraint rejects bad status, updated_at trigger fires, same-team member reads, cross-team sees zero, client INSERT/UPDATE blocked.

## Safety findings

1. **Additive** — no drops, no data mutation, all `IF NOT EXISTS` guards. Safe to run on live prod.
2. **Dependencies present in cloud** — `public.is_team_member_of_record` was confirmed live in the earlier drift work; `public.customers` exists.
3. **One deviation from project rules to flag**: the migration file does **not** contain explicit `GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_verifications TO authenticated / service_role` statements. In this project the hardening migration `20260530203000` granted defaults broadly, and the test stub adds grants post-migration — so PostgREST should still reach the table for the SELECT policy. Per project instructions I would normally add them in the same file, but the user explicitly said "Do not modify RLS beyond what the file contains" — I'll respect that and instead **verify authenticated has SELECT** after apply; if it doesn't, I'll report it as a follow-up rather than silently amend.
4. Linter delta expected: possibly +1 INFO if grants missing; otherwise net zero new warnings.

## Plan

Sequential, verify after each step. Do not modify frontend code.

1. **Apply** `20260721180000_identity_verifications.sql` verbatim via the migration tool.
2. **Post-apply verification** via read_query:
   - `identity_verifications` table exists with correct columns + CHECK constraint + unique index.
   - `customers.identity_session_id` and `customers.identity_status` columns present, nullable.
   - Trigger `trg_identity_verifications_updated_at` exists.
   - RLS enabled; exactly one SELECT policy present; zero INSERT/UPDATE/DELETE policies.
   - Grants on `identity_verifications` — check `information_schema.role_table_grants` for `authenticated` and `service_role`. If `authenticated` lacks SELECT, flag it (do NOT amend without approval).
3. **Run security linter** and report delta vs current baseline.
4. **Drift-report style output** — Applied ✅ / Failed ❌, verification results, linter delta, any follow-ups.

No frontend changes. No RLS changes beyond what the file contains. No touching the edge functions.
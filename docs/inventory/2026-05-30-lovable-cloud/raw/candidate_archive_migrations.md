# Candidate archive/remove — stale repo migrations (DO NOT DELETE YET)

These 14 files exist in `supabase/migrations/` but have **never been applied** to the live database (verified against `supabase_migrations.schema_migrations`, 2026-05-30, ±10s fuzzy match).

**Do not delete.** Some may have been authored by Codex / Claude / Cursor sessions outside Lovable and may still represent intent that has not yet shipped. Hand off to Codex for review before any cleanup action.

## Short-timestamp / legacy format (12)

| Filename | Notes |
|---|---|
| `20250101000000_add_rari_feedback_indexes.sql` | Pre-bootstrap, never applied |
| `20250102000000_create_rari_conversations.sql` | Pre-bootstrap; live `rari_conversations` table was created via a later Lovable migration |
| `20250102000001_create_rari_action_items.sql` | Pre-bootstrap |
| `20250103000000_add_banner_white_label_fields.sql` | Pre-bootstrap; banner fields are present in live, likely added via later migration |
| `20260101194000_auto_assign_role_to_new_users.sql` | Live has `auto_assign_user_role()` function — confirm equivalence before removing |
| `20260103000000_create_super_admin_system.sql` | Live has `super_admins` table + `is_super_admin()` — likely superseded |
| `20260103000001_seed_first_super_admin.sql` | Seed data; live has 2 super_admins rows — verify seed already happened |
| `20260103000002_update_rls_for_super_admin.sql` | Policy update; verify live policies match intent |
| `20260103000003_update_existing_rls_for_super_admin.sql` | Policy update; verify live policies match intent |
| `20260128000000_*.sql` | Verify contents |
| `20260129000000_*.sql` | Verify contents |
| `20260319205000_*.sql` | Sibling of applied `20260319204959`; verify whether superseded or never run |

## Non-14-digit-prefix format (2)

| Filename | Notes |
|---|---|
| `20260102_fix_role_based_policies_comprehensive.sql` | Non-standard prefix — the Supabase CLI would refuse to apply it |
| `20260108_*.sql` (if present) | Same |

## Recommended next step

Open each file, diff against the live schema/policies/functions, and for each one decide:

1. **Archive** — Move to `supabase/migrations/_archive/` with a note explaining why it was superseded.
2. **Apply** — If the migration represents real intent not yet in live, rename to a fresh timestamp and apply via the migration tool.
3. **Delete** — Only after Codex confirms it is fully redundant with what is already live.

No action should be taken until Codex sign-off.

# Security findings — exact affected policies/tables

Pulled live from `pg_policies` on 2026-05-30. Each section quotes the policy verbatim and explains the gap.

---

## 1. `customer-documents` bucket — no team scoping, no per-user folder scoping

**Bucket:** `customer-documents` (private). **Schema:** `storage.objects`.

| Policy | CMD | USING / WITH CHECK |
|---|---|---|
| `Users can view their customer documents` | SELECT | `bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL` |
| `Users can upload customer documents` | INSERT | (with_check) `bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL` |
| `Users can update their customer documents` | UPDATE | `bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL` |
| `Users can delete their customer documents` | DELETE | `bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL` |

**Gap:** Every authenticated user in any team can SELECT/UPDATE/DELETE every customer document in the bucket. No `team_id` scoping, no `storage.foldername(name)[1] = auth.uid()`, no join to `customers.team_id`.

**Fix shape:** Encode `<team_id>/<customer_id>/...` as the object path and gate every policy on `(storage.foldername(name))[1]::uuid IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active)`, mirroring the `expense-receipts` policies which already do this correctly.

---

## 2. Unscoped `has_role()` — cross-team admin escalation

`has_role(_user_id, _role)` only checks `user_roles.role`. It does NOT take a `team_id`. Any policy gated solely on `has_role(auth.uid(), 'admin')` lets an admin of Team A act on Team B's rows.

**Affected policies on these tables:**

| Table | Policy | CMD | Snippet |
|---|---|---|---|
| `profiles` | `Users can view own or admin can view all profiles` | SELECT | `(auth.uid() = id) OR has_role(auth.uid(), 'admin')` |
| `user_roles` | `Users can view own role` | SELECT | `(user_id = auth.uid()) OR has_role(auth.uid(), 'admin')` |
| `user_roles` | `Admins can insert roles` | INSERT | `has_role(auth.uid(), 'admin')` |
| `user_roles` | `Admins can update roles` | UPDATE | `has_role(auth.uid(), 'admin')` |
| `user_roles` | `Admins can delete roles` | DELETE | `has_role(auth.uid(), 'admin')` |
| `user_invitations` | `Admins can view/insert/update/delete invitations` | ALL | `has_role(auth.uid(), 'admin')` (all 4 policies) |
| `team_messages` | `Users can delete own messages` | DELETE | `(sender_id = auth.uid()) OR has_role(auth.uid(), 'admin')` |
| `team_conversations` | `Conversation creators can delete` | DELETE | `(created_by = auth.uid()) OR has_role(auth.uid(), 'admin')` |
| `conversation_members` | `cm_delete` | DELETE | `(user_id = auth.uid()) OR is_conversation_creator(...) OR has_role(auth.uid(), 'admin')` |
| `entity_comments` | `Users can delete own comments` | DELETE | `(auth.uid() = user_id) OR has_role(auth.uid(), 'admin')` |
| `role_audit_log` | `Team members can insert audit logs` | INSERT | `(team_id IN (...)) OR has_role(auth.uid(), 'admin')` ← admin fallback bypasses team filter |

**Fix shape:** Replace `has_role(auth.uid(), 'admin')` with `is_team_admin(auth.uid(), <row>.team_id)` (already exists in `public`). For tables without a `team_id` column (e.g. `profiles`, `user_roles`), join through `team_members` to find the shared team.

---

## 3. `message-attachments` bucket — no conversation scoping

**Bucket:** `message-attachments` (private, 10 MB limit). **Schema:** `storage.objects`.

| Policy | CMD | USING / WITH CHECK |
|---|---|---|
| `Users can view attachments in their conversations` | SELECT | `bucket_id = 'message-attachments' AND auth.role() = 'authenticated'` |
| `Authenticated users can upload attachments` | INSERT | (with_check) `bucket_id = 'message-attachments' AND auth.role() = 'authenticated'` |
| `Users can delete own attachments` | DELETE | `bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]` |

**Gap:** The SELECT policy's name promises "in their conversations" but the predicate only checks `authenticated`. Any signed-in user from any team can read every attachment in the bucket. There is no UPDATE policy and the INSERT policy has no folder/conversation scoping.

**Fix shape:** Encode `<conversation_id>/...` as the object path and gate SELECT/INSERT on `EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = ((storage.foldername(name))[1])::uuid AND user_id = auth.uid())` (or `is_company_wide_conversation(...)`).

---

## 4. `realtime.messages` — RLS enabled, ZERO policies

```
schema=realtime  table=messages  rowsecurity=true  policy_count=0
```

**Gap:** With RLS enabled and no policies, default behavior depends on Supabase's built-in realtime authorization. As shipped today (no policies), the realtime broadcast/presence channels rely on the default permissive behavior — meaning any authenticated client can `.subscribe()` to any channel topic and receive payloads it should not see. This is the same finding flagged in §8 of `REPORT.md`.

**Fix shape:** Add explicit `realtime.messages` policies that restrict by `topic` to the team/conversation the user belongs to — see [Supabase realtime authorization docs](https://supabase.com/docs/guides/realtime/authorization).

---

## 5. `is_same_team(_user_id, _target_user_id)` — joins on `assigned_by`, not `team_members`

Live function body:

```sql
SELECT CASE
  WHEN _user_id = _target_user_id THEN true
  ELSE EXISTS (
    SELECT 1 FROM public.user_roles ur1
    LEFT JOIN public.user_roles ur2 ON ur2.user_id = _target_user_id
    WHERE ur1.user_id = _user_id
    AND (
      (ur1.assigned_by IS NOT NULL AND ur1.assigned_by = ur2.assigned_by)
      OR ur2.assigned_by = _user_id
      OR ur1.assigned_by = _target_user_id
    )
  )
END
```

**Gap:** Pre-multi-tenant. Treats two users as same-team if either was assigned by the same admin. Does not consult `team_members.team_id` — the authoritative tenant scope. Two users on different teams who happen to share an `assigned_by` admin (or where one assigned the other historically) test as same-team.

**Used by these policies on `customers`** (real PII — names, phones, emails, addresses):

| Policy | CMD |
|---|---|
| `Team members can view customers` | SELECT |
| `Authorized users can update customers` | UPDATE |
| `Authorized users can delete customers` | DELETE |

**Fix shape:** Rewrite as `SELECT EXISTS (SELECT 1 FROM team_members a JOIN team_members b USING (team_id) WHERE a.user_id = _user_id AND b.user_id = _target_user_id AND a.is_active AND b.is_active)`, OR replace call sites with `is_team_member(auth.uid(), customers.team_id)` directly.

---

## 6. `user_activity_log` — admin SELECT policy not team-scoped

| Policy | CMD | USING / WITH CHECK |
|---|---|---|
| `Admins can view all activity` | SELECT | `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')` |
| `Users can insert own activity` | INSERT | (with_check) `auth.uid() = user_id` |

**Gap:** Any admin or manager on any team can read activity rows for users on every other team. `user_activity_log` rows have a `team_id` column (per live schema) — the policy must filter on it. There is no UPDATE/DELETE policy (acceptable for an append-only log).

**Fix shape:** `(auth.uid() = user_id) OR (team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.is_active AND tm.role IN ('owner','admin','manager')))`.

---

## Summary

| # | Surface | Severity | Tenant leak |
|---|---|---|---|
| 1 | `customer-documents` bucket | Critical | Yes — all customer docs |
| 2 | Unscoped `has_role()` in 12+ policies | Critical | Yes — admin of A acts on B |
| 3 | `message-attachments` bucket | High | Yes — all attachments readable |
| 4 | `realtime.messages` no policies | High | Yes — any topic subscribable |
| 5 | `is_same_team()` semantics | Critical | Yes — customer PII cross-team |
| 6 | `user_activity_log` admin SELECT | High | Yes — activity cross-team |

Triage these before any production migration cutover. None require schema changes — all are policy/function rewrites.

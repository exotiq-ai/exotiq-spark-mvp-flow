

# Fix: Scope Audit Log to Current Tenant

## Problem
The `role_audit_log` table has no `team_id` column. Its RLS policy (`has_role(auth.uid(), 'admin')`) lets any admin see every tenant's audit entries. Your screenshot shows entries from both Exotiq and J Davidson's Fleet mixed together.

## Changes

### 1. Database Migration
- Add `team_id UUID REFERENCES teams(id)` column to `role_audit_log`
- Backfill existing rows by looking up each `changed_by` user's team via `team_members`
- Drop the old RLS SELECT policy and replace it with one scoped to the user's team:
  ```sql
  CREATE POLICY "Team admins can view own audit logs"
  ON public.role_audit_log FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
  );
  ```
- Update INSERT policy similarly so `team_id` is enforced on write

### 2. Update `RoleAuditLogSection.tsx`
- Filter the query by `team_id` matching the current team from `useTeam()` context (belt-and-suspenders alongside RLS)

### 3. Update Edge Functions that insert audit logs
- Ensure `invite-user`, `resend-invite`, and the deactivate/delete flows pass `team_id` when inserting into `role_audit_log`

## Result
Each tenant only sees their own audit trail. No cross-tenant data leakage.


-- ============================================================================
-- UPDATE EXISTING RLS POLICIES - Allow Super Admin Bypass
-- Created: 2026-01-03
-- Purpose: Update RLS policies on existing tables to allow super admins full visibility
-- ============================================================================

-- ============================================================================
-- Step 1: Update user_roles table policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users and super admins can view roles" ON public.user_roles;

CREATE POLICY "Users and super admins can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Users see own role
  OR public.has_role(auth.uid(), 'admin')  -- Customer admins see team roles
  OR public.is_super_admin()  -- Super admins see all roles
);

-- ============================================================================
-- Step 2: Update applications table policies
-- ============================================================================

-- Keep public insert, add super admin read access
DROP POLICY IF EXISTS "applications_admin_rw" ON public.applications;
DROP POLICY IF EXISTS "applications_manager_r" ON public.applications;

-- Super admins can read all applications
CREATE POLICY "applications_super_admin_read"
ON public.applications FOR SELECT
TO authenticated
USING (
  public.get_current_app_role() = 'admin'::public.app_role
  OR public.get_current_app_role() = 'manager'::public.app_role
  OR public.is_super_admin()
);

-- Only customer admins can write
CREATE POLICY "applications_admin_write"
ON public.applications FOR ALL
TO authenticated
USING (public.get_current_app_role() = 'admin'::public.app_role)
WITH CHECK (public.get_current_app_role() = 'admin'::public.app_role);

-- ============================================================================
-- Step 3: Update rari_conversations table policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own conversations" ON public.rari_conversations;
DROP POLICY IF EXISTS "Users can view own Rari conversations" ON public.rari_conversations;

CREATE POLICY "Users and super admins can view conversations"
ON public.rari_conversations FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Users see own conversations
  OR public.is_super_admin()  -- Super admins see all conversations
);

-- ============================================================================
-- Step 4: Update rari_messages table policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own messages" ON public.rari_messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.rari_messages;

CREATE POLICY "Users and super admins can view messages"
ON public.rari_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rari_conversations rc
    WHERE rc.id = conversation_id
    AND rc.user_id = auth.uid()
  )
  OR public.is_super_admin()  -- Super admins see all messages
);

-- ============================================================================
-- Step 5: Update rari_action_items table policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own action items" ON public.rari_action_items;

CREATE POLICY "Users and super admins can view action items"
ON public.rari_action_items FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Users see own action items
  OR public.is_super_admin()  -- Super admins see all action items
);

-- ============================================================================
-- Step 6: Update contact_submissions table policies
-- ============================================================================

-- Super admins can read all contact submissions
DROP POLICY IF EXISTS "contact_submissions_read_role_based" ON public.contact_submissions;

CREATE POLICY "contact_submissions_read_with_super_admin"
ON public.contact_submissions FOR SELECT
TO authenticated
USING (
  public.get_current_app_role() = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])
  OR public.is_super_admin()
);

-- ============================================================================
-- Step 7: Update investor_contacts table policies
-- ============================================================================

DROP POLICY IF EXISTS "investor_contacts_read_role_based" ON public.investor_contacts;

CREATE POLICY "investor_contacts_read_with_super_admin"
ON public.investor_contacts FOR SELECT
TO authenticated
USING (
  public.get_current_app_role() = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])
  OR public.is_super_admin()
);

-- ============================================================================
-- Step 8: Update survey_submissions table policies
-- ============================================================================

DROP POLICY IF EXISTS "survey_submissions_read_role_based" ON public.survey_submissions;

CREATE POLICY "survey_submissions_read_with_super_admin"
ON public.survey_submissions FOR SELECT
TO authenticated
USING (
  public.get_current_app_role() = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])
  OR public.is_super_admin()
);

-- ============================================================================
-- Step 9: Update user_activity_log table policies
-- ============================================================================

DROP POLICY IF EXISTS "user_activity_log_read_role_based" ON public.user_activity_log;

CREATE POLICY "user_activity_log_read_with_super_admin"
ON public.user_activity_log FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()  -- Users see own activity
  OR public.get_current_app_role() = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])
  OR public.is_super_admin()  -- Super admins see all activity
);

-- ============================================================================
-- Verification Query (run manually)
-- ============================================================================

-- Count policies that reference is_super_admin function:
-- SELECT 
--   tablename,
--   COUNT(*) as policies_with_super_admin
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND qual::text LIKE '%is_super_admin%'
-- GROUP BY tablename
-- ORDER BY tablename;

-- ============================================================================
-- Summary
-- ============================================================================
-- Updated RLS policies on 9 tables:
-- 1. user_roles - can view all user roles
-- 2. applications - can view all applications  
-- 3. rari_conversations - can view all Rari conversations
-- 4. rari_messages - can view all Rari messages
-- 5. rari_action_items - can view all Rari action items
-- 6. contact_submissions - can view all contact form submissions
-- 7. investor_contacts - can view all investor contacts
-- 8. survey_submissions - can view all survey submissions
-- 9. user_activity_log - can view all user activity

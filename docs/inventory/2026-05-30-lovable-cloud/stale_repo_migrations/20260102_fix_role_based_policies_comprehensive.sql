-- ============================================================================
-- COMPREHENSIVE RLS POLICY FIX: Role-Based Access Control
-- Date: 2026-01-02
-- Purpose: Clean up conflicting policies and apply consistent role-based access
-- ============================================================================

-- ============================================================================
-- 1. FIX APPLICATIONS TABLE: Remove conflicting old policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view applications" ON public.applications;
DROP POLICY IF EXISTS "Authenticated users can update applications" ON public.applications;

-- Keep: "Anyone can submit application" (public INSERT - for website form)
-- Keep: "applications_admin_rw" (admin full access)
-- Keep: "applications_manager_r" (manager read access)

-- ============================================================================
-- 2. FIX INSTAGRAM_POSTS: Apply role-based policies
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can manage instagram posts" ON public.instagram_posts;

-- Keep: "Anyone can view active instagram posts" (public SELECT for website)

-- Add role-based write policies
CREATE POLICY "instagram_posts_admin_manager_write"
ON public.instagram_posts FOR ALL
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
WITH CHECK (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Operators and viewers can read all posts (authenticated users)
CREATE POLICY "instagram_posts_authenticated_read"
ON public.instagram_posts FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 3. FIX CONTACT_SUBMISSIONS: Enable RLS + role-based access
-- ============================================================================
-- Enable RLS first
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Clean up old policies
DROP POLICY IF EXISTS "Allow authenticated users to read contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Allow authenticated users to update contact submissions" ON public.contact_submissions;

-- Keep: "Enable insert for anonymous users" (public form submission)

-- Add role-based policies
CREATE POLICY "contact_submissions_read_role_based"
ON public.contact_submissions FOR SELECT
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "contact_submissions_update_role_based"
ON public.contact_submissions FOR UPDATE
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
WITH CHECK (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- ============================================================================
-- 4. FIX INVESTOR_CONTACTS: Enable RLS + Add policies
-- ============================================================================
ALTER TABLE public.investor_contacts ENABLE ROW LEVEL SECURITY;

-- Allow public insert (from investor form)
CREATE POLICY "investor_contacts_public_insert"
ON public.investor_contacts FOR INSERT
TO public
WITH CHECK (true);

-- Admin/Manager can view all
CREATE POLICY "investor_contacts_read_role_based"
ON public.investor_contacts FOR SELECT
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Admin/Manager can update
CREATE POLICY "investor_contacts_update_role_based"
ON public.investor_contacts FOR UPDATE
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
WITH CHECK (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Admin can delete
CREATE POLICY "investor_contacts_delete_admin_only"
ON public.investor_contacts FOR DELETE
TO authenticated
USING (get_current_app_role() = 'admin'::app_role);

-- ============================================================================
-- 5. FIX SURVEY_SUBMISSIONS: Enable RLS (keep service_role policies)
-- ============================================================================
ALTER TABLE public.survey_submissions ENABLE ROW LEVEL SECURITY;

-- Existing policies for service_role are fine
-- Add admin/manager read access
CREATE POLICY "survey_submissions_read_role_based"
ON public.survey_submissions FOR SELECT
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- ============================================================================
-- 6. FIX CONVERSATION_MEMBERS: Re-enable RLS with non-recursive policies
-- ============================================================================
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- The existing simplified policies should work, but let's verify they're optimal
-- Keep: conversation_members_select_simple
-- Keep: conversation_members_insert_simple
-- Keep: conversation_members_update_simple
-- Keep: conversation_members_delete_simple

-- ============================================================================
-- 7. FIX INVESTOR_EMAILS: Apply role-based access
-- ============================================================================
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.investor_emails;

CREATE POLICY "investor_emails_read_role_based"
ON public.investor_emails FOR SELECT
TO authenticated
USING (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Keep: "Allow insert for all users" (for automated system emails)

-- ============================================================================
-- 8. ENHANCE USER_ACTIVITY_LOG: Consistent role-based access
-- ============================================================================
-- Current policy "Admins can view all activity" uses EXISTS subquery
-- Let's use the get_current_app_role() function instead for consistency

DROP POLICY IF EXISTS "Admins can view all activity" ON public.user_activity_log;

CREATE POLICY "user_activity_log_read_role_based"
ON public.user_activity_log FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (get_current_app_role() = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

-- Keep: "Users can insert own activity"

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration)
-- ============================================================================

-- Check RLS status for all tables
-- SELECT tablename, CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
-- FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check policies per table
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- Test get_current_app_role() function
-- SELECT get_current_app_role();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Public-facing forms (applications, contact_submissions, investor_contacts, survey_submissions) 
--    retain public INSERT access for website functionality
--
-- 2. instagram_posts retains public SELECT for website display (is_active=true)
--
-- 3. All admin/manager policies now consistently use get_current_app_role()
--
-- 4. conversation_members RLS is re-enabled with the simplified policies that 
--    prevent infinite recursion
--
-- 5. Service role policies (survey_submissions) are preserved for backend operations
-- ============================================================================

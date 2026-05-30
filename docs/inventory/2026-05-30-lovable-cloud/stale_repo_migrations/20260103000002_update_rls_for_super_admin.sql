-- ============================================================================
-- UPDATE RLS POLICIES - Allow Super Admin Bypass
-- Created: 2026-01-03
-- Purpose: Update existing RLS policies to allow super admins to view all data
-- ============================================================================

-- ============================================================================
-- Step 1: Update profiles table policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users and super admins can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id  -- Users see own profile
  OR public.is_super_admin()  -- Super admins see all profiles
);

-- ============================================================================
-- Step 2: Update fleet_vehicles table policies (if exists)
-- ============================================================================

-- Check if table exists and update
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fleet_vehicles') THEN
    DROP POLICY IF EXISTS "Users can view own vehicles" ON public.fleet_vehicles;
    DROP POLICY IF EXISTS "Users and super admins can view vehicles" ON public.fleet_vehicles;
    
    CREATE POLICY "Users and super admins can view vehicles"
    ON public.fleet_vehicles FOR SELECT
    TO authenticated
    USING (
      owner_id = auth.uid()  -- Users see own vehicles
      OR public.is_super_admin()  -- Super admins see all vehicles
    );
  END IF;
END $$;

-- ============================================================================
-- Step 3: Update vehicles table policies (legacy table name)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vehicles') THEN
    DROP POLICY IF EXISTS "Users can view own vehicles" ON public.vehicles;
    DROP POLICY IF EXISTS "Users and super admins can view vehicles" ON public.vehicles;
    
    CREATE POLICY "Users and super admins can view vehicles"
    ON public.vehicles FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own vehicles
      OR public.is_super_admin()  -- Super admins see all vehicles
    );
  END IF;
END $$;

-- ============================================================================
-- Step 4: Update bookings table policies
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings') THEN
    DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Users and super admins can view bookings" ON public.bookings;
    
    CREATE POLICY "Users and super admins can view bookings"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own bookings
      OR public.is_super_admin()  -- Super admins see all bookings
    );
  END IF;
END $$;

-- ============================================================================
-- Step 5: Update customers/crm_contacts table policies
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customers') THEN
    DROP POLICY IF EXISTS "Users can view own customers" ON public.customers;
    DROP POLICY IF EXISTS "Team members can view customers" ON public.customers;
    DROP POLICY IF EXISTS "Users and super admins can view customers" ON public.customers;
    
    CREATE POLICY "Users and super admins can view customers"
    ON public.customers FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own customers
      OR public.is_super_admin()  -- Super admins see all customers
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_contacts') THEN
    DROP POLICY IF EXISTS "Users can view own contacts" ON public.crm_contacts;
    DROP POLICY IF EXISTS "Users and super admins can view contacts" ON public.crm_contacts;
    
    CREATE POLICY "Users and super admins can view contacts"
    ON public.crm_contacts FOR SELECT
    TO authenticated
    USING (
      created_by = auth.uid()  -- Users see own contacts
      OR public.is_super_admin()  -- Super admins see all contacts
    );
  END IF;
END $$;

-- ============================================================================
-- Step 6: Update user_roles table policies
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
    DROP POLICY IF EXISTS "Users and super admins can view roles" ON public.user_roles;
    
    CREATE POLICY "Users and super admins can view roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own role
      OR public.has_role(auth.uid(), 'admin')  -- Customer admins can see team roles
      OR public.is_super_admin()  -- Super admins see all roles
    );
  END IF;
END $$;

-- ============================================================================
-- Step 7: Update payments table policies (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
    DROP POLICY IF EXISTS "Users and super admins can view payments" ON public.payments;
    
    CREATE POLICY "Users and super admins can view payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own payments
      OR public.is_super_admin()  -- Super admins see all payments
    );
  END IF;
END $$;

-- ============================================================================
-- Step 8: Update subscriptions table policies (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
    DROP POLICY IF EXISTS "Users and super admins can view subscriptions" ON public.subscriptions;
    
    CREATE POLICY "Users and super admins can view subscriptions"
    ON public.subscriptions FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()  -- Users see own subscriptions
      OR public.is_super_admin()  -- Super admins see all subscriptions
    );
  END IF;
END $$;

-- ============================================================================
-- Verification Query (run manually after migration)
-- ============================================================================

-- Verify updated policies on key tables:
-- SELECT 
--   tablename,
--   policyname,
--   cmd,
--   LEFT(qual::text, 100) as using_clause
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('profiles', 'vehicles', 'fleet_vehicles', 'bookings', 'customers')
-- AND policyname LIKE '%super%'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- Notes
-- ============================================================================
-- 1. Only SELECT policies are updated - super admins view-only by default
-- 2. Super admins cannot modify customer data (for safety)
-- 3. To allow super admin edits, add UPDATE/DELETE policies separately
-- 4. Uses conditional DO blocks to handle missing tables gracefully

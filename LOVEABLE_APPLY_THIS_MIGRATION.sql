-- ============================================================
-- EXOTIQ RARI MIGRATION - FOR LOVEABLE TO APPLY
-- ============================================================
-- This migration adds multi-tenancy support and fixes schema issues
-- Apply this to: jlgwbbqydjeokypoenoc.supabase.co
-- Date: January 9, 2026
-- ============================================================

-- 1. CREATE TEAMS TABLE (for multi-tenancy)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. CREATE PROFILES TABLE (for user profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. CREATE TEAM_MEMBERS TABLE (links users to teams)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (team_id, user_id)
);

-- 4. ADD TEAM_ID TO CORE TABLES (if not exists)
-- ============================================================
DO $$ 
BEGIN
    -- Add team_id to vehicles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'team_id') THEN
        ALTER TABLE public.vehicles ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
    
    -- Add team_id to bookings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'team_id') THEN
        ALTER TABLE public.bookings ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
    
    -- Add team_id to customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'team_id') THEN
        ALTER TABLE public.customers ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
    
    -- Add team_id to maintenance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance' AND column_name = 'team_id') THEN
        ALTER TABLE public.maintenance ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
    
    -- Add team_id to revenue
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revenue' AND column_name = 'team_id') THEN
        ALTER TABLE public.revenue ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
    
    -- Add team_id to damage_reports
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'damage_reports' AND column_name = 'team_id') THEN
        ALTER TABLE public.damage_reports ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. CREATE DEMO TEAM (for unauthenticated/demo access)
-- ============================================================
INSERT INTO public.teams (id, name, owner_id) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Team', NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. BACKFILL EXISTING DATA WITH DEMO TEAM
-- ============================================================
UPDATE public.vehicles SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.bookings SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.customers SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.maintenance SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.revenue SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.damage_reports SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;

-- 7. ENABLE RLS ON NEW TABLES
-- ============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR TEAMS
-- ============================================================
DROP POLICY IF EXISTS "Allow team owners to manage teams" ON public.teams;
CREATE POLICY "Allow team owners to manage teams" ON public.teams
FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Allow team members to view teams" ON public.teams;
CREATE POLICY "Allow team members to view teams" ON public.teams
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow anon to view demo team" ON public.teams;
CREATE POLICY "Allow anon to view demo team" ON public.teams
FOR SELECT TO anon USING (id = '00000000-0000-0000-0000-000000000001');

-- 9. RLS POLICIES FOR PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 10. RLS POLICIES FOR TEAM_MEMBERS
-- ============================================================
DROP POLICY IF EXISTS "Allow team members to view memberships" ON public.team_members;
CREATE POLICY "Allow team members to view memberships" ON public.team_members
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow team owners to manage members" ON public.team_members;
CREATE POLICY "Allow team owners to manage members" ON public.team_members
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND owner_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND owner_id = auth.uid())
);

-- 11. RLS POLICIES FOR CORE TABLES (allow anon to read demo team data)
-- ============================================================

-- Vehicles
DROP POLICY IF EXISTS "Allow anon to read demo vehicles" ON public.vehicles;
CREATE POLICY "Allow anon to read demo vehicles" ON public.vehicles
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Allow team members to view vehicles" ON public.vehicles;
CREATE POLICY "Allow team members to view vehicles" ON public.vehicles
FOR SELECT TO authenticated USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id = '00000000-0000-0000-0000-000000000001'
);

-- Bookings
DROP POLICY IF EXISTS "Allow anon to read demo bookings" ON public.bookings;
CREATE POLICY "Allow anon to read demo bookings" ON public.bookings
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Allow team members to view bookings" ON public.bookings;
CREATE POLICY "Allow team members to view bookings" ON public.bookings
FOR SELECT TO authenticated USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id = '00000000-0000-0000-0000-000000000001'
);

-- Customers
DROP POLICY IF EXISTS "Allow anon to read demo customers" ON public.customers;
CREATE POLICY "Allow anon to read demo customers" ON public.customers
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Allow team members to view customers" ON public.customers;
CREATE POLICY "Allow team members to view customers" ON public.customers
FOR SELECT TO authenticated USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id = '00000000-0000-0000-0000-000000000001'
);

-- Maintenance
DROP POLICY IF EXISTS "Allow anon to read demo maintenance" ON public.maintenance;
CREATE POLICY "Allow anon to read demo maintenance" ON public.maintenance
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

-- Revenue
DROP POLICY IF EXISTS "Allow anon to read demo revenue" ON public.revenue;
CREATE POLICY "Allow anon to read demo revenue" ON public.revenue
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

-- Damage Reports
DROP POLICY IF EXISTS "Allow anon to read demo damage_reports" ON public.damage_reports;
CREATE POLICY "Allow anon to read demo damage_reports" ON public.damage_reports
FOR SELECT TO anon USING (team_id = '00000000-0000-0000-0000-000000000001');

-- ============================================================
-- DONE! Verify with:
-- SELECT COUNT(*) FROM vehicles WHERE team_id IS NOT NULL;
-- SELECT * FROM teams;
-- ============================================================

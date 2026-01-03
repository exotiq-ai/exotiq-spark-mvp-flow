-- Create helper function to check if user is member of the same team as a record
CREATE OR REPLACE FUNCTION public.is_team_member_of_record(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _team_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE user_id = _user_id
        AND team_id = _team_id
        AND is_active = true
    )
  END
$$;

-- Update vehicles policies to support team access
DROP POLICY IF EXISTS "Users can view own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON public.vehicles;

CREATE POLICY "Users can view vehicles" ON public.vehicles
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert vehicles" ON public.vehicles
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update vehicles" ON public.vehicles
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete vehicles" ON public.vehicles
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update bookings policies to support team access
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;

CREATE POLICY "Users can view bookings" ON public.bookings
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert bookings" ON public.bookings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update bookings" ON public.bookings
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'operator')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete bookings" ON public.bookings
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update payments policies to support team access
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;

CREATE POLICY "Users can view payments" ON public.payments
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert payments" ON public.payments
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update payments" ON public.payments
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete payments" ON public.payments
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update damage_claims policies to support team access
DROP POLICY IF EXISTS "Users can view own damage claims" ON public.damage_claims;
DROP POLICY IF EXISTS "Users can insert own damage claims" ON public.damage_claims;
DROP POLICY IF EXISTS "Users can update own damage claims" ON public.damage_claims;
DROP POLICY IF EXISTS "Users can delete own damage claims" ON public.damage_claims;

CREATE POLICY "Users can view damage claims" ON public.damage_claims
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert damage claims" ON public.damage_claims
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update damage claims" ON public.damage_claims
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete damage claims" ON public.damage_claims
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update maintenance_schedules policies to support team access
DROP POLICY IF EXISTS "Users can view own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can create own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can update own maintenance schedules" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "Users can delete own maintenance schedules" ON public.maintenance_schedules;

CREATE POLICY "Users can view maintenance schedules" ON public.maintenance_schedules
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert maintenance schedules" ON public.maintenance_schedules
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update maintenance schedules" ON public.maintenance_schedules
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'operator')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete maintenance schedules" ON public.maintenance_schedules
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);

-- Update documents policies to support team access
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

CREATE POLICY "Users can view documents" ON public.documents
FOR SELECT USING (
  auth.uid() = user_id 
  OR is_team_member_of_record(auth.uid(), team_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can insert documents" ON public.documents
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update documents" ON public.documents
FOR UPDATE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can delete documents" ON public.documents
FOR DELETE USING (
  auth.uid() = user_id 
  OR (is_team_member_of_record(auth.uid(), team_id) AND has_role(auth.uid(), 'admin'))
  OR is_super_admin(auth.uid())
);
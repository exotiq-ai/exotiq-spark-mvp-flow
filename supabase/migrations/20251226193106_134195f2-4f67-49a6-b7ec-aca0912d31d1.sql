-- Create a function to check if two users are in the same team/organization
-- A team is defined by users assigned by the same admin, or the admin themselves
CREATE OR REPLACE FUNCTION public.is_same_team(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Same user
    WHEN _user_id = _target_user_id THEN true
    -- Check if both users share the same admin (assigned_by) or one is admin of the other
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur1
      LEFT JOIN public.user_roles ur2 ON ur2.user_id = _target_user_id
      WHERE ur1.user_id = _user_id
      AND (
        -- Both assigned by same admin
        (ur1.assigned_by IS NOT NULL AND ur1.assigned_by = ur2.assigned_by)
        -- Current user is the admin who assigned target user
        OR ur2.assigned_by = _user_id
        -- Target user is the admin who assigned current user
        OR ur1.assigned_by = _target_user_id
      )
    )
  END
$$;

-- Create a function to get the admin/owner for a user's team
CREATE OR REPLACE FUNCTION public.get_team_owner(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT assigned_by FROM public.user_roles WHERE user_id = _user_id AND assigned_by IS NOT NULL LIMIT 1),
    _user_id -- If no assigned_by, user is their own owner (admin)
  )
$$;

-- Drop existing customers policies
DROP POLICY IF EXISTS "Users can view own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON public.customers;

-- New RLS Policies for customers table with role-based access

-- SELECT: Business owner OR team members with manager/operator roles can view
CREATE POLICY "Team members can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() -- Owner can always see their data
  OR (
    -- Team members with appropriate roles can view
    public.is_same_team(auth.uid(), user_id)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'operator')
    )
  )
);

-- INSERT: Only business owner can create customers
CREATE POLICY "Owners can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Business owner OR team admins/managers can update
CREATE POLICY "Authorized users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.is_same_team(auth.uid(), user_id)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (
    public.is_same_team(auth.uid(), user_id)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  )
);

-- DELETE: Only business owner OR team admins can delete
CREATE POLICY "Authorized users can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    public.is_same_team(auth.uid(), user_id)
    AND public.has_role(auth.uid(), 'admin')
  )
);

-- Add comment for documentation
COMMENT ON FUNCTION public.is_same_team IS 'Checks if two users belong to the same team/organization based on admin assignment chain';
COMMENT ON FUNCTION public.get_team_owner IS 'Returns the admin/owner user_id for a given users team';
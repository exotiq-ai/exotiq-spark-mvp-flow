-- Add read policy for super_admins table (super admins can read their own entry)
CREATE POLICY "Super admins can view super_admins table"
ON public.super_admins
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND LOWER(p.email) = LOWER(super_admins.email)
  )
);
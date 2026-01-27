-- Fix overly permissive RLS policy on entity_comments
-- The USING (true) allows any authenticated user to view ALL comments

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view comments on entities they can access" ON public.entity_comments;

-- Create a proper policy that checks if user has access to the related entity
-- Comments should be visible if:
-- 1. The user is the comment author, OR
-- 2. The user has access to the entity the comment is attached to (booking, vehicle, etc.)
-- 3. Super admins can see all comments
-- Note: entity_id is UUID type

CREATE POLICY "Users can view accessible comments"
ON public.entity_comments
FOR SELECT
TO authenticated
USING (
  -- User is the comment author
  auth.uid() = user_id
  -- OR user is a super admin
  OR public.is_super_admin(auth.uid())
  -- OR user has access via team membership on bookings
  OR (entity_type = 'booking' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = entity_comments.entity_id
    AND (b.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), b.team_id))
  ))
  -- OR user has access via team membership on vehicles
  OR (entity_type = 'vehicle' AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = entity_comments.entity_id
    AND (v.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), v.team_id))
  ))
  -- OR user has access via team membership on customers
  OR (entity_type = 'customer' AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = entity_comments.entity_id
    AND (c.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), c.team_id))
  ))
  -- OR user has access via team membership on payments
  OR (entity_type = 'payment' AND EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = entity_comments.entity_id
    AND (p.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), p.team_id))
  ))
  -- OR user has access via team membership on damage_claims
  OR (entity_type = 'damage_claim' AND EXISTS (
    SELECT 1 FROM public.damage_claims d
    WHERE d.id = entity_comments.entity_id
    AND (d.user_id = auth.uid() OR public.is_team_member_of_record(auth.uid(), d.team_id))
  ))
);
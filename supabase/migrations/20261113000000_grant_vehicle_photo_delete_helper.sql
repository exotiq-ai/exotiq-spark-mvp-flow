-- Let signed-in users run the helper that their own storage policy calls.
--
-- The policy "Uploaders and team managers can delete vehicle photos" on storage.objects (for signed-in users)
-- calls public.can_delete_vehicle_photo_object(uuid, text). EXECUTE on that function was revoked from signed-in
-- users one migration after the policy was written (20260831163200). Postgres checks the privilege when it sets
-- up the policy expression, not when it reaches that branch, so every delete of a vehicle-photo file by a
-- signed-in user has been refused since ("permission denied for function can_delete_vehicle_photo_object"):
-- the photo record goes, the file stays in the bucket.
--
-- The function is SECURITY DEFINER with a fixed search_path and only answers yes or no; its sibling in the same
-- policy, can_manage_team_or_user_storage_path(uuid, text), is already executable by signed-in users.
--
-- No data is changed. The statement is skipped when the function is absent, and the file can be run again.
do $$
begin
  if to_regprocedure('public.can_delete_vehicle_photo_object(uuid,text)') is not null then
    revoke all on function public.can_delete_vehicle_photo_object(uuid, text) from public, anon;
    grant execute on function public.can_delete_vehicle_photo_object(uuid, text) to authenticated, service_role;
  end if;
end $$;

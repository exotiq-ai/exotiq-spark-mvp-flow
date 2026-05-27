
REVOKE EXECUTE ON FUNCTION public.archive_vehicle(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_vehicle_from_archive(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trash_vehicle(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_vehicle_from_trash(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purge_vehicle_now(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.snapshot_vehicle_billing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_purge_expired_vehicles() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.archive_vehicle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_vehicle_from_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trash_vehicle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_vehicle_from_trash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_vehicle_now(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_vehicle_billing() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_purge_expired_vehicles() TO service_role;

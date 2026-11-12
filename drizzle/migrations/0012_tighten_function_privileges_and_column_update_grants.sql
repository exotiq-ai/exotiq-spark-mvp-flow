do $$
declare
  sig text;
begin
  -- 1. service role only. Callers: rent-payment-scheduler, rent-create-booking, check-subscription,
  --    generate-vat-invoice, generate-recurring-expenses and the shared rate limiter (all on the service role),
  --    the scheduled jobs (they run as the owner), and other SECURITY DEFINER functions (log_pii_read, and the
  --    five team/vehicle helpers at the end, which the quote, publish and subscription-health functions call).
  --    The four lookup helpers before them have no caller at all.
  foreach sig in array array[
    'public.find_holds_needing_warning()',
    'public.expire_unverified_holds()',
    'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint)',
    'public.create_marketplace_booking(text,text,date,date,text,text,text,text,numeric,numeric,text,text,bigint,bigint,bigint,bigint,bigint,text)',
    'public.auto_clear_billing_dunning_for_email(text)',
    'public.next_invoice_number(uuid)',
    'public.purge_old_notifications()',
    'public.update_document_status()',
    'public.mark_expired_invitations()',
    'public.generate_recurring_expenses()',
    'public.check_rate_limit(text,integer,integer)',
    'public.log_pii_read(text,uuid,text[])',
    'public.get_user_teams(uuid)',
    'public.get_user_role(uuid)',
    'public.get_team_owner(uuid)',
    'public.count_admins()',
    'public.team_state_code(uuid)',
    'public.team_state_fee_daily_cents(uuid)',
    'public.team_active_vehicle_count(uuid)',
    'public.team_is_writable(uuid)',
    'public.vehicle_is_marketplace_eligible(uuid)'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;

  -- 2. signed-in users and the service role: functions the application calls after sign-in.
  foreach sig in array array[
    'public.deactivate_team_member(uuid,text)',
    'public.reactivate_team_member(uuid)',
    'public.get_marketplace_readiness(uuid)',
    'public.rename_team(uuid,text,boolean)',
    'public.resolve_deposit_cents(uuid)'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon', sig);
      execute format('grant execute on function %s to authenticated, service_role', sig);
    end if;
  end loop;

  -- 3. the same for helper functions that take a user id and are used by row-level-security policies written for
  --    `authenticated`, or by other SECURITY DEFINER functions. A helper is left as it is (with a WARNING) when a
  --    policy that applies to `anon` uses it on a table `anon` can reach: there, a missing EXECUTE would turn an
  --    empty answer into an error.
  foreach sig in array array[
    'public.can_access_conversation(uuid,uuid)',
    'public.can_access_entity(uuid,text,uuid)',
    'public.can_access_realtime_topic(uuid,text)',
    'public.can_manage_team_or_user_storage_path(uuid,text)',
    'public.can_read_message_attachment_path(uuid,text)',
    'public.can_read_team_or_user_storage_path(uuid,text)',
    'public.can_write_message_attachment_path(uuid,text)',
    'public.can_write_team_or_user_storage_path(uuid,text)',
    'public.has_shared_team_role(uuid,uuid,public.app_role[])',
    'public.has_team_role(uuid,uuid,public.app_role)',
    'public.is_admin_over_user(uuid,uuid)',
    'public.is_conversation_member(uuid,uuid)',
    'public.is_manager_over_user(uuid,uuid)',
    'public.is_same_team(uuid,uuid)'
  ] loop
    continue when to_regprocedure(sig) is null;
    if exists (
      select 1
      from pg_policy p
      join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
                      and d.refclassid = 'pg_proc'::regclass and d.refobjid = to_regprocedure(sig)
      where (0 = any (p.polroles) or (select oid from pg_roles where rolname = 'anon') = any (p.polroles))
        and has_table_privilege('anon', p.polrelid, 'select, insert, update, delete')
    ) then
      raise warning 'tighten_function_privileges: % is used by a policy that applies to anon; its grants are left as they are', sig;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon', sig);
    execute format('grant execute on function %s to authenticated, service_role', sig);
  end loop;
end $$;

-- On these tables a signed-in user may update every column except the ones listed, which identify the row or are
-- maintained by server-side code (SECURITY DEFINER functions, triggers, the service role):
--   profiles              id, email, is_active, created_at, handle_changed_at
--   team_members          id, team_id, user_id
--   conversation_members  id, conversation_id, user_id, role, joined_at
-- Row-level-security policies still decide WHICH rows. anon has no UPDATE here at all (it never matched a row).
-- A column added to one of these tables later is not covered: grant UPDATE on that column to authenticated in
-- the migration that adds it, never UPDATE on the whole table.
do $$
declare
  r record;
  cols text;
begin
  for r in
    select * from (values
      ('public.profiles',             array['id', 'email', 'is_active', 'created_at', 'handle_changed_at']),
      ('public.team_members',         array['id', 'team_id', 'user_id']),
      ('public.conversation_members', array['id', 'conversation_id', 'user_id', 'role', 'joined_at'])
    ) as v(tbl, kept)
  loop
    continue when to_regclass(r.tbl) is null;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = to_regclass(r.tbl)
      and a.attnum > 0
      and not a.attisdropped
      and a.attgenerated = ''
      and a.attname <> all (r.kept);
    -- revoking the table privilege also removes every column-level UPDATE granted earlier
    execute format('revoke update on table %s from public, anon, authenticated', r.tbl);
    if cols is not null then
      execute format('grant update (%s) on table %s to authenticated', cols, r.tbl);
    end if;
  end loop;
end $$;
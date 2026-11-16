-- The gas / re-fuelling fee becomes a team setting.
--
-- Until now the fee was stored in user_settings (category 'team') under whoever was signed in, and every booking
-- screen read the signed-in person's own copy: two staff members could put different gas fees on bookings, and anyone
-- who never opened the settings got the built-in default ($20, on). The fee is a property of the business, so it moves
-- onto the team row next to the other team defaults (min_rate, default_deposit_cents, mileage defaults).
--
-- Backfill: when the columns are first added, each team takes the values its OWNER had saved (user_settings,
-- category 'team'); teams whose owner never saved them keep the old built-in defaults (on, 20, on by default), which
-- is what those bookings already used. The backfill runs only when the columns are created, so running the file
-- again never overwrites a value set later. user_settings is not changed. No other data is changed.

do $$
declare
  added boolean := false;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'gas_fee_amount'
  ) then
    alter table public.teams
      add column gas_fee_enabled boolean not null default true,
      add column gas_fee_amount numeric(10, 2) not null default 20,
      add column gas_fee_default_on boolean not null default true;
    alter table public.teams
      add constraint teams_gas_fee_amount_nonnegative check (gas_fee_amount >= 0);
    added := true;
  end if;

  if added then
    update public.teams t
    set
      gas_fee_enabled = case
        when jsonb_typeof(s.settings -> 'gasFeeEnabled') = 'boolean' then (s.settings ->> 'gasFeeEnabled')::boolean
        else t.gas_fee_enabled end,
      gas_fee_amount = case
        when (s.settings ->> 'gasFeeAmount') ~ '^\s*\d+(\.\d{1,2})?\s*$' then trim(s.settings ->> 'gasFeeAmount')::numeric(10, 2)
        else t.gas_fee_amount end,
      gas_fee_default_on = case
        when jsonb_typeof(s.settings -> 'gasFeeDefaultOn') = 'boolean' then (s.settings ->> 'gasFeeDefaultOn')::boolean
        else t.gas_fee_default_on end
    from (
      -- the owner's own 'team' settings row; prefer one tied to this team, then the most recently updated
      select distinct on (t2.id) t2.id as team_id, us.settings
      from public.teams t2
      join public.user_settings us on us.user_id = t2.owner_id and us.category = 'team'
      where jsonb_typeof(us.settings) = 'object'
      order by t2.id, (us.team_id = t2.id) desc nulls last, us.updated_at desc nulls last
    ) s
    where s.team_id = t.id;
  end if;
end $$;

comment on column public.teams.gas_fee_enabled is 'Show the gas / re-fuelling fee line on bookings and payments.';
comment on column public.teams.gas_fee_amount is 'Gas / re-fuelling fee per booking, in the team currency.';
comment on column public.teams.gas_fee_default_on is 'Whether new bookings start with the gas fee applied (operators can waive it per booking).';

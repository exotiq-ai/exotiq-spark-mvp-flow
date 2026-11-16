-- Tests for 20261116010000_team_gas_fee.sql. Read-only: it inspects columns and constraints and calls nothing.
--   psql ... < supabase/tests/team_gas_fee.test.sql
do $$
declare
  col record;
begin
  for col in
    select a.attname, a.attnotnull, format_type(a.atttypid, a.atttypmod) as typ, pg_get_expr(d.adbin, d.adrelid) as dflt
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = 'public.teams'::regclass
      and a.attname in ('gas_fee_enabled', 'gas_fee_amount', 'gas_fee_default_on')
      and not a.attisdropped
  loop
    assert col.attnotnull, col.attname || ' is NOT NULL';
    if col.attname = 'gas_fee_amount' then
      assert col.typ = 'numeric(10,2)', 'gas_fee_amount is numeric(10,2)';
      assert col.dflt = '20', 'gas_fee_amount defaults to 20 (the old built-in default)';
    else
      assert col.typ = 'boolean', col.attname || ' is boolean';
      assert col.dflt = 'true', col.attname || ' defaults to true (the old built-in default)';
    end if;
  end loop;
  assert (select count(*) from pg_attribute where attrelid = 'public.teams'::regclass
          and attname in ('gas_fee_enabled', 'gas_fee_amount', 'gas_fee_default_on') and not attisdropped) = 3,
    'all three gas fee columns exist on teams';

  assert exists (
    select 1 from pg_constraint
    where conrelid = 'public.teams'::regclass and conname = 'teams_gas_fee_amount_nonnegative' and contype = 'c'
  ), 'the gas fee cannot be negative';

  raise notice 'team_gas_fee: all checks passed';
end $$;

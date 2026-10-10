-- Date checks of curated calendar events against their official sites (event demand engine v2).
alter table public.demand_event_snapshots
  add column if not exists calendar_checks jsonb not null default '{}'::jsonb;

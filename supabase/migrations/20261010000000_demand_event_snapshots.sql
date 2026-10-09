-- Nightly precomputed AI/web-search events per market (event demand engine v2).
-- The Command Center card reads from here instead of searching the web while the user waits.
-- Curated calendar events are NOT stored: they are computed live from code on every read.
create table if not exists public.demand_event_snapshots (
  city text primary key,
  window_start date not null,
  window_end date not null,
  generated_at timestamptz not null default now(),
  events jsonb not null default '[]'::jsonb,
  ai_event_count integer not null default 0,
  failed_searches integer not null default 0,
  duration_ms integer,
  last_attempt_at timestamptz not null default now(),
  last_error text
);

alter table public.demand_event_snapshots enable row level security;

-- Same exposure as demand_intelligence_cache: market-level public events, readable by signed-in users.
-- Writes happen only through the service role (precompute-event-intelligence).
drop policy if exists "Authenticated users can read event snapshots" on public.demand_event_snapshots;
create policy "Authenticated users can read event snapshots"
  on public.demand_event_snapshots for select to authenticated using (true);

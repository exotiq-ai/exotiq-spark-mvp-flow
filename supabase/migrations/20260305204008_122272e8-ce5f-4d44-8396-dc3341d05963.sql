CREATE TABLE public.demand_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours',
  UNIQUE(city, start_date, end_date)
);

-- Disable RLS since only edge functions write to this table
ALTER TABLE public.demand_intelligence_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read cache"
  ON public.demand_intelligence_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage cache (edge functions use service role)
CREATE POLICY "Service role can manage cache"
  ON public.demand_intelligence_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
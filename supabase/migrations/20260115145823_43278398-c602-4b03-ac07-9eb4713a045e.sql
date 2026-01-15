-- Create import_batches table for tracking import history
CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  entity_type TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER,
  imported_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Users can view their own team's imports
CREATE POLICY "Users can view team imports"
ON public.import_batches
FOR SELECT
USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Users can insert imports for their team
CREATE POLICY "Users can create imports"
ON public.import_batches
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own imports
CREATE POLICY "Users can update own imports"
ON public.import_batches
FOR UPDATE
USING (auth.uid() = user_id);
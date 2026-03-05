
CREATE TABLE public.weekly_digests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_start TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  revenue_total NUMERIC DEFAULT 0,
  bookings_count INTEGER DEFAULT 0,
  top_insight TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their team digests"
  ON public.weekly_digests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND is_my_team_member(team_id))
  );

CREATE POLICY "Users can insert digests"
  ON public.weekly_digests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add digest preferences to notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_email_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_frequency TEXT NOT NULL DEFAULT 'weekly';

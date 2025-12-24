-- Create onboarding_responses table for storing new customer onboarding data
CREATE TABLE public.onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  business_name TEXT,
  location TEXT,
  fleet_size TEXT,
  vehicle_types TEXT,
  current_software TEXT,
  pain_points TEXT,
  referral_source TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for new signups before auth)
CREATE POLICY "Anyone can insert onboarding responses"
ON public.onboarding_responses
FOR INSERT
WITH CHECK (true);

-- Users can view their own responses
CREATE POLICY "Users can view own onboarding responses"
ON public.onboarding_responses
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_responses_updated_at
BEFORE UPDATE ON public.onboarding_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
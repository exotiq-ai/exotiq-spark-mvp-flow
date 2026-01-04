-- Add new onboarding fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fleet_size text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_type text;
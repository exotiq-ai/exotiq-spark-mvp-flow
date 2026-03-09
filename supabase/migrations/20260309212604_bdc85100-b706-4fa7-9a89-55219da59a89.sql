ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS secondary_phone text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];
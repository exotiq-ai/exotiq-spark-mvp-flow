-- Add Stripe customer linkage to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add verification columns to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_document_url TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS insurance_document_url TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS insurance_verified_at TIMESTAMPTZ;

-- Create payouts tracking table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_payout_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending',
  arrival_date TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payouts
CREATE POLICY "Users can view their own payouts"
ON public.payouts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payouts"
ON public.payouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payouts"
ON public.payouts
FOR UPDATE
USING (auth.uid() = user_id);

-- Create payment_receipts table for export tracking
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  receipt_url TEXT,
  receipt_number TEXT,
  exported_at TIMESTAMPTZ,
  export_format TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on payment_receipts
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_receipts (join through payments table)
CREATE POLICY "Users can view their own payment receipts"
ON public.payment_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own payment receipts"
ON public.payment_receipts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_id AND p.user_id = auth.uid()
  )
);

-- Create trigger for payouts updated_at
CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create customer-documents storage bucket for ID/Insurance uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for customer-documents bucket
CREATE POLICY "Users can upload customer documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view their customer documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their customer documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their customer documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND auth.uid() IS NOT NULL
);
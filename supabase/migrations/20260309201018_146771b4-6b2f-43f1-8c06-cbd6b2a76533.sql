
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check 
  CHECK (type = ANY (ARRAY[
    'insurance', 'registration', 'license', 'contract', 
    'rental_agreement', 'inspection', 'other'
  ]));

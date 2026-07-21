REVOKE ALL ON public.identity_verifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.identity_verifications FROM authenticated;
-- Destructive reset permitted ONLY in exact owned, marked PARTIAL test database.
DO $$ BEGIN
 IF current_database()<>'agent_test' OR NOT EXISTS(SELECT 1 FROM public.lab_identity WHERE name='exotiq-agent-test-partial' AND schema_parity=false) THEN RAISE EXCEPTION 'Wrong partial lab'; END IF;
END $$;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;

ALTER TABLE public.vehicle_identity_sheets ADD COLUMN IF NOT EXISTS source_revision text;
ALTER TABLE public.vehicle_identity_sheets ADD COLUMN IF NOT EXISTS reviewed_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS identity_snapshot jsonb;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS recipe_snapshot jsonb;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS source_photo_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS reference_kind text NOT NULL DEFAULT 'vehicle';
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS review_details jsonb;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unreviewed';
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS gateway_run_id text;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS usage_details jsonb;
ALTER TABLE public.studio_hero_benchmark_results ADD COLUMN IF NOT EXISTS cost_usd numeric;
ALTER TABLE public.hero_render_jobs ADD COLUMN IF NOT EXISTS review_state text;
ALTER TABLE public.hero_render_jobs ADD COLUMN IF NOT EXISTS review_details jsonb;
CREATE TABLE public.studio_hero_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL, actor_id uuid NOT NULL,
 action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_hero_audit TO authenticated;
GRANT ALL ON public.studio_hero_audit TO service_role;
ALTER TABLE public.studio_hero_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_hero_audit_admin_read ON public.studio_hero_audit FOR SELECT TO authenticated USING(public.is_super_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.super_admin_studio_workspace(_team_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin access required'; END IF;
 RETURN jsonb_build_object(
 'vehicles',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.make,v.model) FROM (SELECT id,make,model,year,color,image_url FROM public.vehicles WHERE team_id=_team_id) v),'[]'::jsonb),
 'photos',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT id,vehicle_id,url,enhanced_url,photo_type,source,original_filename,display_order FROM public.vehicle_photos WHERE vehicle_id IN (SELECT id FROM public.vehicles WHERE team_id=_team_id)) p),'[]'::jsonb),
 'jobs',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC) FROM public.hero_render_jobs j WHERE j.team_id=_team_id),'[]'::jsonb),
 'sheets',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.vehicle_identity_sheets s WHERE s.team_id=_team_id),'[]'::jsonb),
 'benchmarks',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC) FROM public.studio_hero_benchmark_results b WHERE b.team_id=_team_id),'[]'::jsonb),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.studio_hero_audit WHERE team_id=_team_id ORDER BY created_at DESC LIMIT 50) a),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.super_admin_studio_workspace(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_studio_workspace(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.super_admin_studio_save_identity(_vehicle_id uuid,_overrides jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin access required'; END IF;
 IF jsonb_typeof(_overrides)<>'object' OR octet_length(_overrides::text)>32000 THEN RAISE EXCEPTION 'Identity corrections must be an object under 32 KB'; END IF;
 SELECT team_id INTO tid FROM public.vehicles WHERE id=_vehicle_id;
 IF tid IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
 INSERT INTO public.vehicle_identity_sheets(vehicle_id,team_id,reviewed_overrides,edited_by,edited_at) VALUES(_vehicle_id,tid,_overrides,auth.uid(),now())
 ON CONFLICT(vehicle_id) DO UPDATE SET reviewed_overrides=_overrides,edited_by=auth.uid(),edited_at=now(),updated_at=now();
 INSERT INTO public.studio_hero_audit(team_id,vehicle_id,actor_id,action,details) VALUES(tid,_vehicle_id,auth.uid(),'identity_corrected',jsonb_build_object('overrides',_overrides));
END $$;
REVOKE ALL ON FUNCTION public.super_admin_studio_save_identity(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_studio_save_identity(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.super_admin_reset_studio_hero(_vehicle_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; tid uuid;
BEGIN
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin access required'; END IF;
 SELECT team_id INTO tid FROM public.vehicles WHERE id=_vehicle_id FOR UPDATE;
 IF tid IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.hero_render_jobs WHERE vehicle_id=_vehicle_id AND archived_at IS NULL AND status IN ('rendering','qc','pending')) THEN RAISE EXCEPTION 'Wait for the active render or review to finish before resetting'; END IF;
 UPDATE public.hero_render_jobs SET archived_at=now() WHERE vehicle_id=_vehicle_id AND archived_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO public.studio_hero_audit(team_id,vehicle_id,actor_id,action,details) VALUES(tid,_vehicle_id,auth.uid(),'vehicle_reset',jsonb_build_object('archived_jobs',n)); RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.super_admin_reset_studio_hero(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_reset_studio_hero(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.super_admin_reset_studio_fleet(_team_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin access required'; END IF;
 PERFORM id FROM public.vehicles WHERE team_id=_team_id ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.hero_render_jobs WHERE team_id=_team_id AND archived_at IS NULL AND status IN ('rendering','qc','pending')) THEN RAISE EXCEPTION 'Wait for active renders or reviews to finish before resetting'; END IF;
 UPDATE public.hero_render_jobs SET archived_at=now() WHERE team_id=_team_id AND archived_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO public.studio_hero_audit(team_id,actor_id,action,details) VALUES(_team_id,auth.uid(),'fleet_reset',jsonb_build_object('archived_jobs',n)); RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.super_admin_reset_studio_fleet(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_reset_studio_fleet(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.super_admin_studio_review(_result_id uuid,_decision text,_same_vehicle boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.studio_hero_benchmark_results;
BEGIN
 IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin access required'; END IF;
 IF _decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid review decision'; END IF;
 SELECT * INTO b FROM public.studio_hero_benchmark_results WHERE id=_result_id FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Result not found'; END IF;
 IF _decision='approved' AND (b.qc_pass IS DISTINCT FROM true OR b.error IS NOT NULL OR b.render_url IS NULL OR b.review_details IS NULL OR coalesce(b.fidelity_score,0)<8 OR coalesce(b.studio_score,0)<7 OR cardinality(b.qc_failures)>0) THEN RAISE EXCEPTION 'Required quality checks have not passed'; END IF;
 IF _decision='approved' AND b.reference_kind='example' AND NOT _same_vehicle THEN RAISE EXCEPTION 'Confirm that example references show this exact vehicle'; END IF;
 UPDATE public.studio_hero_benchmark_results SET review_status=_decision,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=_result_id;
 INSERT INTO public.studio_hero_audit(team_id,vehicle_id,actor_id,action,details) VALUES(b.team_id,b.vehicle_id,auth.uid(),'candidate_'||_decision,jsonb_build_object('result_id',_result_id,'same_vehicle_confirmed',_same_vehicle));
END $$;
REVOKE ALL ON FUNCTION public.super_admin_studio_review(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_studio_review(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.studio_reserve_attempt(_vehicle_id uuid,_source_id uuid,_actor_id uuid,_prompt text,_version text,_model text) RETURNS public.hero_render_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid; n integer; j public.hero_render_jobs;
BEGIN
 SELECT team_id INTO tid FROM public.vehicles WHERE id=_vehicle_id FOR UPDATE;
 IF tid IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
 IF NOT public.is_super_admin(_actor_id) AND NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=tid AND user_id=_actor_id AND role<>'viewer') THEN RAISE EXCEPTION 'Vehicle access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vehicle_photos WHERE id=_source_id AND vehicle_id=_vehicle_id AND coalesce(source,'')<>'studio_render') THEN RAISE EXCEPTION 'Invalid source photo'; END IF;
 IF EXISTS(SELECT 1 FROM public.hero_render_jobs WHERE vehicle_id=_vehicle_id AND archived_at IS NULL AND status IN ('rendering','qc','pending')) THEN RAISE EXCEPTION 'A render or review is already in progress'; END IF;
 SELECT count(*) INTO n FROM public.hero_render_jobs WHERE vehicle_id=_vehicle_id AND archived_at IS NULL;
 IF n>=3 THEN RAISE EXCEPTION 'Three-render limit reached'; END IF;
 INSERT INTO public.hero_render_jobs(vehicle_id,team_id,source_photo_id,status,attempt_number,prompt_version,prompt_used,render_model) VALUES(_vehicle_id,tid,_source_id,'rendering',n+1,_version,_prompt,_model) RETURNING * INTO j; RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.studio_reserve_attempt(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_reserve_attempt(uuid,uuid,uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.studio_promote_job(_job_id uuid,_actor_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.hero_render_jobs; p public.vehicle_photos; tid uuid;
BEGIN
 SELECT team_id INTO tid FROM public.vehicles WHERE id=(SELECT vehicle_id FROM public.hero_render_jobs WHERE id=_job_id) FOR UPDATE;
 SELECT * INTO j FROM public.hero_render_jobs WHERE id=_job_id FOR UPDATE;
 IF j.id IS NULL OR tid IS DISTINCT FROM j.team_id THEN RAISE EXCEPTION 'Job not found'; END IF;
 IF NOT public.is_super_admin(_actor_id) AND NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=tid AND user_id=_actor_id AND role<>'viewer') THEN RAISE EXCEPTION 'Vehicle access required'; END IF;
 IF j.qc_passed IS DISTINCT FROM true OR j.review_state IS DISTINCT FROM 'passed' OR cardinality(coalesce(j.qc_failure_reasons,'{}'))>0 OR j.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Quality review has not passed'; END IF;
 SELECT * INTO p FROM public.vehicle_photos WHERE id=j.render_photo_id AND vehicle_id=j.vehicle_id AND team_id=tid FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Render photo not found'; END IF;
 UPDATE public.vehicle_photos SET photo_type='exterior',is_visible=CASE WHEN source='studio_render' THEN false ELSE is_visible END,display_order=CASE WHEN display_order=0 THEN 1 ELSE display_order END WHERE vehicle_id=j.vehicle_id AND id<>p.id AND (photo_type='hero' OR display_order=0);
 UPDATE public.vehicle_photos SET photo_type='hero',display_order=0,is_visible=true WHERE id=p.id;
 UPDATE public.vehicles SET image_url=coalesce(p.enhanced_url,p.url) WHERE id=j.vehicle_id;
 UPDATE public.hero_render_jobs SET status='passed',updated_at=now() WHERE id=j.id;
 INSERT INTO public.studio_hero_audit(team_id,vehicle_id,actor_id,action,details) VALUES(tid,j.vehicle_id,_actor_id,'job_promoted',jsonb_build_object('job_id',j.id,'photo_id',p.id));
END $$;
REVOKE ALL ON FUNCTION public.studio_promote_job(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_promote_job(uuid,uuid) TO service_role;
ALTER TABLE public.production_requests ADD COLUMN IF NOT EXISTS requires_modifications boolean;

-- Conserva los estados existentes y agrega el acceso de solo lectura.
DO $$
DECLARE expression text;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint
   WHERE conrelid='public.production_requests'::regclass AND conname='production_requests_workflow_stage_check';
  IF expression IS NULL THEN RAISE EXCEPTION 'No se encontró la restricción de estados'; END IF;
  IF position('TEMPORAL_COMPARTIDA' in expression)=0 THEN
    EXECUTE format('ALTER TABLE public.production_requests DROP CONSTRAINT production_requests_workflow_stage_check, ADD CONSTRAINT production_requests_workflow_stage_check CHECK ((%s) OR workflow_stage = %L)',expression,'TEMPORAL_COMPARTIDA');
  END IF;
END $$;

-- Creación y guardado transaccionales para solicitudes de varias guías.
CREATE OR REPLACE FUNCTION public.create_combo_request(p_request jsonb, p_guides jsonb, p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  new_id text;
  guide jsonb;
BEGIN
  IF jsonb_typeof(p_guides) <> 'array' OR jsonb_array_length(p_guides) < 2 OR jsonb_array_length(p_guides) > 20 THEN
    RAISE EXCEPTION 'El combo debe contener entre 2 y 20 guías';
  END IF;
  IF (SELECT count(DISTINCT x->>'sharepoint_item_id') FROM jsonb_array_elements(p_guides) x) <> jsonb_array_length(p_guides) THEN
    RAISE EXCEPTION 'El combo contiene guías duplicadas';
  END IF;
  INSERT INTO public.production_requests(request_code,sharepoint_item_id,guide_name,product,production_line,production_phase,requester_area,request_reason,guide_type,justification,requires_modifications)
  VALUES(p_request->>'request_code',p_request->>'sharepoint_item_id',p_request->>'guide_name',p_request->>'product',p_request->>'production_line',p_request->>'production_phase',p_request->>'requester_area',p_request->>'request_reason',p_request->>'guide_type',p_request->>'justification',(p_request->>'requires_modifications')::boolean)
  RETURNING id::text INTO new_id;
  FOR guide IN SELECT * FROM jsonb_array_elements(p_guides) LOOP
    INSERT INTO public.production_request_guides(request_id,sharepoint_item_id,guide_name,product,production_line,production_phase)
    VALUES(new_id,guide->>'sharepoint_item_id',guide->>'guide_name',guide->>'product',guide->>'production_line',guide->>'production_phase');
  END LOOP;
  INSERT INTO public.workflow_events(request_id,actor_role,event_type,note)
    SELECT id,'Responsable','Solicitud creada',lower(p_email) FROM public.production_requests WHERE id::text=new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_combo_request(jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_combo_request(jsonb,jsonb,text) TO service_role;


-- Registra la asignación y su responsable en una sola transacción.
CREATE OR REPLACE FUNCTION public.create_asc_assignment_prepared(p_request jsonb,p_guides jsonb,p_emitter text,p_actor text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id text; guide jsonb; total integer;
BEGIN
  SELECT count(*) INTO total FROM public.guide_licenses l JOIN public.app_users u ON lower(u.email::text)=lower(l.email)
   WHERE lower(l.email)=lower(p_emitter) AND l.license_type='Emisor' AND u.is_active=true;
  IF total<>1 THEN RAISE EXCEPTION 'El usuario no es un emisor activo'; END IF;
  IF jsonb_typeof(p_guides) IS DISTINCT FROM 'array' OR jsonb_array_length(p_guides)<1 OR jsonb_array_length(p_guides)>20 THEN RAISE EXCEPTION 'Selecciona entre 1 y 20 guías'; END IF;
  IF (SELECT count(DISTINCT x->>'sharepoint_item_id') FROM jsonb_array_elements(p_guides) x) <> jsonb_array_length(p_guides) THEN RAISE EXCEPTION 'Hay guías duplicadas'; END IF;
  IF NOT (p_request->>'guide_type'='Guía temporal' AND (p_request->>'requires_modifications')::boolean=false) AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_guides) g WHERE coalesce(g->>'baseline_object_path','')='' OR coalesce(g->>'draft_object_path','')='') THEN RAISE EXCEPTION 'Faltan los borradores preparados'; END IF;
  INSERT INTO public.production_requests(request_code,sharepoint_item_id,guide_name,product,production_line,production_phase,requester_area,request_reason,guide_type,justification,workflow_stage,baseline_object_path,draft_object_path,requires_modifications)
  VALUES(p_request->>'request_code',p_request->>'sharepoint_item_id',p_request->>'guide_name',p_request->>'product',p_request->>'production_line',p_request->>'production_phase',p_request->>'requester_area',p_request->>'request_reason',p_request->>'guide_type',p_request->>'justification',CASE WHEN p_request->>'guide_type'='Guía temporal' AND (p_request->>'requires_modifications')::boolean=false THEN 'TEMPORAL_COMPARTIDA' ELSE 'EN_EDICION' END,p_request->>'baseline_object_path',p_request->>'draft_object_path',(p_request->>'requires_modifications')::boolean) RETURNING id::text INTO new_id;
  IF jsonb_array_length(p_guides)>1 THEN
    FOR guide IN SELECT * FROM jsonb_array_elements(p_guides) LOOP
      INSERT INTO public.production_request_guides(request_id,sharepoint_item_id,guide_name,product,production_line,production_phase,baseline_object_path,draft_object_path)
      VALUES(new_id,guide->>'sharepoint_item_id',guide->>'guide_name',guide->>'product',guide->>'production_line',guide->>'production_phase',guide->>'baseline_object_path',guide->>'draft_object_path');
    END LOOP;
  END IF;
  INSERT INTO public.workflow_events(request_id,actor_role,event_type,note)
    SELECT id,'Responsable','Solicitud creada',lower(p_emitter) FROM public.production_requests WHERE id::text=new_id;
  INSERT INTO public.workflow_events(request_id,actor_role,event_type,note)
    SELECT id,'ASC','Asignación directa',lower(p_actor) FROM public.production_requests WHERE id::text=new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_asc_assignment_prepared(jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_asc_assignment_prepared(jsonb,jsonb,text,text) TO service_role;

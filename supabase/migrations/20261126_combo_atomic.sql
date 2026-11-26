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
  INSERT INTO public.production_requests(request_code,sharepoint_item_id,guide_name,product,production_line,production_phase,requester_area,request_reason,guide_type,justification)
  VALUES(p_request->>'request_code',p_request->>'sharepoint_item_id',p_request->>'guide_name',p_request->>'product',p_request->>'production_line',p_request->>'production_phase',p_request->>'requester_area',p_request->>'request_reason',p_request->>'guide_type',p_request->>'justification')
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

CREATE OR REPLACE FUNCTION public.save_combo_guide(p_request_id text, p_guide_id uuid, p_expected_updated_at timestamptz, p_baseline text, p_draft text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_stage text;
BEGIN
  SELECT workflow_stage INTO current_stage FROM public.production_requests WHERE id::text=p_request_id FOR UPDATE;
  IF current_stage IS NULL OR current_stage NOT IN ('EN_EDICION','OBSERVADA_JEFATURA','OBSERVADA_ASC_TECNICA') THEN
    RAISE EXCEPTION 'La edición del combo está cerrada';
  END IF;
  UPDATE public.production_request_guides SET baseline_object_path=p_baseline,draft_object_path=p_draft,updated_at=now()
   WHERE id=p_guide_id AND request_id=p_request_id AND updated_at=p_expected_updated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'La guía cambió durante el guardado'; END IF;
  UPDATE public.production_requests SET updated_at=now() WHERE id::text=p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.save_combo_guide(text,uuid,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_combo_guide(text,uuid,timestamptz,text,text) TO service_role;

-- Guarda todas las guías procesadas y cambia la etapa en la misma transacción.
CREATE OR REPLACE FUNCTION public.commit_combo_versions(p_request_id text,p_expected_stage text,p_next_stage text,p_versions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_stage text; version jsonb; expected_count integer;
BEGIN
  SELECT workflow_stage INTO current_stage FROM public.production_requests WHERE id::text=p_request_id FOR UPDATE;
  IF current_stage IS DISTINCT FROM p_expected_stage THEN RAISE EXCEPTION 'La etapa del combo cambió'; END IF;
  IF p_expected_stage <> 'PENDIENTE_ASC_TECNICA' OR p_next_stage <> 'APROBADA_TECNICA' THEN RAISE EXCEPTION 'Transición no permitida'; END IF;
  SELECT count(*) INTO expected_count FROM public.production_request_guides WHERE request_id=p_request_id;
  IF expected_count < 2 OR jsonb_typeof(p_versions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_versions) <> expected_count THEN RAISE EXCEPTION 'Faltan guías del combo'; END IF;
  FOR version IN SELECT * FROM jsonb_array_elements(p_versions) LOOP
    UPDATE public.production_request_guides SET baseline_object_path=version->>'baseline',draft_object_path=version->>'draft',updated_at=now()
     WHERE id::text=version->>'id' AND request_id=p_request_id AND updated_at=(version->>'updated_at')::timestamptz;
    IF NOT FOUND THEN RAISE EXCEPTION 'Una guía del combo cambió'; END IF;
  END LOOP;
  UPDATE public.production_requests SET workflow_stage=p_next_stage,updated_at=now() WHERE id::text=p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.commit_combo_versions(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_combo_versions(text,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.sign_combo_step(p_request_id text,p_email text,p_step text,p_versions jsonb,p_signed_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_step text; next_step text; version jsonb; expected_count integer; current_stage text;
BEGIN
  SELECT step INTO current_step FROM public.guide_signature_routes WHERE request_id=p_request_id FOR UPDATE;
  IF current_step IS DISTINCT FROM p_step THEN RAISE EXCEPTION 'La etapa de firma cambió'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guide_signature_members m JOIN public.app_users u ON u.email=m.email WHERE m.request_id=p_request_id AND m.email=lower(p_email) AND m.step=p_step AND m.signed_at IS NULL AND u.is_active) THEN RAISE EXCEPTION 'La firma no está pendiente para este usuario'; END IF;
  SELECT workflow_stage INTO current_stage FROM public.production_requests WHERE id::text=p_request_id FOR UPDATE;
  IF current_stage IS DISTINCT FROM 'APROBADA_TECNICA' THEN RAISE EXCEPTION 'La guía no está aprobada técnicamente'; END IF;
  SELECT count(*) INTO expected_count FROM public.production_request_guides WHERE request_id=p_request_id;
  IF expected_count<2 OR jsonb_typeof(p_versions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_versions)<>expected_count THEN RAISE EXCEPTION 'Faltan guías del combo'; END IF;
  FOR version IN SELECT * FROM jsonb_array_elements(p_versions) LOOP
    UPDATE public.production_request_guides SET draft_object_path=version->>'draft',updated_at=now()
     WHERE id::text=version->>'id' AND request_id=p_request_id AND draft_object_path=version->>'previous' AND updated_at=(version->>'updated_at')::timestamptz;
    IF NOT FOUND THEN RAISE EXCEPTION 'Una guía del combo cambió durante la firma'; END IF;
  END LOOP;
  UPDATE public.guide_signature_members SET signed_at=p_signed_at WHERE request_id=p_request_id AND email=lower(p_email) AND step=p_step;
  IF NOT EXISTS (SELECT 1 FROM public.guide_signature_members WHERE request_id=p_request_id AND step=p_step AND signed_at IS NULL) THEN
    next_step=CASE p_step WHEN 'Elaborador' THEN 'Revision' WHEN 'Revision' THEN 'Aprobacion' ELSE 'Lista para publicar' END;
    UPDATE public.guide_signature_routes SET step=next_step WHERE request_id=p_request_id;
  ELSE next_step=current_step; END IF;
  RETURN next_step;
END $$;
REVOKE ALL ON FUNCTION public.sign_combo_step(text,text,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_combo_step(text,text,text,jsonb,timestamptz) TO service_role;

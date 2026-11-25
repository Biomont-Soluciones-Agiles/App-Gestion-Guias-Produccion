-- Una ruta por solicitud, con integrantes y etapas independientes.
CREATE TABLE IF NOT EXISTS public.guide_signature_routes (
  request_id text PRIMARY KEY,
  step text NOT NULL CHECK (step IN ('Elaborador','Revision','Aprobacion','Lista para publicar','Publicada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  published_item_id text
);
CREATE TABLE IF NOT EXISTS public.guide_signature_members (
  request_id text NOT NULL REFERENCES public.guide_signature_routes(request_id),
  email text NOT NULL,
  display_name text NOT NULL,
  step text NOT NULL CHECK (step IN ('Elaborador','Revision','Aprobacion')),
  signed_at timestamptz,
  PRIMARY KEY (request_id,email,step)
);
ALTER TABLE public.guide_signature_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_signature_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.guide_signature_routes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.guide_signature_members TO service_role;

-- Registra firmas y el archivo resultante de manera atómica.
CREATE OR REPLACE FUNCTION public.sign_guide_step(
  p_request_id text, p_email text, p_step text, p_expected_path text, p_new_path text, p_signed_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  current_step text;
  next_step text;
BEGIN
  SELECT step INTO current_step FROM public.guide_signature_routes WHERE request_id=p_request_id FOR UPDATE;
  IF current_step IS NULL OR current_step<>p_step THEN RAISE EXCEPTION 'La etapa de firma cambió'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guide_signature_members m JOIN public.app_users u ON u.email=m.email WHERE m.request_id=p_request_id AND m.email=lower(p_email) AND m.step=p_step AND m.signed_at IS NULL AND u.is_active) THEN
    RAISE EXCEPTION 'La firma no está pendiente para este usuario';
  END IF;
  UPDATE public.production_requests SET draft_object_path=p_new_path,updated_at=now()
   WHERE id::text=p_request_id AND draft_object_path=p_expected_path AND workflow_stage='APROBADA_TECNICA';
  IF NOT FOUND THEN RAISE EXCEPTION 'La guía cambió durante la firma'; END IF;
  UPDATE public.guide_signature_members SET signed_at=p_signed_at
   WHERE request_id=p_request_id AND email=lower(p_email) AND step=p_step;
  IF NOT EXISTS (SELECT 1 FROM public.guide_signature_members WHERE request_id=p_request_id AND step=p_step AND signed_at IS NULL) THEN
    next_step=CASE p_step WHEN 'Elaborador' THEN 'Revision' WHEN 'Revision' THEN 'Aprobacion' ELSE 'Lista para publicar' END;
    UPDATE public.guide_signature_routes SET step=next_step WHERE request_id=p_request_id;
  ELSE next_step=current_step;
  END IF;
  RETURN next_step;
END $$;
REVOKE ALL ON FUNCTION public.sign_guide_step(text,text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_guide_step(text,text,text,text,text,timestamptz) TO service_role;

-- Inicia la ruta con el solicitante registrado y participantes habilitados.
CREATE OR REPLACE FUNCTION public.start_guide_route(
  p_request_id text, p_reviewers text[], p_approvers text[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  current_stage text;
  owner_email text;
  owner_name text;
  candidate text;
BEGIN
  SELECT workflow_stage INTO current_stage FROM public.production_requests WHERE id::text=p_request_id FOR UPDATE;
  IF current_stage IS DISTINCT FROM 'APROBADA_TECNICA' THEN RAISE EXCEPTION 'La guía no está aprobada técnicamente'; END IF;
  IF coalesce(cardinality(p_reviewers),0)<1 OR coalesce(cardinality(p_approvers),0)<1 OR cardinality(p_reviewers)>20 OR cardinality(p_approvers)>20 THEN
    RAISE EXCEPTION 'Selecciona al menos un revisor y un aprobador';
  END IF;
  SELECT lower(note) INTO owner_email FROM public.workflow_events
   WHERE request_id::text=p_request_id AND event_type='Solicitud creada' LIMIT 1;
  SELECT full_name INTO owner_name FROM public.app_users WHERE email=owner_email AND is_active=true;
  IF owner_email IS NULL OR owner_name IS NULL THEN RAISE EXCEPTION 'No se encontró al solicitante activo de la guía'; END IF;
  FOREACH candidate IN ARRAY p_reviewers LOOP
    IF NOT EXISTS (SELECT 1 FROM public.guide_licenses l JOIN public.app_users u ON u.email=l.email
      WHERE l.email=lower(candidate) AND l.license_type='Participante' AND l.can_review AND u.is_active) THEN
      RAISE EXCEPTION 'Uno de los revisores no está habilitado';
    END IF;
  END LOOP;
  FOREACH candidate IN ARRAY p_approvers LOOP
    IF NOT EXISTS (SELECT 1 FROM public.guide_licenses l JOIN public.app_users u ON u.email=l.email
      WHERE l.email=lower(candidate) AND l.license_type='Participante' AND l.can_approve AND u.is_active) THEN
      RAISE EXCEPTION 'Uno de los aprobadores no está habilitado';
    END IF;
  END LOOP;
  INSERT INTO public.guide_signature_routes(request_id,step) VALUES(p_request_id,'Elaborador');
  INSERT INTO public.guide_signature_members(request_id,email,display_name,step)
    VALUES(p_request_id,owner_email,owner_name,'Elaborador');
  INSERT INTO public.guide_signature_members(request_id,email,display_name,step)
    SELECT DISTINCT p_request_id,l.email,l.display_name,'Revision' FROM public.guide_licenses l WHERE l.email=ANY(ARRAY(SELECT lower(x) FROM unnest(p_reviewers) x));
  INSERT INTO public.guide_signature_members(request_id,email,display_name,step)
    SELECT DISTINCT p_request_id,l.email,l.display_name,'Aprobacion' FROM public.guide_licenses l WHERE l.email=ANY(ARRAY(SELECT lower(x) FROM unnest(p_approvers) x));
END $$;
REVOKE ALL ON FUNCTION public.start_guide_route(text,text[],text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_guide_route(text,text[],text[]) TO service_role;

-- Habilita el combo solo después de guardar todos sus borradores iniciales.
CREATE OR REPLACE FUNCTION public.prepare_combo_edit(p_request_id text,p_versions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_stage text; entry jsonb; expected_count integer;
BEGIN
  SELECT workflow_stage INTO current_stage FROM public.production_requests WHERE id::text=p_request_id FOR UPDATE;
  IF current_stage IS DISTINCT FROM 'PENDIENTE_ASC_INICIAL' THEN RAISE EXCEPTION 'La solicitud ya no está pendiente'; END IF;
  SELECT count(*) INTO expected_count FROM public.production_request_guides WHERE request_id=p_request_id;
  IF expected_count<2 OR jsonb_typeof(p_versions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_versions)<>expected_count THEN RAISE EXCEPTION 'Faltan guías del combo'; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(p_versions) LOOP
    UPDATE public.production_request_guides SET baseline_object_path=entry->>'baseline',draft_object_path=entry->>'draft',updated_at=now()
     WHERE id::text=entry->>'id' AND request_id=p_request_id AND updated_at=(entry->>'updated_at')::timestamptz AND baseline_object_path IS NULL AND draft_object_path IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Una guía cambió durante la aprobación'; END IF;
  END LOOP;
  UPDATE public.production_requests SET workflow_stage='EN_EDICION',updated_at=now() WHERE id::text=p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_combo_edit(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_combo_edit(text,jsonb) TO service_role;

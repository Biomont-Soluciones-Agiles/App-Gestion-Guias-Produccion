-- Licencias y elegibilidad para la ruta de firmas.
CREATE TABLE IF NOT EXISTS public.guide_licenses (
  email text PRIMARY KEY,
  display_name text NOT NULL,
  license_type text NOT NULL CHECK (license_type IN ('Emisor', 'Participante')),
  can_review boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (license_type = 'Participante' OR (NOT can_review AND NOT can_approve))
);
ALTER TABLE public.guide_licenses ENABLE ROW LEVEL SECURITY;
-- Conserva las reglas de roles existentes y permite el rol Participante.
DO $$
DECLARE
  expression text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid)
    INTO expression
    FROM pg_constraint
   WHERE conrelid = 'public.app_users'::regclass
     AND conname = 'app_users_app_role_check';
  IF expression IS NULL THEN
    RAISE EXCEPTION 'No se encontró la restricción de roles existente';
  END IF;
  IF position('Participante' in expression) = 0 THEN
    EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT app_users_app_role_check, ADD CONSTRAINT app_users_app_role_check CHECK ((%s) OR app_role = %L)', expression, 'Participante');
  END IF;
END $$;

-- Actualiza la licencia y el acceso asociado en una sola transacción.
CREATE OR REPLACE FUNCTION public.set_guide_license(
  p_email text, p_name text, p_license text, p_review boolean, p_approve boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_license NOT IN ('Emisor','Participante') THEN RAISE EXCEPTION 'Licencia inválida'; END IF;
  IF p_license = 'Emisor' AND (p_review OR p_approve) THEN RAISE EXCEPTION 'Flujo inválido'; END IF;
  INSERT INTO public.guide_licenses(email,display_name,license_type,can_review,can_approve)
  VALUES (lower(p_email),p_name,p_license,p_review,p_approve)
  ON CONFLICT (email) DO UPDATE SET display_name=excluded.display_name,license_type=excluded.license_type,
    can_review=excluded.can_review,can_approve=excluded.can_approve,updated_at=now();
  INSERT INTO public.app_users(email,full_name,app_role,is_active)
  VALUES (lower(p_email),p_name,CASE WHEN p_license='Emisor' THEN 'Responsable' ELSE 'Participante' END,true)
  ON CONFLICT (email) DO UPDATE SET full_name=excluded.full_name,
    app_role=CASE WHEN app_users.app_role IN ('ASC','Jefatura','Administrador') THEN app_users.app_role ELSE excluded.app_role END;
END $$;
REVOKE ALL ON FUNCTION public.set_guide_license(text,text,text,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_guide_license(text,text,text,boolean,boolean) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guide_licenses TO service_role;

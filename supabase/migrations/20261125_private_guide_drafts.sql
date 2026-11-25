-- Las guías en edición se almacenan en un bucket privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('guias-borradores', 'guias-borradores', false, 12582912)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='guias-borradores' AND public) THEN
    RAISE EXCEPTION 'El bucket guias-borradores debe ser privado';
  END IF;
END $$;

ALTER TABLE public.production_requests
  ADD COLUMN IF NOT EXISTS draft_object_path text,
  ADD COLUMN IF NOT EXISTS baseline_object_path text;

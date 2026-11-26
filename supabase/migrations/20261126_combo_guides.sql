-- Cada fila representa un Excel dentro de una solicitud. Las solicitudes
-- anteriores permanecen intactas y no se convierten automáticamente.
CREATE TABLE IF NOT EXISTS public.production_request_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  sharepoint_item_id text NOT NULL,
  guide_name text NOT NULL,
  product text,
  production_line text,
  production_phase text,
  baseline_object_path text,
  draft_object_path text,
  publication_state text NOT NULL DEFAULT 'Pendiente'
    CHECK (publication_state IN ('Pendiente', 'Publicada')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, sharepoint_item_id)
);

CREATE INDEX IF NOT EXISTS production_request_guides_request_id_idx
  ON public.production_request_guides (request_id);
ALTER TABLE public.production_request_guides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_request_guides FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_request_guides TO service_role;

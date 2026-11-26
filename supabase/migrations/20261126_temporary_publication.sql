-- Identifica el archivo temporal creado para cada guía de un combo.
ALTER TABLE public.production_request_guides
  ADD COLUMN IF NOT EXISTS published_item_id text;

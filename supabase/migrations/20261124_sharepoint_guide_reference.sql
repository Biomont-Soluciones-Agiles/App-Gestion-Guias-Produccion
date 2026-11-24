-- Guarda el identificador estable del archivo seleccionado en la biblioteca configurada.
-- Las solicitudes existentes permanecen sin vincular hasta verificar su correspondencia.
ALTER TABLE public.production_requests
  ADD COLUMN IF NOT EXISTS sharepoint_item_id text;

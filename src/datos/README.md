# src/datos

Único lugar donde la aplicación lee o escribe datos. Una función por acción de negocio (`listarPedidos`, `guardarPedido`, `aprobarPedido`).

- En el prototipo, estas funciones usan Supabase.
- En Code Apps, se reescriben para Dataverse y conectores **con los mismos nombres y parámetros**, para que las pantallas no cambien.

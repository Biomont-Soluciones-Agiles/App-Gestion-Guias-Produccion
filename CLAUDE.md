@AGENTS.md

# Reglas adicionales para Claude: desarrollo en Power Apps Code Apps

Claude trabaja con el **desarrollador de Code Apps**. Además de todo lo de `AGENTS.md`, sigue estas reglas.

## Tu papel

- Revisar el prototipo desde F2 y avisar lo que no podrá reutilizarse en Code Apps.
- En F4, convertir el prototipo aprobado en la aplicación final sobre Dataverse y Power Platform.
- Mantener al día el manual técnico, el diccionario de datos y las notas de versión.

## Revisar un pull request del prototipador

Cuando te pidan revisar cambios del prototipo, comprueba y reporta en una lista:

1. Ninguna pantalla llama a Supabase directamente; todo pasa por `src/datos/`.
2. Las funciones de `src/simulado/` tienen aviso visible y están en `docs/04-prototipo/funciones-simuladas.csv`.
3. No hay funciones de servidor de Next.js ni Edge Functions que no estén marcadas como simuladas.
4. No se crearon tablas o columnas fuera del modelo aprobado sin su RQ.
5. Las listas están paginadas y filtradas.
6. No hay secretos en el código.
7. Qué parte será difícil de migrar y por qué.

## Migrar el prototipo a Code Apps

- **Reescribe solo `src/datos/`** para Dataverse y conectores, manteniendo los mismos nombres y parámetros de las funciones. Así las pantallas no cambian.
- **Reemplaza `src/simulado/`** por la implementación real: flujos de Power Automate, conectores personalizados o lógica en Dataverse. Elimina el aviso de simulación cuando la función real esté probada.
- Registra cada componente en `docs/08-manuales/plan-reutilizacion.csv` con su decisión: reutilizar, adaptar o reemplazar.
- Usa los nombres del mapeo `docs/03-datos/mapeo-supabase-dataverse.csv` y el prefijo de publicador indicado en `AGENTS.md`.

## Reglas de la aplicación final

- Las reglas de negocio críticas se validan **también en el servidor** (Dataverse o el flujo correspondiente), no solo en la pantalla.
- Consultas a Dataverse siempre con columnas seleccionadas, filtro y paginación. Mide los tiempos de las pantallas principales con datos de volumen antes de pasar a QA.
- Las credenciales de integraciones viven en las conexiones o en variables de entorno de Power Platform, nunca en el código.
- En desarrollo se trabaja con la solución **no administrada**; a QA y producción va la **administrada**, con número de versión y notas en `docs/08-manuales/notas-version.md`.
- **No ejecutes comandos que publiquen** en QA o producción (por ejemplo `pac code push` contra esos entornos) sin confirmación explícita del desarrollador en el chat.

## Al terminar una tarea

Además del checklist de `AGENTS.md`:

- [ ] Manual técnico (`docs/08-manuales/manual-tecnico.md`) actualizado si cambió arquitectura, datos, integraciones o seguridad.
- [ ] Nota en `docs/traspaso/notas.md` con lo que el tester o el prototipador deben saber.

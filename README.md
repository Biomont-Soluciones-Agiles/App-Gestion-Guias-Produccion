# Guías de Producción

Prototipo de Biomont para centralizar la solicitud, revisión, aprobación y distribución de guías de producción.

## Estado actual

- Pantalla **PT-01 · Inicio del Responsable**.
- Consulta de solicitudes recientes con datos ficticios.
- Registro simulado de una solicitud de editable para ASC.
- Notificación simulada, visible en pantalla, para el equipo ASC.

## Tecnología

React + Vite + TypeScript. Los accesos a datos están encapsulados en `src/datos/` y las integraciones que se implementarán en Power Platform se simulan desde `src/simulado/`.

## Inicio local

```bash
npm install
npm run dev
```

No se incluyen credenciales ni conexiones reales en este repositorio.

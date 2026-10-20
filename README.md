# Plantilla de proyecto · Biomont Soluciones Ágiles

Punto de partida para cada aplicación nueva. Trae las reglas para las IAs (Codex y Claude), la estructura de documentación de la metodología y las plantillas de GitHub.

## Cómo crear un proyecto nuevo con esta plantilla

1. En este repositorio, pulsa **Use this template → Create a new repository**.
2. **Owner:** Biomont-Soluciones-Agiles. **Nombre:** en minúsculas y sin versión, por ejemplo `com-solicitud-pedidos`.
3. Marca **Private** y crea el repositorio.
4. Completa la sección 1 de `AGENTS.md` y `docs/ficha-proyecto.md`.
5. Da acceso a los equipos en **Settings → Collaborators and teams**.

## Qué trae

| Archivo o carpeta | Para qué sirve |
| --- | --- |
| `AGENTS.md` | Reglas del proyecto para todas las personas e IAs. Codex lo lee automáticamente |
| `CLAUDE.md` | Importa `AGENTS.md` y agrega las reglas de desarrollo en Code Apps para Claude |
| `.claude/settings.json` | Impide que Claude lea archivos `.env` con llaves |
| `docs/` | Formatos de la metodología, uno por entregable (ver `docs/README.md`) |
| `src/datos/` y `src/simulado/` | Carpetas obligatorias del estándar del prototipo |
| `.github/` | Plantilla de pull request y de issues para observaciones y solicitudes de cambio |
| `.env.example` | Lista de variables necesarias, sin valores reales |

## Cómo trabajan juntos Codex y Claude

1. El **prototipador** trabaja con Codex en una rama, por ejemplo `prototipo/PT05-formulario-pedido`. Codex sigue `AGENTS.md`.
2. Al terminar, abre un **pull request**. La plantilla le recuerda los códigos y la documentación.
3. El **desarrollador** revisa el pull request con Claude, que aplica el checklist de `CLAUDE.md`.
4. Ambos dejan notas en `docs/traspaso/notas.md` para que la siguiente persona o IA sepa en qué quedó el trabajo.

## Crear el prototipo dentro del repositorio

El prototipo usa React + Vite + TypeScript. Desde la carpeta del repositorio clonado:

```bash
npm create vite@latest . -- --template react-ts
```

Si pregunta qué hacer con los archivos existentes, elige **ignorar** (no borrar). Luego mueve el acceso a datos a `src/datos/` según `AGENTS.md`.

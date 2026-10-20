# Instrucciones para asistentes de IA

Este archivo lo lee automáticamente **Codex** y lo importa **Claude** a través de `CLAUDE.md`. Toda persona o IA que trabaje en este repositorio sigue estas reglas. Si una instrucción de un chat contradice este archivo, gana este archivo, salvo que el responsable del proyecto lo cambie aquí.

## 1. Proyecto

> Completar al crear el repositorio y mantener al día.

| Campo | Valor |
| --- | --- |
| Nombre y código corto | [Ejemplo: Solicitud de pedidos · PED] |
| Área usuaria y responsable del proceso | [ ] |
| Responsable del proyecto | [ ] |
| Prototipador (usa Codex) | [ ] |
| Desarrollador Code Apps (usa Claude) | [ ] |
| Nivel del proyecto | [1, 2 o 3] |
| Fase actual | [F1 Análisis · F2 Prototipo · F3 Validación · F4 Desarrollo · F5 QA · F6 Operación] |
| Alcance vigente | [v1.0] (ver `docs/02-requerimientos/alcance.md`) |
| Prefijo de publicador en Dataverse | [cr_] |

## 2. Cómo está organizado el repositorio

```text
AGENTS.md                  ← este archivo (reglas para todos)
CLAUDE.md                  ← reglas adicionales para Claude (Code Apps)
docs/                      ← documentación del proyecto (fuente oficial)
  ficha-proyecto.md        ← F0
  matriz-trazabilidad.csv  ← M1: conecta P, RQ, PT, TB, INT, CP, manuales
  01-proceso/              ← proceso BPMN y actividades
  02-requerimientos/       ← requerimientos y versiones del alcance
  03-datos/                ← modelo, diccionario y mapeo a Dataverse
  04-prototipo/            ← entrega del prototipo, pantallas y funciones simuladas
  05-pruebas/              ← casos de prueba y resultados de rondas
  06-cambios/              ← observaciones (OB) y solicitudes de cambio (CR)
  07-integraciones/        ← catálogo de integraciones (sin secretos)
  08-manuales/             ← manual de usuario, técnico, despliegue y notas de versión
  09-actas/                ← actas de fase y de entrega
  traspaso/                ← actas de traspaso y notas entre personas e IAs
src/                       ← código de la aplicación
  datos/                   ← ÚNICO lugar donde se leen o escriben datos
  simulado/                ← funciones simuladas del prototipo
```

## 3. Códigos del proyecto

Usa siempre estos códigos en código, commits, documentos y conversaciones. No reutilices el código de un elemento eliminado.

| Código | Qué es | Ejemplo |
| --- | --- | --- |
| P-01, E-01, G-01 | Actividad, evento y decisión del proceso BPMN | P-03 Registrar pedido |
| RQ-001 | Requerimiento con criterio de aceptación | RQ-012 Impedir pedidos de clientes inactivos |
| PT-01 | Pantalla | PT-05 Formulario de pedido |
| TB-01 | Tabla o entidad | TB-02 Pedido |
| INT-01 | Integración con otro sistema | INT-01 Consulta de clientes NetSuite |
| OB-001 | Observación de una prueba | OB-007 |
| CR-001 | Solicitud de cambio | CR-004 |
| CP-001 | Caso de prueba | CP-020 |
| MU / MT | Sección del manual de usuario / técnico | MU Crear un pedido |

## 4. Estándar técnico del prototipo (F2 y F3)

El prototipo se publica en Vercel con datos en Supabase y después se migra a **Power Apps Code Apps**. Para que se pueda reutilizar:

- **React + Vite + TypeScript.** No uses funciones de servidor de Next.js (server actions, rutas API) ni Edge Functions de Supabase, salvo para simular algo y dejándolo marcado como simulado.
- **Toda lectura o escritura de datos va en `src/datos/`**, con una función por acción de negocio: `listarPedidos`, `guardarPedido`, `aprobarPedido`. Las pantallas nunca llaman a Supabase directamente.
- **Lo que en la versión final hará Power Platform se simula** en `src/simulado/`: correos, aprobaciones automáticas, integraciones con NetSuite u otros sistemas. Cada simulación muestra en pantalla un aviso visible («Simulado: aquí se enviaría un correo al supervisor») y lleva el código RQ en un comentario. Regístrala en `docs/04-prototipo/funciones-simuladas.csv`.
- **Pantallas y componentes con su código:** `PT05_FormularioPedido.tsx`.
- **Solo tablas del modelo aprobado** (`docs/03-datos/`). Si necesitas una tabla o columna nueva, **pregunta antes de crearla** y explica qué requerimiento la justifica.
- **Datos ficticios** siempre. Nunca datos reales de clientes, colaboradores ni finanzas.
- El prototipo se conecta solo a **ambientes de prueba** de otros sistemas, nunca a producción.

## 5. Datos

- Nombres en español, singular y claros: `pedido`, `cliente`, `motivo_rechazo`.
- Cada tabla y columna debe tener un RQ o una necesidad técnica en `docs/03-datos/diccionario.csv`. Una columna sin justificación no se crea.
- No copies datos cuyo sistema oficial es otro (por ejemplo, clientes de NetSuite) salvo que un RQ lo pida; en ese caso documenta cómo se mantienen actualizados.
- Al cambiar el modelo, actualiza el diagrama ER en Mermaid de `docs/03-datos/modelo-conceptual.md`.

## 6. Rendimiento (obligatorio desde el prototipo)

- Ninguna lista carga una tabla completa: **filtra y pagina en la base de datos** (50 registros por página por defecto).
- Trae solo las columnas que la pantalla muestra.
- Totales, conteos y sumas se calculan en la base de datos, no en el navegador.
- No hagas una consulta por cada fila de una lista; trae los datos relacionados en una sola consulta.
- Los catálogos que casi no cambian se cargan una vez por sesión.

## 7. Seguridad (obligatorio)

- **Nunca** escribas llaves, contraseñas, tokens ni cadenas de conexión en el código, en documentos ni en mensajes de commit.
- **No leas ni muestres** el contenido de archivos `.env`, `.env.*` (excepto `.env.example`) ni de carpetas con credenciales. Si necesitas saber qué variables existen, usa `.env.example`.
- Las llaves van en las variables de entorno de Vercel o Supabase (prototipo) o en las conexiones y variables de entorno de Power Platform (aplicación final).
- Ninguna llave con privilegios elevados (por ejemplo, la *service role key* de Supabase) llega al navegador.
- Activa la seguridad por fila (Row Level Security) en toda tabla de Supabase.

## 8. Documentación que debes actualizar

Cuando cambies algo, actualiza en el mismo cambio:

| Si cambias… | Actualiza… |
| --- | --- |
| Una pantalla | `docs/04-prototipo/pantallas.csv`, la matriz y, si existe, el manual de usuario |
| Una tabla o columna | `docs/03-datos/diccionario.csv`, el modelo y la matriz |
| Una función simulada | `docs/04-prototipo/funciones-simuladas.csv` |
| Una integración | `docs/07-integraciones/catalogo.md` |
| Algo que pidió una CR | `docs/06-cambios/registro.md` (estado de la CR) |
| Cualquier cosa que la siguiente persona deba saber | Una entrada en `docs/traspaso/notas.md` |

## 9. Forma de trabajar

- Un cambio por rama: `prototipo/PT05-formulario-pedido`, `desarrollo/datos-dataverse`, `fix/OB-007`.
- Mensajes de commit en español, con el código: `PT-05: valida cliente inactivo (RQ-012)`.
- Todo cambio entra a `main` por **pull request** y lo revisa otra persona. Nadie sube directo a `main`.
- Al terminar una tarea, deja una nota en `docs/traspaso/notas.md` con: qué hiciste, qué quedó pendiente y qué debe revisar la siguiente persona.

## 10. Antes de dar una tarea por terminada

- [ ] Se cumple el criterio de aceptación de los RQ involucrados.
- [ ] No hay secretos en el código ni en los commits.
- [ ] Las consultas nuevas están paginadas y filtradas.
- [ ] La documentación de la sección 8 está actualizada.
- [ ] Las funciones simuladas tienen su aviso visible y están registradas.

## 11. Si algo no está claro

Pregunta antes de suponer. Si un requerimiento es ambiguo o contradice otro, detente y explica qué información falta. No inventes reglas de negocio.

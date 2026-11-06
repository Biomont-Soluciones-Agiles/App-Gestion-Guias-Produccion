export type EstadoSolicitud = 'En revisión ASC' | 'Editable disponible' | 'Borrador';

export interface Solicitud {
  id: string;
  guia: string;
  area: string;
  estado: EstadoSolicitud;
  fecha: string;
}

const solicitudesIniciales: Solicitud[] = [
  { id: 'SOL-014', guia: 'GP-014 · Limpieza de equipos', area: 'Producción', estado: 'En revisión ASC', fecha: 'Hoy, 09:42' },
  { id: 'SOL-022', guia: 'GP-022 · Control de envasado', area: 'Producción', estado: 'Editable disponible', fecha: 'Ayer, 15:10' },
  { id: 'SOL-008', guia: 'GP-008 · Preparación de lote', area: 'Producción', estado: 'Borrador', fecha: '03 nov' },
];

/** RQ-001: acceso simulado a solicitudes del Responsable. */
export async function listarSolicitudes(): Promise<Solicitud[]> {
  return solicitudesIniciales;
}

/** RQ-002: registra una solicitud en el prototipo; se reemplazará por Supabase. */
export async function guardarSolicitud(guia: string): Promise<Solicitud> {
  return { id: `SOL-${Date.now()}`, guia, area: 'Producción', estado: 'En revisión ASC', fecha: 'Ahora' };
}
const base = () => process.env.SUPABASE_URL + '/rest/v1/production_requests';
const headers = () => ({ apikey: process.env.SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const editable = ['EN_EDICION', 'OBSERVADA_JEFATURA', 'OBSERVADA_ASC_TECNICA'];
const fail = (status, message) => Object.assign(Error(message), {status});
async function getRequest(id) {
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) throw fail(400, 'Solicitud inválida.');
  const r = await fetch(base() + '?id=eq.' + id + '&select=*,workflow_events(actor_role,event_type,note)', {headers:headers()});
  if (!r.ok) throw fail(502, 'No se pudo consultar la solicitud.');
  const [row] = await r.json();
  if (!row) throw fail(404, 'No se encontró la solicitud.');
  return row;
}
function canEdit(user, row) {
  const creation = row.workflow_events?.find(e => e.event_type === 'Solicitud creada');
  // Solicitudes anteriores al registro del correo pertenecen a la bandeja histórica del Responsable.
  return editable.includes(row.workflow_stage) && (user.role === 'Administrador' ||
    (user.role === 'Responsable' && (creation?.note || 'molin@biomont.com.pe') === user.email));
}
async function commit(row, patch) {
  const match = new URLSearchParams({ id: 'eq.' + row.id, workflow_stage: 'eq.' + row.workflow_stage,
    sharepoint_item_id: row.sharepoint_item_id ? 'eq.' + row.sharepoint_item_id : 'is.null',
    draft_object_path: row.draft_object_path ? 'eq.' + row.draft_object_path : 'is.null',
    baseline_object_path: row.baseline_object_path ? 'eq.' + row.baseline_object_path : 'is.null',
    updated_at: row.updated_at ? 'eq.' + row.updated_at : 'is.null' });
  const r = await fetch(base() + '?' + match, {method:'PATCH', headers:headers(), body:JSON.stringify({...patch, updated_at:new Date().toISOString()})});
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    console.error('Error al actualizar etapa de solicitud', { status: r.status, code: detail.code, message: detail.message });
    if (detail.code === '23514' || detail.code === '22P02') throw fail(409, 'La base de datos no acepta el estado solicitado. Es necesario revisar la configuración del flujo.');
    throw fail(502, 'No se pudo guardar el cambio en la base de datos. Inténtalo nuevamente.');
  }
  const [saved] = await r.json();
  if (!saved) throw fail(409, 'La solicitud cambió. Vuelve a abrir la guía.');
  return saved;
}
module.exports = { getRequest, canEdit, editable, commit, fail };

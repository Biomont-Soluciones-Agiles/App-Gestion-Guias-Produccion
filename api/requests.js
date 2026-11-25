const { session, hasRole } = require('./_auth');
const {getRequest, commit, canEdit, editable, fail} = require('../lib/request-state');
const {connectLibrary, draftPrefix} = require('../lib/sharepoint');
const url = () => `${process.env.SUPABASE_URL}/rest/v1`;
const headers = () => ({ apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const send = (res, code, body) => res.status(code).json(body);

module.exports = async (req, res) => {
  const user = session(req); if (!user) return send(res, 401, { error: 'Sesión requerida.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return send(res, 500, { error: 'Supabase no está configurado.' });
  try {
    if (req.method === 'GET') {
      if (!['Responsable','Jefatura','ASC'].some(role => hasRole(user,role))) return send(res, 200, []);
      const response = await fetch(`${url()}/production_requests?select=*,workflow_events(*)&order=created_at.desc`, { headers: headers() });
      return send(res, response.status, await response.json());
    }
    if (req.method === 'POST') {
      const { action, request, id, stage, actor, event, note, itemId } = req.body || {};
      if (action === 'create') {
        if (!hasRole(user,'Responsable')) throw fail(403,'Solo el Responsable puede crear solicitudes.');
        const allowed = ['request_code','sharepoint_item_id','guide_name','product','production_line','production_phase','requester_area','request_reason','guide_type','justification'];
        const fields = Object.fromEntries(allowed.map(key => [key, request?.[key]]));
        if (!/^[A-Za-z0-9_-]+$/.test(fields.sharepoint_item_id || '')) throw fail(400,'Selecciona una guía del catálogo.');
        const library = await connectLibrary();
        const [source,root] = await Promise.all([library.item(fields.sharepoint_item_id), library.json('/drives/'+library.drive.id+'/root?$select=id')]);
        if (!source.file || !/\.xlsx$/i.test(source.name) || source.name.startsWith(draftPrefix) || source.parentReference?.id !== root.id) throw fail(400,'Selecciona un Excel del catálogo.');
        fields.guide_name = source.name;
        const response = await fetch(`${url()}/production_requests`, { method: 'POST', headers: headers(), body: JSON.stringify(fields) });
        const rows = await response.json();
        if (!response.ok) return send(res, response.status, rows);
        await fetch(`${url()}/workflow_events`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: rows[0].id, actor_role: 'Responsable', event_type: 'Solicitud creada', note:user.email }) });
        return send(res, 201, rows[0]);
      }
      if (action === 'update') {
        const row=await getRequest(id);
        const transitions = {
          PENDIENTE_ASC_INICIAL: ['ASC','EN_EDICION','RECHAZADA_ASC_INICIAL'],
          PENDIENTE_JEFATURA: ['Jefatura','PENDIENTE_ASC_TECNICA','OBSERVADA_JEFATURA'],
          PENDIENTE_ASC_TECNICA: ['ASC','APROBADA_TECNICA','OBSERVADA_ASC_TECNICA']
        };
        const [role,...targets] = editable.includes(row.workflow_stage) ? ['Responsable','PENDIENTE_JEFATURA'] : transitions[row.workflow_stage] || [];
        if (!targets.includes(stage) || actor !== role || !hasRole(user,role)) throw fail(403,'La transición solicitada no está disponible.');
        if (role === 'Responsable' && (!canEdit(user,row) || itemId !== row.sharepoint_item_id)) throw fail(409,'La versión cambió o la edición está cerrada. Vuelve a abrir la guía.');
        const saved = await commit(row,{workflow_stage:stage});
        await fetch(`${url()}/workflow_events`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: id, actor_role: actor, event_type: event, note: note || null }) });
        return send(res, 200, saved);
      }
    }
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (error) { return send(res, error.status || 500, { error: error.status ? error.message : 'No fue posible conectar con Supabase.' }); }
};

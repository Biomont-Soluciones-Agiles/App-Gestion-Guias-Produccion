const { session } = require('./_auth');
const url = () => `${process.env.SUPABASE_URL}/rest/v1`;
const headers = () => ({ apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const send = (res, code, body) => res.status(code).json(body);

module.exports = async (req, res) => {
  const user = session(req); if (!user) return send(res, 401, { error: 'Sesión requerida.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return send(res, 500, { error: 'Supabase no está configurado.' });
  try {
    if (req.method === 'GET') {
      const response = await fetch(`${url()}/production_requests?select=*,guide_versions(*),workflow_events(*)&order=created_at.desc`, { headers: headers() });
      return send(res, response.status, await response.json());
    }
    if (req.method === 'POST') {
      const { action, request, id, stage, actor, event, note, guideRows } = req.body || {};
      if (action === 'create') {
        const response = await fetch(`${url()}/production_requests`, { method: 'POST', headers: headers(), body: JSON.stringify(request) });
        const rows = await response.json();
        if (!response.ok) return send(res, response.status, rows);
        await fetch(`${url()}/workflow_events`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: rows[0].id, actor_role: 'Responsable', event_type: 'Solicitud creada' }) });
        return send(res, 201, rows[0]);
      }
      if (action === 'update') {
        const patch = { workflow_stage: stage, updated_at: new Date().toISOString() };
        const response = await fetch(`${url()}/production_requests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) });
        const rows = await response.json();
        if (!response.ok) return send(res, response.status, rows);
        await fetch(`${url()}/workflow_events`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: id, actor_role: actor, event_type: event, note: note || null }) });
        return send(res, 200, rows[0]);
      }
      if (action === 'save-guide') {
        const next = await fetch(`${url()}/guide_versions?request_id=eq.${encodeURIComponent(id)}&select=version_number&order=version_number.desc&limit=1`, { headers: headers() });
        const versions = await next.json(); const version = (versions[0]?.version_number || 0) + 1;
        const response = await fetch(`${url()}/guide_versions`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: id, version_number: version, spreadsheet_data: guideRows }) });
        return send(res, response.status, await response.json());
      }
    }
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (error) { return send(res, 500, { error: 'No fue posible conectar con Supabase.' }); }
};

const { session, hasRole } = require('./_auth');
const {getRequest, commit, canEdit, editable, fail} = require('../lib/request-state');
const {connectLibrary, draftPrefix} = require('../lib/sharepoint');
const {approveTechnical,approveComboTechnical} = require('../lib/technical-approval');
const {approveInitial,prepareDraft}=require('../lib/initial-approval');
const {deleteDraft}=require('../lib/draft-storage');
const {randomUUID}=require('node:crypto');
const {validateComboSelection,listComboGuides}=require('../lib/combo-guides');
const url = () => `${process.env.SUPABASE_URL}/rest/v1`;
const headers = () => ({ apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' });
const send = (res, code, body) => res.status(code).json(body);

module.exports = async (req, res) => {
  const user = session(req); if (!user) return send(res, 401, { error: 'Sesión requerida.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return send(res, 500, { error: 'Supabase no está configurado.' });
  try {
    if (req.method === 'GET') {
      if(req.query?.emitters==='1') {
        if(!hasRole(user,'ASC')) throw fail(403,'Acceso reservado a ASC.');
        const [licenses,users]=await Promise.all([
          fetch(`${url()}/guide_licenses?select=email,display_name&license_type=eq.Emisor&order=display_name.asc`,{headers:headers()}),
          fetch(`${url()}/app_users?select=email&is_active=eq.true`,{headers:headers()})
        ]);
        if(!licenses.ok || !users.ok) throw fail(502,'No se pudo consultar la lista de emisores.');
        const active=new Set((await users.json()).map(item=>String(item.email).toLowerCase()));
        return send(res,200,(await licenses.json()).filter(item=>active.has(String(item.email).toLowerCase())));
      }
      if (!['Responsable','Jefatura','ASC'].some(role => hasRole(user,role))) return send(res, 200, []);
      const response = await fetch(`${url()}/production_requests?select=*,workflow_events(*)&order=created_at.desc`, { headers: headers() });
      const rows=await response.json();
      if(!response.ok) return send(res,response.status,rows);
      const ids=rows.filter(row=>row.workflow_stage==='APROBADA_TECNICA').map(row=>String(row.id));
      const steps=new Map(),guideMap=new Map();
      for(let i=0;i<ids.length;i+=100) {
        const params=new URLSearchParams({select:'request_id,step',request_id:'in.('+ids.slice(i,i+100).join(',')+')'});
        const result=await fetch(`${url()}/guide_signature_routes?${params}`,{headers:headers()});
        if(!result.ok) throw fail(502,'No se pudo consultar el estado de las rutas de firma.');
        for(const route of await result.json()) steps.set(String(route.request_id),route.step);
      }
      const allIds=rows.map(row=>String(row.id));
      for(let i=0;i<allIds.length;i+=40) {
        const params=new URLSearchParams({select:'id,request_id,sharepoint_item_id,guide_name,product,production_line,production_phase',request_id:'in.('+allIds.slice(i,i+40).join(',')+')',order:'created_at.asc,id.asc'});
        const result=await fetch(`${url()}/production_request_guides?${params}`,{headers:headers()});
        if(!result.ok) throw fail(502,'No se pudieron consultar las guías del combo.');
        for(const guide of await result.json()) {const list=guideMap.get(String(guide.request_id)) || [];list.push(guide);guideMap.set(String(guide.request_id),list);}
      }
      return send(res,200,rows.map(row=>({...row,signature_step:steps.get(String(row.id)) || null,guides:guideMap.get(String(row.id)) || []})));
    }
    if (req.method === 'POST') {
      const { action, request, id, stage, actor, event, note, itemId } = req.body || {};
      if (action === 'create' || action === 'assign') {
        const assigning=action==='assign';
        if (assigning ? !hasRole(user,'ASC') : !hasRole(user,'Responsable')) throw fail(403,'No tienes permiso para esta operación.');
        const allowed = ['request_code','sharepoint_item_id','guide_name','product','production_line','production_phase','requester_area','request_reason','guide_type','justification'];
        const fields = Object.fromEntries(allowed.map(key => [key, request?.[key]]));
        if(assigning || (Array.isArray(req.body.guides) && req.body.guides.length>1)) {
          const input=req.body.guides;
          const ids=Array.isArray(input) && input.length===1 && /^[A-Za-z0-9_-]+$/.test(input[0]?.sharepoint_item_id || '') ? [input[0].sharepoint_item_id] : validateComboSelection(input);
          const emitter=String(req.body.emitter || '').trim().toLowerCase();
          if(assigning && !/^[^\s@]+@biomont\.com\.pe$/.test(emitter)) throw fail(400,'Selecciona un emisor válido.');
          const library=await connectLibrary();
          const root=await library.json('/drives/'+library.drive.id+'/root?$select=id');
          const guides=[];
          for(const id of ids) {
            const source=await library.json('/drives/'+library.drive.id+'/items/'+encodeURIComponent(id)+'?$select=id,name,file,parentReference&$expand=listItem($expand=fields)');
            if(!source.file || !/\.xlsx$/i.test(source.name) || source.name.startsWith(draftPrefix) || source.parentReference?.id!==root.id) throw fail(400,'Una de las guías no pertenece al catálogo de SharePoint.');
            const meta=source.listItem?.fields || {};
            guides.push({sharepoint_item_id:id,guide_name:source.name,product:meta.Producto || '',production_phase:meta.FaseProduccion || '',production_line:meta.LineaProd || meta.LineaProduccion || ''});
          }
          Object.assign(fields,guides[0]);
          const draftPaths=[];let committing=false;
          try {
            if(assigning) {
              const storageId=randomUUID();
              for(const guide of guides) {
                const version=await prepareDraft(storageId,guide,library,draftPaths);
                guide.baseline_object_path=version.baseline;guide.draft_object_path=version.draft;
              }
              if(guides.length===1) {fields.baseline_object_path=guides[0].baseline_object_path;fields.draft_object_path=guides[0].draft_object_path;}
            }
            const payload=assigning?{p_request:fields,p_guides:guides,p_emitter:emitter,p_actor:user.email}:{p_request:fields,p_guides:guides,p_email:user.email};
            committing=true;
            const created=await fetch(`${url()}/rpc/${assigning?'create_asc_assignment_prepared':'create_combo_request'}`,{method:'POST',headers:headers(),body:JSON.stringify(payload)});
            if(!created.ok) throw fail(created.status===400?409:502,assigning?'No se pudo asignar la guía. Comprueba que el emisor esté activo.':'No se pudo crear la solicitud de varias guías.');
            const id=await created.json();
            return send(res,201,await getRequest(String(id)));
          } catch(error) {
            if(!committing || error.status===409) await Promise.all(draftPaths.map(deleteDraft));
            throw error;
          }
        }
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
        const guides=await listComboGuides(String(id));
        const transitions = {
          PENDIENTE_ASC_INICIAL: ['ASC','EN_EDICION','RECHAZADA_ASC_INICIAL'],
          PENDIENTE_JEFATURA: ['Jefatura','PENDIENTE_ASC_TECNICA','OBSERVADA_JEFATURA'],
          PENDIENTE_ASC_TECNICA: ['ASC','APROBADA_TECNICA','OBSERVADA_ASC_TECNICA']
        };
        const [role,...targets] = editable.includes(row.workflow_stage) ? ['Responsable','PENDIENTE_JEFATURA'] : transitions[row.workflow_stage] || [];
        if (!targets.includes(stage) || actor !== role || !hasRole(user,role)) throw fail(403,'La transición solicitada no está disponible.');
        if (role === 'Responsable' && (!canEdit(user,row) || (!guides.length && itemId !== row.sharepoint_item_id))) throw fail(409,'La versión cambió o la edición está cerrada. Vuelve a abrir la guía.');
        if(guides.length && role==='Responsable' && guides.some(guide=>!guide.baseline_object_path || !guide.draft_object_path)) throw fail(409,'Guarda cada guía del combo antes de enviarlo a Jefatura.');
        let saved;
        if(row.workflow_stage==='PENDIENTE_ASC_INICIAL' && stage==='EN_EDICION') saved=await approveInitial(row,guides);
        else if(row.workflow_stage === 'PENDIENTE_ASC_TECNICA' && stage === 'APROBADA_TECNICA') {
          if(guides.length) {await approveComboTechnical(row,guides);saved=await getRequest(id);}
          else saved=await approveTechnical(row);
        } else saved=await commit(row,{workflow_stage:stage});
        await fetch(`${url()}/workflow_events`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id: id, actor_role: actor, event_type: event, note: note || null }) });
        return send(res, 200, saved);
      }
    }
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (error) { return send(res, error.status || 500, { error: error.status ? error.message : 'No fue posible conectar con Supabase.' }); }
};

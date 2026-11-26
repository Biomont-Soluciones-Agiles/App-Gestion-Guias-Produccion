const {session,hasRole}=require('./_auth');
const {getRequest,fail}=require('../lib/request-state');
const {readDraft,writeDraft,deleteDraft}=require('../lib/draft-storage');
const {decorateRouteWorkbook}=require('../lib/route-workbook');
const {listComboGuides,commitComboGuide}=require('../lib/combo-guides');
const {connectLibrary}=require('../lib/sharepoint');
const {prepareTemporaryPublication,publishTemporaryPlan}=require('../lib/publish-temporary');
const {temporaryGuideInfo}=require('../lib/temporary-guide-info');
const {temporaryColumns,temporaryFields}=require('../lib/temporary-metadata');
const {publishOfficialHistory}=require('../lib/publish-official-history');

const base=()=>process.env.SUPABASE_URL+'/rest/v1/';
const headers=()=>({apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'});
async function query(path,options={}) {
  const response=await fetch(base()+path,{...options,headers:{...headers(),...options.headers}});
  const body=await response.json().catch(()=>null);
  if(!response.ok) {
    console.error('Error de ruta de firmas',{status:response.status,code:body?.code,message:body?.message});
    throw fail(response.status===409 || response.status===400 ? 409 : 502,'No se pudo completar la operación de firmas. Actualiza la página y vuelve a intentarlo.');
  }
  return body;
}
const filter=(key,value)=>new URLSearchParams({[key]:'eq.'+value}).toString();
async function getRoute(id) {
  const rows=await query('guide_signature_routes?'+filter('request_id',id)+'&select=*,guide_signature_members(*)&limit=1');
  return rows[0] || null;
}
function validId(value) {return typeof value==='string' && /^[\w-]{1,100}$/.test(value);}
async function membership(user,id) {
  const route=await getRoute(id);
  if(!route) throw fail(404,'La solicitud aún no tiene una ruta de firmas.');
  if(!hasRole(user,'ASC') && !route.guide_signature_members.some(member=>member.email.toLowerCase()===user.email.toLowerCase())) throw fail(403,'No perteneces a la ruta de esta guía.');
  return route;
}
async function publish(id,route) {
  const request=await getRequest(id);
  const guides=await listComboGuides(id);
  async function markRoute(itemId) {
    const rows=await query('guide_signature_routes?'+filter('request_id',id)+'&step=eq.Lista%20para%20publicar',{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({step:'Publicada',published_item_id:itemId,completed_at:new Date().toISOString()})
    });
    if(!rows.length && (await getRoute(id))?.step!=='Publicada') throw fail(409,'No se pudo registrar la publicación. Vuelve a intentarlo.');
  }
  if(request.guide_type==='Guía temporal' && request.requires_modifications===true) {
    if(route.step==='Publicada') return;
    if(route.step!=='Lista para publicar') throw fail(409,'La ruta de firmas aún no ha terminado.');
    const sourceLibrary=await connectLibrary('standard'),temporaryLibrary=await connectLibrary('temporary');
    const columns=temporaryColumns(await temporaryLibrary.columns());
    const plan=await prepareTemporaryPublication(guides.length?guides:[request],sourceLibrary,temporaryLibrary,readDraft,(guide,bytes)=>temporaryGuideInfo(bytes,guide.guide_name));
    for(const entry of plan) entry.metadata=temporaryFields(columns,entry.guide,entry.details);
    let publishedItem;
    await publishTemporaryPlan(plan,temporaryLibrary,async (guide,item,details)=>{
      const metadata=temporaryFields(columns,guide,details);
      await temporaryLibrary.updateFields(item.id,metadata);
      if(guides.length && guide.publication_state!=='Publicada') await commitComboGuide(guide,{publication_state:'Publicada',published_at:new Date().toISOString(),published_item_id:item.id});
      publishedItem=item.id;
    });
    await markRoute(guides.length?null:publishedItem);
  } else if(route.step!=='Publicada') {
    if(request.guide_type!=='Guía oficial') throw fail(409,'La publicación de este tipo de guía aún no está definida.');
    if(route.step!=='Lista para publicar') throw fail(409,'La ruta de firmas aún no ha terminado.');
    const current=await connectLibrary(),history=await connectLibrary('history');let publishedItem;
    await publishOfficialHistory(guides.length?guides:[request],current,history,readDraft,async (guide,item)=>{
      if(guides.length && guide.publication_state!=='Publicada') await commitComboGuide(guide,{publication_state:'Publicada',published_at:new Date().toISOString(),published_item_id:item.id});
      publishedItem=item.id;
    });
    await markRoute(guides.length?null:publishedItem);
  }
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const user=session(req);
  if(!user)return res.status(401).json({error:'Inicia sesión nuevamente.'});
  try {
    if(req.method==='GET' && req.query.list==='1') {
      const rows=await query('guide_signature_members?'+filter('email',user.email.toLowerCase())+'&select=request_id,step,signed_at');
      const result=[];
      for(const member of rows) {
        const route=await getRoute(member.request_id);
        if(!route || route.step!==member.step || member.signed_at) continue;
        const request=await getRequest(member.request_id);
        const guides=await listComboGuides(member.request_id);
        result.push({requestId:member.request_id,requestCode:request.request_code,guide:request.guide_name,guides:guides.map(g=>({id:g.id,guide_name:g.guide_name})),step:member.step});
      }
      return res.json({items:result});
    }
    if(!validId(req.query.id)) throw fail(400,'Solicitud inválida.');
    const id=req.query.id;
    if(req.method==='GET' && req.query.options==='1') {
      if(!hasRole(user,'ASC')) throw fail(403,'Acceso reservado a ASC.');
      const row=await getRequest(id);
      const requester=row.workflow_events?.find(event=>event.event_type==='Solicitud creada')?.note || null;
      const licenses=await query('guide_licenses?license_type=eq.Participante&select=email,display_name,can_review,can_approve&order=display_name.asc');
      const guides=await listComboGuides(id);
      return res.json({requester,participants:licenses,route:await getRoute(id),guides:guides.map(g=>({id:g.id,guide_name:g.guide_name,publication_state:g.publication_state}))});
    }
    if(req.method==='GET') return res.json({route:await membership(user,id)});
    if(req.method==='POST' && req.body?.action==='publish') {
      if(!hasRole(user,'ASC')) throw fail(403,'Acceso reservado a ASC.');
      const route=await getRoute(id);
      if(!route) throw fail(404,'No se encontró la ruta de firmas.');
      await publish(id,route);
      return res.json({ok:true,step:'Publicada'});
    }
    if(req.method==='POST' && req.body?.action==='start') {
      if(!hasRole(user,'ASC')) throw fail(403,'Acceso reservado a ASC.');
      const {reviewers,approvers}=req.body;
      if(!Array.isArray(reviewers) || !Array.isArray(approvers) || !reviewers.length || !approvers.length ||
        reviewers.length>20 || approvers.length>20 || [...reviewers,...approvers].some(email=>typeof email!=='string' || !email.toLowerCase().endsWith('@biomont.com.pe'))) throw fail(400,'Selecciona revisores y aprobadores válidos.');
      await query('rpc/start_guide_route',{method:'POST',body:JSON.stringify({p_request_id:id,p_reviewers:reviewers,p_approvers:approvers})});
      return res.json({ok:true});
    }
    if(req.method==='POST' && req.body?.action==='sign') {
      const route=await membership(user,id),step=route.step;
      const member=route.guide_signature_members.find(m=>m.email.toLowerCase()===user.email.toLowerCase() && m.step===step && !m.signed_at);
      if(!member) throw fail(403,'No tienes una firma pendiente en esta etapa.');
      const row=await getRequest(id);
      const guides=await listComboGuides(id);
      if(!guides.length && !row.draft_object_path) throw fail(409,'La guía no tiene un borrador disponible para firmar.');
      const now=new Date().toISOString();
      if(guides.length) {
        const versions=[],created=[];
        try {
          for(const guide of guides) {
            if(!guide.draft_object_path) throw fail(409,'Falta el borrador de una guía del combo.');
            const updated=await decorateRouteWorkbook(await readDraft(guide.draft_object_path),route.guide_signature_members.map(m=>m===member?{...m,signed_at:now}:m));
            const draft=await writeDraft(row.id,'versions',updated);created.push(draft);
            versions.push({id:guide.id,updated_at:guide.updated_at,previous:guide.draft_object_path,draft});
          }
          let nextStep=await query('rpc/sign_combo_step',{method:'POST',body:JSON.stringify({p_request_id:id,p_email:user.email,p_step:step,p_versions:versions,p_signed_at:now})});
          if(nextStep==='Lista para publicar') {
            try {await publish(id,await getRoute(id));nextStep='Publicada';}
            catch(error) {return res.json({ok:true,step:nextStep,publicationError:error.status===409?error.message:'ASC debe reintentar la publicación del combo.'});}
          }
          return res.json({ok:true,step:nextStep});
        } catch(error) {if(error.status===409) await Promise.all(created.map(deleteDraft));throw error;}
      }
      const updated=await decorateRouteWorkbook(await readDraft(row.draft_object_path),route.guide_signature_members.map(m=>m===member?{...m,signed_at:now}:m));
      const nextPath=await writeDraft(row.id,'versions',updated);
      let nextStep;
      try {
        nextStep=await query('rpc/sign_guide_step',{method:'POST',body:JSON.stringify({p_request_id:id,p_email:user.email,p_step:step,p_expected_path:row.draft_object_path,p_new_path:nextPath,p_signed_at:now})});
      } catch(error) {
        if(error.status===409) await deleteDraft(nextPath);
        throw error;
      }
      if(nextStep==='Lista para publicar') {
        try {await publish(id,await getRoute(id));nextStep='Publicada';}
        catch(error) {
          console.error('Firma registrada; publicación pendiente:',error.message);
          return res.json({ok:true,step:nextStep,publicationError:error.status===409?error.message:'ASC debe reintentar la publicación en SharePoint.'});
        }
      }
      return res.json({ok:true,step:nextStep});
    }
    throw fail(405,'Método no permitido.');
  } catch(error) {return res.status(error.status || 500).json({error:error.status?error.message:'No se pudo completar la operación de firmas.'});}
};

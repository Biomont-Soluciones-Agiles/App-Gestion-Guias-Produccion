const {connectLibrary}=require('./sharepoint');
const {writeDraft,deleteDraft}=require('./draft-storage');
const {clearPreviousSignatures}=require('./clear-previous-signatures');
const {commit,getRequest,fail}=require('./request-state');

async function prepareDraft(requestId,guide,library,created) {
      if(guide.baseline_object_path || guide.draft_object_path) throw fail(409,'La guía ya tiene un borrador. Actualiza la solicitud antes de aprobar.');
      const item=await library.item(guide.sharepoint_item_id);
      if(!item.file || !/\.xlsx$/i.test(item.name) || !item.eTag) throw fail(422,'No se pudo verificar el Excel de la guía.');
      if(item.size>12*1024*1024) throw fail(413,'La guía excede el tamaño admitido.');
      const original=await library.contents(item.id);
      if((await library.item(item.id)).eTag!==item.eTag) throw fail(409,'Una guía cambió en SharePoint. Vuelve a revisar la solicitud.');
      const clean=clearPreviousSignatures(original);
      const baseline=await writeDraft(requestId,'baseline',original);created.push(baseline);
      const draft=await writeDraft(requestId,'versions',clean);created.push(draft);
      return {id:guide.id,updated_at:guide.updated_at,baseline,draft};
}
async function approveInitial(row,guides) {
  const library=await connectLibrary(),created=[],versions=[];
  try {
    for(const guide of guides.length?guides:[row]) versions.push(await prepareDraft(row.id,guide,library,created));
    if(row.guide_type==='Guía temporal' && row.requires_modifications===true) {
      const {temporaryColumns}=require('./temporary-metadata');
      temporaryColumns(await library.columns());
      const names=new Set();
      for(const guide of guides.length?guides:[row]) {
        const filename=String(guide.guide_name || '').toLocaleLowerCase('es');
        if(names.has(filename)) throw fail(409,'Hay guías con nombres repetidos en el combo.');
        names.add(filename);
        if(!guide.product || !guide.production_phase || !guide.production_line) throw fail(409,'La guía oficial debe tener producto, línea y fase registrados en SharePoint.');
      }
    }
    if(!guides.length) return await commit(row,{workflow_stage:'EN_EDICION',baseline_object_path:versions[0].baseline,draft_object_path:versions[0].draft});
    const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/prepare_combo_edit',{method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:String(row.id),p_versions:versions})});
    if(!response.ok) throw fail(response.status===400 || response.status===409?409:502,'No se pudo habilitar el combo. Actualiza y vuelve a intentarlo.');
    return await getRequest(String(row.id));
  } catch(error) {
    if(error.status===409 || error.status===422 || error.status===413) await Promise.all(created.map(deleteDraft));
    throw error;
  }
}
module.exports={approveInitial,prepareDraft};

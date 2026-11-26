const {connectLibrary}=require('./sharepoint');
const {readDraft,writeDraft,deleteDraft}=require('./draft-storage');
const {prepareGuideVersion}=require('./guide-coding');
const {commit,fail}=require('./request-state');
const {temporaryGuideInfo}=require('./temporary-guide-info');

async function approveTechnical(row) {
  const library=await connectLibrary();
  const item=await library.item(row.sharepoint_item_id);
  let current=row.draft_object_path ? await readDraft(row.draft_object_path) : await library.contents(item.id);
  let baseline;
  if(row.baseline_object_path) baseline=await readDraft(row.baseline_object_path);
  else if(item.name.startsWith('_RevisionGuia_')) {
    throw fail(409,'Esta solicitud anterior necesita una referencia original verificable para asignar la versión.');
  } else baseline=current;
  if(!row.draft_object_path && (await library.item(item.id)).eTag!==item.eTag) throw fail(409,'La guía cambió en SharePoint. Vuelve a abrir la solicitud.');
  if(row.guide_type==='Guía temporal' && row.requires_modifications===true) temporaryGuideInfo(current,row.guide_name);
  const result=prepareGuideVersion(current,row.production_phase,baseline,row.guide_type==='Guía temporal' && row.requires_modifications===true);
  let baselinePath=row.baseline_object_path;
  let draftPath;
  try {
    if(!baselinePath) baselinePath=await writeDraft(row.id,'baseline',baseline);
    draftPath=await writeDraft(row.id,'versions',result.bytes);
    return await commit(row,{workflow_stage:'APROBADA_TECNICA',baseline_object_path:baselinePath,draft_object_path:draftPath});
  } catch(error) {
    if(error.status===409) {
      if(draftPath) await deleteDraft(draftPath);
      if(!row.baseline_object_path && baselinePath) await deleteDraft(baselinePath);
    }
    throw error;
  }
}
async function approveComboTechnical(row,guides) {
  const versions=[],created=[];
  try {
    for(const guide of guides) {
      if(!guide.baseline_object_path || !guide.draft_object_path) throw fail(409,'Cada guía del combo debe guardarse antes de la revisión técnica.');
      const [baseline,current]=await Promise.all([readDraft(guide.baseline_object_path),readDraft(guide.draft_object_path)]);
      if(row.guide_type==='Guía temporal' && row.requires_modifications===true) temporaryGuideInfo(current,guide.guide_name);
      const result=prepareGuideVersion(current,guide.production_phase,baseline,row.guide_type==='Guía temporal' && row.requires_modifications===true);
      const draft=await writeDraft(row.id,'versions',result.bytes);created.push(draft);
      versions.push({id:guide.id,updated_at:guide.updated_at,baseline:guide.baseline_object_path,draft});
    }
    const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/commit_combo_versions',{
      method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_request_id:String(row.id),p_expected_stage:row.workflow_stage,p_next_stage:'APROBADA_TECNICA',p_versions:versions})
    });
    if(!response.ok) throw fail(response.status===400 || response.status===409?409:502,'No se pudo aprobar el combo. Comprueba que ninguna guía haya cambiado.');
  } catch(error) {
    if(error.status===409) await Promise.all(created.map(deleteDraft));
    throw error;
  }
}
module.exports={approveTechnical,approveComboTechnical};

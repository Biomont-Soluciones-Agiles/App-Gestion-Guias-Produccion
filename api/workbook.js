const crypto = require('node:crypto');
const {session,hasRole} = require('./_auth');
const {connectLibrary} = require('../lib/sharepoint');
const {getRequest, canEdit, commit, fail} = require('../lib/request-state');
const {readDraft,writeDraft,deleteDraft} = require('../lib/draft-storage');
const {hasSignatureAccess} = require('../lib/signature-access');
const {openWorkbook} = require('../lib/workbook');
const {recalculate} = require('../lib/recalculate');
const {decorateRouteWorkbook} = require('../lib/route-workbook');
const {listComboGuides}=require('../lib/combo-guides');

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store');
  const user=session(req);
  if (!user) return res.status(401).json({error:'Inicia sesión nuevamente.'});

  try {
    if (!['GET','POST'].includes(req.method)) throw fail(405,'Método no permitido.');
    const permitted=['Responsable','Jefatura','ASC'].some(role => hasRole(user,role));
    if(!permitted && (req.method!=='GET' || req.query.edit==='1' || req.query.compare==='1' || !(await hasSignatureAccess(user.email,req.query.id)))) throw fail(403,'No tienes acceso a esta guía.');
    const parent=await getRequest(req.query.id);
    const guides=await listComboGuides(String(parent.id));
    const selected=guides.length ? guides.find(guide=>guide.id===req.query.guideId) : null;
    if(guides.length && !selected) throw fail(400,'Selecciona una guía del combo.');
    const row=selected?{...parent,...selected,id:parent.id,workflow_stage:parent.workflow_stage,workflow_events:parent.workflow_events}:parent;
    if (!row.sharepoint_item_id) throw fail(404,'La solicitud carece de archivo de SharePoint.');
    const comparing=req.query.compare==='1';
    if (comparing && !hasRole(user,'Jefatura')) throw fail(403,'Acceso reservado a Jefatura.');
    const editing=req.method==='POST' || req.query.edit==='1';
    if (editing && !canEdit(user,row)) throw fail(403,'La edición está cerrada para esta solicitud o este usuario.');
    const library=await connectLibrary();
    const item=await library.item(row.sharepoint_item_id);
    if (!item.file || !/\.xlsx$/i.test(item.name)) throw fail(422,'Se requiere un libro XLSX.');
    let webUrl=item.webUrl;
    const uniqueId=item.sharepointIds?.listItemUniqueId;
    if (uniqueId && /^[0-9a-f-]{36}$/i.test(uniqueId)) {
      const viewer=new URL(library.site.webUrl.replace(/\/$/,'')+'/_layouts/15/Doc.aspx');
      viewer.searchParams.set('sourcedoc','{'+uniqueId+'}');
      webUrl=viewer.toString();
    }
    if (comparing) {
      const match=/^_RevisionGuia_([A-Za-z0-9-]+)_[0-9a-f-]{36}\.xlsx$/i.exec(item.name);
      let previous;
      if (row.baseline_object_path) previous=null;
      else if (match) previous=await library.item(match[1]);
      else {
        if (!row.guide_name || /[\\/]/.test(row.guide_name)) throw fail(404,'No se encontró una guía de referencia para esta solicitud.');
        try {
          previous=await library.json('/drives/'+library.drive.id+'/root:/'+encodeURIComponent(row.guide_name)+'?$select=id,name,file');
        } catch {
          throw fail(404,'No se encontró la guía original en el catálogo de SharePoint.');
        }
        if (!previous.file) throw fail(404,'No se encontró la guía original en el catálogo de SharePoint.');
      }
      const [beforeBytes,afterBytes]=await Promise.all([
        row.baseline_object_path ? readDraft(row.baseline_object_path) : library.contents(previous.id),
        row.draft_object_path ? readDraft(row.draft_object_path) : library.contents(item.id)
      ]);
      const before=openWorkbook(beforeBytes),after=openWorkbook(afterBytes);
      const name=req.query.sheet || after.sheets[0];
      if (!before.sheets.includes(name) || !after.sheets.includes(name)) throw fail(422,'La hoja no está disponible en ambas versiones.');
      return res.json({referenceIsCurrentCatalog:!row.baseline_object_path && !match,sheets:after.sheets.filter(n=>before.sheets.includes(n)),before:before.inspect(name),after:after.inspect(name)});
    }
    if (!editing && !row.draft_object_path) return res.json({webUrl});
    if (!editing && row.draft_object_path) {
      let bytes=await readDraft(row.draft_object_path);
      if(row.workflow_stage==='APROBADA_TECNICA') {
        const params=new URLSearchParams({request_id:'eq.'+row.id,select:'step,guide_signature_members(*)',limit:'1'});
        const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/guide_signature_routes?'+params,{headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY}});
        if(!response.ok) throw fail(502,'No se pudo consultar el estado de las firmas.');
        const [route]=await response.json();
        if(route && route.step!=='Publicada') bytes=await decorateRouteWorkbook(bytes,route.guide_signature_members);
      }
      const saved=openWorkbook(bytes);
      return res.json({sheets:saved.sheets,sheet:saved.inspect(req.query.sheet || saved.sheets[0])});
    }
    if (item.size > 12 * 1024 * 1024) throw fail(413,'El libro excede el límite de edición de 12 MB.');
    const bytes=row.draft_object_path ? await readDraft(row.draft_object_path) : await library.contents(item.id);
    const revision=crypto.createHash('sha256').update(item.id).update(bytes).digest('hex');
    const book=openWorkbook(bytes);
    if (!book.sheets.length) throw fail(422,'El libro carece de hojas visibles compatibles.');
    if (req.method==='GET') {
      const sheet=book.inspect(req.query.sheet || book.sheets[0]);
      if (Buffer.byteLength(JSON.stringify(sheet))>3500000) throw fail(413,'La hoja excede el tamaño de edición admitido.');
      return res.json({revision,itemId:item.id,webUrl,sheets:book.sheets,sheet});
    }
    if (req.body?.revision!==revision) throw fail(409,'La guía cambió. Vuelve a abrirla antes de guardar.');
    const output=selected && Array.isArray(req.body?.changes) && req.body.changes.length===0 ? bytes : recalculate(book.apply(req.body.changes));
    if (!row.draft_object_path) {
      const latest=await library.item(item.id);
      if (latest.eTag!==item.eTag) throw fail(409,'El Excel cambió en SharePoint. Vuelve a abrirlo.');
    }
    const baselinePath=row.baseline_object_path || await writeDraft(row.id,'baseline',bytes);
    let draftPath;
    try {
      draftPath=await writeDraft(row.id,'versions',output);
      if(selected) {
        const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/save_combo_guide',{method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:String(parent.id),p_guide_id:selected.id,p_expected_updated_at:selected.updated_at,p_baseline:baselinePath,p_draft:draftPath})});
        if(!response.ok) throw fail(response.status===400 || response.status===409?409:502,'No se pudo guardar la guía. Vuelve a abrir el combo.');
      } else await commit(row,{baseline_object_path:baselinePath,draft_object_path:draftPath});
    } catch(error) {
      if(error.status===409) {
        if(draftPath) await deleteDraft(draftPath);
        if(!row.baseline_object_path) await deleteDraft(baselinePath);
      }
      throw error;
    }
    return res.json({itemId:item.id,revision:crypto.createHash('sha256').update(item.id).update(output).digest('hex')});
  } catch(error) {return res.status(error.status || 502).json({error:error.status ? error.message : 'No se pudo procesar el Excel en SharePoint.'});}
};

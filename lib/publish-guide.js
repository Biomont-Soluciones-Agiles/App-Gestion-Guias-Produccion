const {createHash}=require('node:crypto');
const {connectLibrary,draftPrefix}=require('./sharepoint');
const {readDraft}=require('./draft-storage');
const {fail}=require('./request-state');
const digest=b=>createHash('sha256').update(b).digest('hex');

// Se publica únicamente la versión firmada y solo si la referencia sigue intacta.
async function publishGuide(row,route,markPublished,dependencies={}) {
  if(route.step==='Publicada') return;
  if(route.step!=='Lista para publicar') throw fail(409,'La ruta de firmas aún no ha terminado.');
  if(!row.draft_object_path || !row.baseline_object_path || !row.sharepoint_item_id)
    throw fail(409,'Falta la versión de referencia necesaria para publicar esta guía.');
  const library=await (dependencies.connectLibrary || connectLibrary)();
  const read=dependencies.readDraft || readDraft;
  const item=await library.item(row.sharepoint_item_id);
  if(item.name.startsWith(draftPrefix)) throw fail(409,'La solicitud no identifica el archivo original de SharePoint.');
  const [original,baseline,final]=await Promise.all([library.contents(item.id),read(row.baseline_object_path),read(row.draft_object_path)]);
  if(digest(original)!==digest(final)) {
    if(digest(original)!==digest(baseline)) throw fail(409,'La guía original cambió en SharePoint durante la revisión. ASC debe revisar el conflicto antes de publicarla.');
    if(!item.eTag) throw fail(409,'No se puede verificar la versión del archivo en SharePoint.');
    try {await library.replace(item.id,final,item.eTag);} catch(error) {
      if(error.status===412) throw fail(409,'La guía original cambió en SharePoint. Revisa el conflicto antes de publicarla.');
      throw error;
    }
  }
  await markPublished(item.id);
}
module.exports={publishGuide};

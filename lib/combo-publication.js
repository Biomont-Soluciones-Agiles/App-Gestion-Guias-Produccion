const {createHash}=require('node:crypto');
const {fail}=require('./request-state');

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Comprueba todos los originales antes de publicar cualquiera. El registro de
// cada publicación permite reanudar después de un fallo sin repetir los envíos.
async function prepareComboPublication(guides,library,readDraft) {
  if(!Array.isArray(guides) || !guides.length) throw fail(409,'El combo no contiene guías.');
  const seen=new Set(),prepared=[];
  for(const guide of guides) {
    if(!guide.sharepoint_item_id || seen.has(guide.sharepoint_item_id)) throw fail(409,'El combo contiene archivos duplicados o inválidos.');
    seen.add(guide.sharepoint_item_id);
    if(!guide.baseline_object_path || !guide.draft_object_path) throw fail(409,'Una guía no tiene versiones completas para publicar.');
    const item=await library.item(guide.sharepoint_item_id);
    if(!item.file || !item.eTag || !/\.xlsx$/i.test(item.name)) throw fail(409,'No se puede verificar uno de los archivos originales.');
    const [original,baseline,final]=await Promise.all([library.contents(item.id),readDraft(guide.baseline_object_path),readDraft(guide.draft_object_path)]);
    const alreadyPublished=hash(original)===hash(final);
    if(!alreadyPublished && hash(original)!==hash(baseline)) throw fail(409,`La guía ${item.name} cambió en SharePoint; revisa el conflicto antes de publicar el combo.`);
    prepared.push({guide,item,final,alreadyPublished});
  }
  return prepared;
}

async function publishPreparedCombo(prepared,library,markPublished) {
  for(const entry of prepared) {
    if(!entry.alreadyPublished) {
      try {await library.replace(entry.item.id,entry.final,entry.item.eTag);}
      catch(error) {if(error.status===412) throw fail(409,`La guía ${entry.item.name} cambió durante la publicación del combo.`);throw error;}
    }
    await markPublished(entry.guide,entry.item);
  }
}
module.exports={prepareComboPublication,publishPreparedCombo};

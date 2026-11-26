const {createHash}=require('node:crypto');
const {fail}=require('./request-state');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

// El original de referencia se consulta solo para verificar que no haya cambiado.
// Los nuevos archivos se crean en la biblioteca temporal sin reemplazar otros.
async function prepareTemporaryPublication(guides,sourceLibrary,temporaryLibrary,readDraft,nameFor) {
  if(!guides.length) throw fail(409,'No hay guías para publicar.');
  const names=new Set(),plan=[];
  for(const guide of guides) {
    if(!guide.baseline_object_path || !guide.draft_object_path) throw fail(409,'Falta el borrador de una guía temporal.');
    const source=await sourceLibrary.item(guide.sharepoint_item_id);
    if(!source.file) throw fail(409,'No se encontró la guía de referencia.');
    const [original,baseline,draft]=await Promise.all([sourceLibrary.contents(source.id),readDraft(guide.baseline_object_path),readDraft(guide.draft_object_path)]);
    if(digest(original)!==digest(baseline)) throw fail(409,`La guía de referencia ${source.name} cambió durante el proceso.`);
    const details=nameFor(guide,draft);
    const name=details.name;
    if(names.has(name.toLocaleLowerCase('es'))) throw fail(409,'Dos guías temporales tendrían el mismo nombre.');
    names.add(name.toLocaleLowerCase('es'));
    const existing=await temporaryLibrary.findByName(name);
    if(existing && (!existing.file || digest(await temporaryLibrary.contents(existing.id))!==digest(draft))) throw fail(409,`Ya existe otra guía temporal llamada ${name}.`);
    plan.push({guide,name,draft,existing,details});
  }
  return plan;
}
async function publishTemporaryPlan(plan,library,markPublished) {
  for(const entry of plan) {
    let item=entry.existing;
    if(!item) {
      try {item=await library.createNew(entry.name,entry.draft);}
      catch(error) {if(error.status===409 || error.status===412) throw fail(409,`La guía temporal ${entry.name} ya existe.`);throw error;}
    }
    await markPublished(entry.guide,item,entry.details);
  }
}
module.exports={prepareTemporaryPublication,publishTemporaryPlan};

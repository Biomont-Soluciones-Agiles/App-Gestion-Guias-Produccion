const {createHash}=require('node:crypto');
const {openWorkbook}=require('./workbook');
const {fail}=require('./request-state');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function publishOfficialHistory(guides,current,history,readDraft,markPublished) {
  const columns=await history.columns();
  const state=columns.find(column=>[column.name,column.displayName].some(value=>String(value || '').toLowerCase()==='estado'));
  if(!state) throw fail(409,'La biblioteca de historial necesita la columna Estado.');
  if(state.choice && !state.choice.choices?.includes('Inactivo')) throw fail(409,'La columna Estado del historial necesita la opción Inactivo.');
  const prepared=[];
  for(const guide of guides) {
    if(!guide.baseline_object_path || !guide.draft_object_path) throw fail(409,'Falta la versión anterior de una guía.');
    const item=await current.item(guide.sharepoint_item_id);
    const [original,baseline,final]=await Promise.all([current.contents(item.id),readDraft(guide.baseline_object_path),readDraft(guide.draft_object_path)]);
    if(hash(original)!==hash(final) && hash(original)!==hash(baseline)) throw fail(409,`La guía ${item.name} cambió en SharePoint.`);
    if(!item.eTag) throw fail(409,'No se pudo verificar la versión de SharePoint.');
    const workbook=openWorkbook(baseline),sheet=workbook.inspect(workbook.sheets[0]);
    const value=String(sheet.cells.find(cell=>cell.address==='J3')?.value || '').trim();
    if(!/^\d{1,2}$/.test(value)) throw fail(409,`No se pudo verificar la versión anterior de ${item.name}.`);
    const version=value.padStart(2,'0');
    const archiveName=item.name.replace(/\.xlsx$/i,'')+' - v'+version+'.xlsx';
    const existing=await history.findByName(archiveName);
    if(existing && (!existing.file || hash(await history.contents(existing.id))!==hash(baseline))) throw fail(409,`El historial ya contiene otro archivo llamado ${archiveName}.`);
    prepared.push({guide,item,baseline,final,archiveName,existing,alreadyPublished:hash(original)===hash(final)});
  }
  const activeColumns=await current.columns();
  const find=label=>activeColumns.find(column=>[column.name,column.displayName].some(value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===label));
  const activeState=find('estado'),activeKind=find('tipoguia'),activeVersion=find('version');
  if(!activeState || !activeKind || !activeVersion) throw fail(409,'Faltan las columnas Estado, TipoGuia o Versión en la biblioteca de producción.');
  for(const entry of prepared) {
    const archived=entry.existing || await history.createNew(entry.archiveName,entry.baseline);
    await history.updateFields(archived.id,{[state.name]:'Inactivo'});
  }
  for(const entry of prepared) {
    if(!entry.alreadyPublished) await current.replace(entry.item.id,entry.final,entry.item.eTag);
    const book=openWorkbook(entry.final),sheet=book.inspect(book.sheets[0]);
    const version=String(sheet.cells.find(cell=>cell.address==='J3')?.value || '').trim();
    if(!/^\d{1,2}$/.test(version)) throw fail(409,'La nueva versión no se puede verificar.');
    await current.updateFields(entry.item.id,{[activeState.name]:'Activo',[activeKind.name]:'Oficial',[activeVersion.name]:activeVersion.number?Number(version):version.padStart(2,'0')});
    await markPublished(entry.guide,entry.item);
  }
}
module.exports={publishOfficialHistory};

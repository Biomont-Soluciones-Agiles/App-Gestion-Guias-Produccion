const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {publishOfficialHistory}=require('../lib/publish-official-history');
function workbook(version){const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([]);XLSX.utils.sheet_add_aoa(sheet,[[version]],{origin:'J3'});XLSX.utils.book_append_sheet(book,sheet,'Guía');return XLSX.write(book,{type:'buffer',bookType:'xlsx'});}
test('archiva la versión anterior como inactiva antes de reemplazar la oficial',async()=>{
  const old=workbook('01'),latest=workbook('02'),calls=[];
  const current={columns:async()=>['Estado','TipoGuia','Version'].map(name=>({name})),item:async()=>({id:'oficial',name:'Guía.xlsx',eTag:'tag'}),contents:async()=>old,replace:async()=>calls.push('reemplazo'),updateFields:async()=>calls.push('metadatos')};
  const history={columns:async()=>[{name:'Estado',choice:{choices:['Activo','Inactivo']}}],findByName:async()=>null,createNew:async(name)=>{calls.push(name);return {id:'historial'};},updateFields:async(id,fields)=>{assert.equal(fields.Estado,'Inactivo');calls.push('archivo inactivo');}};
  await publishOfficialHistory([{sharepoint_item_id:'oficial',baseline_object_path:'base',draft_object_path:'nueva'}],current,history,async path=>path==='base'?old:latest,async()=>calls.push('finalizada'));
  assert.deepEqual(calls,['Guía - v01.xlsx','archivo inactivo','reemplazo','metadatos','finalizada']);
});

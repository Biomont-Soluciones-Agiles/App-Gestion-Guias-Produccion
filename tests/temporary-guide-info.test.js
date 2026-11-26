const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {temporaryGuideInfo}=require('../lib/temporary-guide-info');
function guide(batch,unit='kg') {
  const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(sheet,[['Tamaño de Lote:',null,batch,unit]],{origin:'E4'});
  XLSX.utils.book_append_sheet(book,sheet,'Guía');return XLSX.write(book,{type:'buffer',bookType:'xlsx'});
}
test('lee el lote editado y diferencia archivos temporales',()=>{
  assert.deepEqual(temporaryGuideInfo(guide('500'),'Proteggo F.xlsx'),{batch:'500',unit:'kg',name:'Proteggo F - Temporal - 500 kg.xlsx'});
  assert.notEqual(temporaryGuideInfo(guide('500'),'Proteggo F.xlsx').name,temporaryGuideInfo(guide('600'),'Proteggo F.xlsx').name);
});
test('impide publicar con el lote pendiente',()=>{
  assert.throws(()=>temporaryGuideInfo(guide('xx'),'Proteggo F.xlsx'),/tamaño de lote válido/);
});

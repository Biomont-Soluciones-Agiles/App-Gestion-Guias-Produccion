const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {stampSignature}=require('../lib/signature-stamp');
const {openWorkbook}=require('../lib/workbook');

test('coloca firmas en la guía y conserva todas las personas sin duplicar la imagen',async()=>{
  const book=XLSX.utils.book_new();
  const rows=Array.from({length:9},()=>Array(11).fill(''));
  rows[5][1]='Elaborado por:';rows[5][5]='Revisado por:';rows[5][7]='Aprobado por:';
  rows[6][1]='Anterior';rows[6][5]='Anterior';rows[6][7]='Anterior';
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(book,sheet,'Guía');
  const source=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const signers=[{display_name:'Ana Prueba',signed_at:'2026-11-25T18:00:00Z'},{display_name:'José Prueba',signed_at:'2026-11-25T19:00:00Z'}];
  const first=await stampSignature(source,'Revision',[signers[0]]);
  const second=await stampSignature(first,'Revision',signers);
  const view=openWorkbook(second).inspect('Guía');
  assert.equal(view.cells.find(c=>c.address==='F7').value,'Ana Prueba / José Prueba');
  assert.equal(view.images.filter(image=>image.name==='BiomontFirma_Revision').length,1);
});
test('rechaza una guía sin los recuadros esperados',async()=>{
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Guía']]),'Hoja');
  await assert.rejects(stampSignature(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),'Elaborador',[{display_name:'Ana',signed_at:'2026-11-25T18:00:00Z'}]),/áreas de firma/);
});

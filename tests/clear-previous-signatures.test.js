const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {stampSignature}=require('../lib/signature-stamp');
const {clearPreviousSignatures}=require('../lib/clear-previous-signatures');
const {openWorkbook}=require('../lib/workbook');

test('retira las firmas de la plantilla sin alterar el original ni imágenes fuera del recuadro',async()=>{
  const workbook=XLSX.utils.book_new(),rows=Array.from({length:9},()=>Array(11).fill(''));
  rows[5][1]='Elaborado por:';rows[5][5]='Revisado por:';rows[5][7]='Aprobado por:';
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(rows),'Guía');
  const person=[{display_name:'Ana',signed_at:'2026-11-25T18:00:00Z'}];
  let source=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  source=await stampSignature(source,'Elaborador',person);
  // Una imagen fuera del área de firmas debe permanecer intacta.
  let book=openWorkbook(source),logo=book.inspect('Guía').images[0];
  source=book.apply([{sheet:'Guía',type:'image',id:logo.id,action:'move',from:{col:1,row:2,x:0,y:0},to:{col:4,row:3,x:0,y:0}}]);
  source=await stampSignature(source,'Revision',person);
  source=await stampSignature(source,'Aprobacion',person);
  const original=openWorkbook(source).inspect('Guía');
  const cleaned=openWorkbook(clearPreviousSignatures(source)).inspect('Guía');
  assert.equal(original.images.length,3);
  assert.equal(cleaned.images.length,1);
  assert.equal(cleaned.images[0].from.row,2);
  assert.equal(openWorkbook(source).inspect('Guía').images.length,3);
});

test('mantiene imágenes cuando la hoja no tiene el formato de firmas esperado',async()=>{
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Otra hoja']]),'Otra');
  const source=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  assert.deepEqual(clearPreviousSignatures(source),source);
});

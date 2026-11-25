const test=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const {openWorkbook}=require('../lib/workbook');
const {recalculate}=require('../lib/recalculate');

test('conserva errores de fórmula y calcula al corregir el valor de origen',()=>{
  const workbook=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([['xx',0.005,null,'referencia']]);
  sheet.C1={t:'e',v:15,f:'A1*B1'};
  XLSX.utils.book_append_sheet(workbook,sheet,'Guía');
  const source=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  const book=openWorkbook(source);
  const text=recalculate(book.apply([{sheet:'Guía',address:'D1',value:'cambio',type:'text'}]));
  assert.equal(openWorkbook(text).inspect('Guía').cells.find(c=>c.address==='C1').value,'#VALUE!');
  const number=recalculate(book.apply([{sheet:'Guía',address:'A1',value:'100',type:'number'}]));
  assert.equal(Number(openWorkbook(number).inspect('Guía').cells.find(c=>c.address==='C1').value),0.5);
});

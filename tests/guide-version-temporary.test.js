const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {prepareGuideVersion}=require('../lib/guide-coding');
const {openWorkbook}=require('../lib/workbook');

test('la guía temporal nueva comienza en versión 01',t=>{
  const filename='C:/Users/molin/Downloads/GUIA DE REFERENCIA.xlsx';
  if(!fs.existsSync(filename)) return t.skip('Guía de referencia no disponible');
  const source=fs.readFileSync(filename),result=prepareGuideVersion(source,'Fabricación',source,true);
  assert.equal(result.version,'01');
  const book=openWorkbook(result.bytes),sheet=book.inspect(book.sheets[0]);
  assert.equal(sheet.cells.find(cell=>cell.address==='J3').value,'01');
});

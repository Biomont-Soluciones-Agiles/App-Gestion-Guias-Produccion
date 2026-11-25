const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {prepareGuideVersion}=require('../lib/guide-coding');
const {openWorkbook}=require('../lib/workbook');
const reference='C:/Users/molin/Downloads/GUIA DE REFERENCIA.xlsx';
test('actualiza código y versión de la guía de referencia', {skip:!fs.existsSync(reference)}, ()=>{
  const source=fs.readFileSync(reference);
  for(const [phase,code] of [['Fabricación','GF-02-123'],['Envasado','GE-02-456'],['Acondicionado','GA-02-789']]) {
    const result=prepareGuideVersion(source,phase);
    assert.equal(result.code,code);
    const book=openWorkbook(result.bytes), sheet=book.inspect(book.sheets[0]);
    assert.equal(sheet.cells.find(c=>c.address==='J2').value,code);
    assert.equal(sheet.cells.find(c=>c.address==='J3').value,'02');
  }
});
test('rechaza una fase no identificada',()=>{
  assert.throws(()=>prepareGuideVersion(Buffer.alloc(0),'desconocida'),/fase/);
});

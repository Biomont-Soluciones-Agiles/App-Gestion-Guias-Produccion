const test=require('node:test');
const assert=require('node:assert/strict');
const {fieldValue}=require('../lib/sharepoint-fields');
test('identifica las columnas de tamaño de lote por nombre interno de SharePoint',()=>{
  assert.equal(fieldValue({Tama_x00f1_o_x0020_de_x0020_lote:500},['Tamaño de lote']),500);
  assert.equal(fieldValue({TamanoLote:600},['Tamaño de lote','TamanoLote']),600);
  assert.equal(fieldValue({},['Tamaño de lote']),null);
});

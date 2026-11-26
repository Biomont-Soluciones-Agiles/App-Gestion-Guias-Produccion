const test=require('node:test');
const assert=require('node:assert/strict');
const {listComboGuides,commitComboGuide,validateComboSelection}=require('../lib/combo-guides');

test('valida que el combo tenga guías distintas y válidas',()=>{
  assert.deepEqual(validateComboSelection([{sharepoint_item_id:'abc'},{sharepoint_item_id:'def'}]),['abc','def']);
  assert.throws(()=>validateComboSelection([{sharepoint_item_id:'abc'},{sharepoint_item_id:'abc'}]),/misma guía/);
  assert.throws(()=>validateComboSelection([{sharepoint_item_id:'abc'}]),/entre 2 y 20/);
  assert.throws(()=>validateComboSelection([{sharepoint_item_id:'abc'},{sharepoint_item_id:'../x'}]),/inválida/);
});

test('impide consultar un identificador de solicitud inválido',async()=>{
  await assert.rejects(listComboGuides('invalido&otra=solicitud'),/Solicitud inválida/);
});

test('detecta si otra operación modificó la guía antes de guardar',async()=>{
  const original=global.fetch;
  global.fetch=async()=>new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  try {
    await assert.rejects(commitComboGuide({id:'guia',request_id:'solicitud',updated_at:'2026-11-26T00:00:00Z'},{draft_object_path:'nuevo'}),/cambió/);
  } finally {global.fetch=original;}
});

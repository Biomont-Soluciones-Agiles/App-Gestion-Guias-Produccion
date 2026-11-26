const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareComboPublication,publishPreparedCombo}=require('../lib/combo-publication');
function setup() {
  const values={a:'old-a',b:'old-b',baseA:'old-a',baseB:'old-b',draftA:'new-a',draftB:'new-b'};
  const guides=['a','b'].map((id,i)=>({id,sharepoint_item_id:id,baseline_object_path:i?'baseB':'baseA',draft_object_path:i?'draftB':'draftA'}));
  const writes=[],library={item:async id=>({id,name:id+'.xlsx',eTag:'etag',file:{}}),contents:async id=>Buffer.from(values[id]),replace:async(id,bytes)=>{writes.push(id);values[id]=bytes.toString();}};
  return {values,guides,writes,library,read:async key=>Buffer.from(values[key])};
}
test('comprueba todas las guías antes de modificar SharePoint',async()=>{
  const s=setup();s.values.b='un cambio externo';
  await assert.rejects(prepareComboPublication(s.guides,s.library,s.read),/cambió/);
  assert.deepEqual(s.writes,[]);
});
test('reanuda una publicación parcial sin sobrescribir de nuevo el archivo publicado',async()=>{
  const s=setup(),marked=[];s.values.a='new-a';
  const plan=await prepareComboPublication(s.guides,s.library,s.read);
  await publishPreparedCombo(plan,s.library,async guide=>marked.push(guide.id));
  assert.deepEqual(s.writes,['b']);assert.deepEqual(marked,['a','b']);
});

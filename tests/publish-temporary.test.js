const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareTemporaryPublication,publishTemporaryPlan}=require('../lib/publish-temporary');

function setup() {
  const stored={base:'original',draft:'editado'};let created=0,sourceWrites=0;
  const source={item:async()=>({id:'official',name:'Oficial.xlsx',file:{}}),contents:async()=>Buffer.from('original'),replace:async()=>{sourceWrites++;}};
  const temporary={findByName:async()=>null,contents:async()=>Buffer.from('editado'),createNew:async name=>{created++;return {id:'temporal',name};}};
  return {source,temporary,read:async key=>Buffer.from(stored[key]),get created(){return created;},get sourceWrites(){return sourceWrites;}};
}
const guide={guide_name:'Oficial.xlsx',sharepoint_item_id:'official',baseline_object_path:'base',draft_object_path:'draft'};
test('publica un archivo nuevo y no modifica la guía oficial',async()=>{
  const s=setup(),plan=await prepareTemporaryPublication([guide],s.source,s.temporary,s.read,()=>({name:'Oficial - Temporal - 500.xlsx',batch:'500'}));let id;
  await publishTemporaryPlan(plan,s.temporary,async(_guide,item)=>{id=item.id;});
  assert.equal(s.created,1);assert.equal(s.sourceWrites,0);assert.equal(id,'temporal');
});
test('rechaza una temporal previa con el mismo nombre y contenido diferente',async()=>{
  const s=setup();s.temporary.findByName=async()=>({id:'existing',file:{}});s.temporary.contents=async()=>Buffer.from('otro archivo');
  await assert.rejects(prepareTemporaryPublication([guide],s.source,s.temporary,s.read,()=>({name:'Oficial - Temporal - 500.xlsx'})),/Ya existe/);
  assert.equal(s.created,0);assert.equal(s.sourceWrites,0);
});
test('puede reanudar una publicación cuyo archivo ya se creó',async()=>{
  const s=setup();s.temporary.findByName=async()=>({id:'existing',file:{}});
  const plan=await prepareTemporaryPublication([guide],s.source,s.temporary,s.read,()=>({name:'Oficial - Temporal - 500.xlsx'}));
  await publishTemporaryPlan(plan,s.temporary,async()=>{});assert.equal(s.created,0);
});

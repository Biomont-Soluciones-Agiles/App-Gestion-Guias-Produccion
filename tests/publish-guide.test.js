const test=require('node:test');
const assert=require('node:assert/strict');
const {publishGuide}=require('../lib/publish-guide');

function scenario(content='anterior') {
  const calls=[];
  const library={item:async()=>({id:'original',name:'Guía.xlsx',eTag:'etag'}),contents:async()=>Buffer.from(content),replace:async(...args)=>calls.push(args)};
  const deps={connectLibrary:async()=>library,readDraft:async path=>Buffer.from(path==='base'?'anterior':'firmado')};
  return {calls,deps,row:{sharepoint_item_id:'original',baseline_object_path:'base',draft_object_path:'final'},route:{step:'Lista para publicar'}};
}
test('publica la versión firmada solo al culminar la ruta',async()=>{
 const s=scenario();let marked='';await publishGuide(s.row,s.route,async id=>{marked=id;},s.deps);
 assert.equal(s.calls.length,1);assert.equal(s.calls[0][1].toString(),'firmado');assert.equal(s.calls[0][2],'etag');assert.equal(marked,'original');
});
test('no sobrescribe una guía modificada externamente',async()=>{
 const s=scenario('otra versión');await assert.rejects(publishGuide(s.row,s.route,async()=>{},s.deps),/cambió/);assert.equal(s.calls.length,0);
});
test('puede reintentar el registro sin volver a sobrescribir',async()=>{
 const s=scenario('firmado');let marked=false;await publishGuide(s.row,s.route,async()=>{marked=true;},s.deps);assert.equal(s.calls.length,0);assert.ok(marked);
});
test('no publica antes de terminar las firmas',async()=>{
 const s=scenario();await assert.rejects(publishGuide(s.row,{step:'Revision'},async()=>{},s.deps),/no ha terminado/);assert.equal(s.calls.length,0);
});

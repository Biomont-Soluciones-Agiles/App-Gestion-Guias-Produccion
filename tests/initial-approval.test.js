const test=require('node:test');
const assert=require('node:assert/strict');

test('ASC prepara todos los borradores del combo y conserva las referencias originales',async()=>{
  const names=['../lib/sharepoint','../lib/draft-storage','../lib/clear-previous-signatures','../lib/request-state'];
  const backups=new Map(names.map(name=>[require.resolve(name),require.cache[require.resolve(name)]]));
  const set=(name,exports)=>{const filename=require.resolve(name);require.cache[filename]={id:filename,filename,loaded:true,exports};};
  const path=require.resolve('../lib/initial-approval'),saved=require.cache[path],previousFetch=global.fetch;
  let serial=0,payload;const stored=[];
  set('../lib/sharepoint',{connectLibrary:async()=>({item:async id=>({id,name:id+'.xlsx',file:{},eTag:'e1',size:10}),contents:async id=>Buffer.from('original-'+id)})});
  set('../lib/draft-storage',{writeDraft:async(id,kind,bytes)=>{stored.push([kind,bytes.toString()]);return `path-${++serial}`;},deleteDraft:async()=>{}});
  set('../lib/clear-previous-signatures',{clearPreviousSignatures:bytes=>Buffer.from('limpio-'+bytes.toString())});
  set('../lib/request-state',{commit:async()=>{},getRequest:async()=>({workflow_stage:'EN_EDICION'}),fail:(status,message)=>Object.assign(Error(message),{status})});
  global.fetch=async(url,options)=>{payload=JSON.parse(options.body);return new Response(null,{status:204});};
  delete require.cache[path];
  try {
    const {approveInitial}=require('../lib/initial-approval');
    const result=await approveInitial({id:'combo'},[{id:'a',sharepoint_item_id:'A',updated_at:'t1'},{id:'b',sharepoint_item_id:'B',updated_at:'t2'}]);
    assert.equal(result.workflow_stage,'EN_EDICION');
    assert.deepEqual(stored,[['baseline','original-A'],['versions','limpio-original-A'],['baseline','original-B'],['versions','limpio-original-B']]);
    assert.deepEqual(payload.p_versions.map(item=>item.id),['a','b']);
  } finally {
    for(const [key,value] of backups) {if(value)require.cache[key]=value;else delete require.cache[key];}
    if(saved)require.cache[path]=saved;else delete require.cache[path];global.fetch=previousFetch;
  }
});

test('si una guía cambia durante la preparación no habilita el combo y elimina los borradores creados',async()=>{
  const names=['../lib/sharepoint','../lib/draft-storage','../lib/clear-previous-signatures','../lib/request-state'];
  const backups=new Map(names.map(name=>[require.resolve(name),require.cache[require.resolve(name)]]));
  const set=(name,exports)=>{const filename=require.resolve(name);require.cache[filename]={id:filename,filename,loaded:true,exports};};
  const path=require.resolve('../lib/initial-approval'),saved=require.cache[path];let calls=0;const deleted=[];
  set('../lib/sharepoint',{connectLibrary:async()=>({item:async id=>({id,name:id+'.xlsx',file:{},eTag:id==='B' && ++calls===2?'cambio':'original',size:10}),contents:async id=>Buffer.from(id)})});
  set('../lib/draft-storage',{writeDraft:async(id,kind)=>kind,deleteDraft:async path=>deleted.push(path)});
  set('../lib/clear-previous-signatures',{clearPreviousSignatures:bytes=>bytes});
  set('../lib/request-state',{commit:async()=>{throw Error('No debería habilitarse');},getRequest:async()=>{},fail:(status,message)=>Object.assign(Error(message),{status})});
  delete require.cache[path];
  try {const {approveInitial}=require('../lib/initial-approval');await assert.rejects(approveInitial({id:'combo'},[{id:'a',sharepoint_item_id:'A'},{id:'b',sharepoint_item_id:'B'}]),/cambió en SharePoint/);assert.deepEqual(deleted.sort(),['baseline','versions']);}
  finally {for(const [key,value] of backups){if(value)require.cache[key]=value;else delete require.cache[key];}if(saved)require.cache[path]=saved;else delete require.cache[path];}
});

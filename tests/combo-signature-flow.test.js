const test=require('node:test');
const assert=require('node:assert/strict');

test('una firma actualiza las dos guías y avanza una sola ruta',async()=>{
  const modules=['../api/_auth','../lib/request-state','../lib/draft-storage','../lib/route-workbook','../lib/combo-guides'];
  const backups=new Map(modules.map(name=>[require.resolve(name),require.cache[require.resolve(name)]]));
  const set=(name,exports)=>{const filename=require.resolve(name);require.cache[filename]={id:filename,filename,loaded:true,exports};};
  const path=require.resolve('../api/signatures'),savedApi=require.cache[path],savedFetch=global.fetch;
  const oldUrl=process.env.SUPABASE_URL,oldSecret=process.env.SUPABASE_SECRET_KEY;
  const member={email:'persona@biomont.com.pe',step:'Elaborador',display_name:'Persona',signed_at:null};
  const guides=[{id:'a',draft_object_path:'old-a',updated_at:'2026-11-26T00:00:00Z'},{id:'b',draft_object_path:'old-b',updated_at:'2026-11-26T00:00:00Z'}];
  let serial=0,body;
  set('../api/_auth',{session:()=>({email:member.email}),hasRole:()=>false});
  set('../lib/request-state',{getRequest:async()=>({id:'combo'}),fail:(status,message)=>Object.assign(Error(message),{status})});
  set('../lib/draft-storage',{readDraft:async path=>Buffer.from(path),writeDraft:async()=>`new-${++serial}`,deleteDraft:async()=>{}});
  set('../lib/route-workbook',{decorateRouteWorkbook:async bytes=>bytes});
  set('../lib/combo-guides',{listComboGuides:async()=>guides,commitComboGuide:async()=>{}});
  process.env.SUPABASE_URL='https://supabase.invalid';process.env.SUPABASE_SECRET_KEY='test';
  global.fetch=async(url,options)=>{
    if(String(url).includes('guide_signature_routes?')) return new Response(JSON.stringify([{step:'Elaborador',guide_signature_members:[member]}]),{status:200});
    if(String(url).includes('rpc/sign_combo_step')) {body=JSON.parse(options.body);return new Response(JSON.stringify('Revision'),{status:200});}
    throw Error('Petición inesperada: '+url);
  };
  delete require.cache[path];
  const handler=require('../api/signatures');let status=200,result;
  const response={setHeader(){},status(code){status=code;return this;},json(value){result=value;return this;}};
  try {
    await handler({method:'POST',query:{id:'combo'},body:{action:'sign'}},response);
    assert.equal(status,200);assert.equal(result.step,'Revision');
    assert.deepEqual(body.p_versions.map(v=>[v.id,v.previous,v.draft]),[['a','old-a','new-1'],['b','old-b','new-2']]);
    assert.equal(body.p_email,member.email);
  } finally {
    for(const [key,value] of backups) {if(value)require.cache[key]=value;else delete require.cache[key];}
    if(savedApi)require.cache[path]=savedApi;else delete require.cache[path];
    global.fetch=savedFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldSecret===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=oldSecret;
  }
});

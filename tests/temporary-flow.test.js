const test=require('node:test');
const assert=require('node:assert/strict');

async function run(stage,requiresModifications) {
  const keys=['../api/_auth','../lib/request-state','../lib/combo-guides','../lib/sharepoint','../lib/guide-catalog-folder'];
  const saved=new Map(keys.map(key=>[require.resolve(key),require.cache[require.resolve(key)]]));
  const set=(name,exports)=>{const filename=require.resolve(name);require.cache[filename]={id:filename,filename,loaded:true,exports};};
  const handlerPath=require.resolve('../api/requests'),previousHandler=require.cache[handlerPath],previousFetch=global.fetch;
  const row={id:'req1',sharepoint_item_id:'archivo',workflow_stage:'PENDIENTE_ASC_INICIAL',guide_type:'Guía temporal',requires_modifications:requiresModifications};let patch;
  set('../api/_auth',{session:()=>({role:'ASC',email:'asc@biomont.com.pe'}),hasRole:(user,role)=>user.role===role});
  set('../lib/request-state',{getRequest:async()=>row,commit:async(_row,value)=>{patch=value;return {...row,...value};},canEdit:()=>false,editable:[],fail:(status,message)=>Object.assign(Error(message),{status})});
  set('../lib/combo-guides',{listComboGuides:async()=>[],validateComboSelection:()=>[]});
  set('../lib/sharepoint',{connectLibrary:async()=>({drive:{id:'drive'},json:async()=>({file:{},parentReference:{id:'root'},listItem:{fields:{Estado:'Activo',TipoGuia:'Temporal'}}})})});
  set('../lib/guide-catalog-folder',{catalogFolder:async()=>({id:'root'})});
  process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test';
  global.fetch=async()=>new Response(null,{status:201});
  delete require.cache[handlerPath];const handler=require('../api/requests');
  let status=200,body;const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  try {await handler({method:'POST',body:{action:'update',id:'req1',actor:'ASC',stage,event:'aprobada'}},res);return {status,body,patch};}
  finally {for(const [key,value] of saved){if(value)require.cache[key]=value;else delete require.cache[key];}if(previousHandler)require.cache[handlerPath]=previousHandler;else delete require.cache[handlerPath];global.fetch=previousFetch;}
}
test('una temporal sin modificaciones se comparte sin pasar a edición',async()=>{
  const response=await run('TEMPORAL_COMPARTIDA',false);
  assert.equal(response.status,200);assert.equal(response.patch.workflow_stage,'TEMPORAL_COMPARTIDA');
});
test('no se puede habilitar edición por una petición manipulada para una temporal sin cambios',async()=>{
  const response=await run('EN_EDICION',false);
  assert.equal(response.status,409);assert.equal(response.patch,undefined);
});
test('una temporal que requiere cambios no puede marcarse como compartida',async()=>{
  const response=await run('TEMPORAL_COMPARTIDA',true);
  assert.equal(response.status,409);assert.equal(response.patch,undefined);
});
test('tipos pendientes de definición no crean una solicitud',async()=>{
  process.env.AUTH_SESSION_SECRET='test';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test';
  const {encode}=require('../api/_auth'),handler=require('../api/requests');let status=200,body;
  const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  await handler({method:'POST',headers:{cookie:'gp_session='+encode({role:'Responsable',email:'a@biomont.com.pe',exp:Date.now()+60000})},body:{action:'create',request:{guide_type:'Producto nuevo'}}},res);
  assert.equal(status,409);assert.match(body.error,/pendiente de definición/);
});

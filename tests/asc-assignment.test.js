const test=require('node:test');
const assert=require('node:assert/strict');
process.env.AUTH_SESSION_SECRET='test-secret';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SECRET_KEY='test';
const {encode}=require('../api/_auth');
const handler=require('../api/requests');
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
const cookie=role=>'gp_session='+encode({role,email:'usuario@biomont.com.pe',exp:Date.now()+60000});
test('un responsable no puede asignar guías directamente',async()=>{
  const res=response();await handler({method:'POST',query:{},body:{action:'assign'},headers:{cookie:cookie('Responsable')}},res);
  assert.equal(res.statusCode,403);
});
test('ASC solo recibe emisores activos',async()=>{
  const previous=global.fetch;
  global.fetch=async url=>String(url).includes('guide_licenses') ? Response.json([{email:'activa@biomont.com.pe',display_name:'Activa'},{email:'inactiva@biomont.com.pe',display_name:'Inactiva'}]) : Response.json([{email:'activa@biomont.com.pe'}]);
  try {const res=response();await handler({method:'GET',query:{emitters:'1'},headers:{cookie:cookie('ASC')}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body.map(person=>person.email),['activa@biomont.com.pe']);}
  finally {global.fetch=previous;}
});
test('la asignación registra al emisor y a la persona de ASC',async()=>{
  const previous=global.fetch,sharepoint=require('../lib/sharepoint'),original=sharepoint.connectLibrary,initial=require('../lib/initial-approval'),originalPrepare=initial.prepareDraft;
  let submitted;
  sharepoint.connectLibrary=async()=>({drive:{id:'biblioteca'},json:async path=>path.includes('/root?')?{id:'raiz'}:{id:'archivo',name:'Guía.xlsx',file:{},parentReference:{id:'raiz'},listItem:{fields:{Producto:'Producto',FaseProduccion:'Fabricación'}}}});
  initial.prepareDraft=async()=>({baseline:'base-privada',draft:'borrador-limpio'});
  const handlerPath=require.resolve('../api/requests');delete require.cache[handlerPath];const assignmentHandler=require('../api/requests');
  global.fetch=async(url,options)=>{
    if(String(url).includes('/rpc/create_asc_assignment_prepared')) {submitted=JSON.parse(options.body);return Response.json('solicitud');}
    if(String(url).includes('/production_requests?')) return Response.json([{id:'solicitud',workflow_events:[]}]);
    throw Error('Petición inesperada');
  };
  try {
    const res=response();await assignmentHandler({method:'POST',query:{},headers:{cookie:cookie('ASC')},body:{action:'assign',emitter:'ana@biomont.com.pe',guides:[{sharepoint_item_id:'archivo'}],request:{request_code:'REQ-1'}}},res);
    assert.equal(res.statusCode,201);assert.equal(submitted.p_emitter,'ana@biomont.com.pe');assert.equal(submitted.p_actor,'usuario@biomont.com.pe');assert.equal(submitted.p_guides[0].guide_name,'Guía.xlsx');assert.equal(submitted.p_request.draft_object_path,'borrador-limpio');assert.equal(submitted.p_guides[0].baseline_object_path,'base-privada');
  } finally {global.fetch=previous;sharepoint.connectLibrary=original;initial.prepareDraft=originalPrepare;delete require.cache[handlerPath];}
});

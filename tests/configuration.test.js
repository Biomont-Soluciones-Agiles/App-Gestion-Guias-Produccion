const test=require('node:test');
const assert=require('node:assert/strict');
process.env.AUTH_SESSION_SECRET='local-test-secret';
process.env.SUPABASE_URL='https://db.invalid';
process.env.SUPABASE_SECRET_KEY='test';
const {encode}=require('../api/_auth');
const {encrypt,decrypt}=require('../lib/graph-token');
const handler=require('../api/configuration');

function call(user,query={}) {
  const req={method:'GET',query,headers:{cookie:'gp_session='+encode({...user,exp:Date.now()+60000})+'; gp_graph='+encrypt('test-token')}};
  const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  return handler(req,res).then(()=>res);
}
test('el token del directorio se cifra y detecta alteraciones',()=>{
  const encrypted=encrypt('sample-token');
  assert.equal(decrypt(encrypted),'sample-token');
  const bytes=Buffer.from(encrypted,'base64url');
  bytes[bytes.length-1]^=1;
  assert.equal(decrypt(bytes.toString('base64url')),null);
});
test('la configuración requiere rol ASC o administrador',async()=>{
  const response=await call({role:'Responsable',email:'r@biomont.com.pe'},{directory:'1',search:'ana'});
  assert.equal(response.statusCode,403);
});
test('ASC puede buscar perfiles del directorio con permiso delegado',async()=>{
  const previous=global.fetch;
  global.fetch=async(url,options)=>{
    assert.match(String(url),/graph\.microsoft\.com/);
    assert.equal(options.headers.Authorization,'Bearer test-token');
    return Response.json({value:[{id:'1',displayName:'Ana',mail:'ana@biomont.com.pe'},{id:'2',mail:'externo@otro.com'}]});
  };
  try {
    const response=await call({role:'ASC',email:'asc@biomont.com.pe'},{directory:'1',search:'ana'});
    assert.equal(response.statusCode,200);
    assert.deepEqual(response.body.users.map(person=>person.id),['1']);
  } finally {global.fetch=previous;}
});
test('ASC puede configurar pasos para un participante registrado',async()=>{
  const previous=global.fetch;
  global.fetch=async(url,options)=>{
    assert.match(String(url),/guide_licenses/);
    assert.equal(options.method,'PATCH');
    const body=JSON.parse(options.body);
    assert.equal(body.can_review,true);
    assert.equal(body.can_approve,false);
    return Response.json([{email:'ana@biomont.com.pe'}]);
  };
  try {
    const req={method:'POST',query:{},body:{action:'flow',email:'ana@biomont.com.pe',review:true,approve:false},headers:{cookie:'gp_session='+encode({role:'ASC',email:'asc@biomont.com.pe',exp:Date.now()+60000})}};
    const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await handler(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.ok,true);
  } finally {global.fetch=previous;}
});
test('participante sin otro rol no puede consultar el catálogo completo',async()=>{
  const sharepoint=require('../api/sharepoint');
  const req={method:'GET',query:{},headers:{cookie:'gp_session='+encode({role:'Participante',roles:['Participante'],email:'p@biomont.com.pe',exp:Date.now()+60000})}};
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await sharepoint(req,res);
  assert.equal(res.statusCode,403);
});

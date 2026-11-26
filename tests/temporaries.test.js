const test=require('node:test');
const assert=require('node:assert/strict');
process.env.AUTH_SESSION_SECRET='test';
const {encode}=require('../api/_auth');
const handler=require('../api/temporaries');
function req(role,body){return {method:'POST',body,headers:{cookie:'gp_session='+encode({role,email:'persona@biomont.com.pe',exp:Date.now()+60000})}};}
function res(){return {statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('solo ASC puede administrar el estado de una guía temporal',async()=>{
  const response=res();await handler(req('Responsable',{id:'archivo',status:'Inactivo'}),response);assert.equal(response.statusCode,403);
});
test('rechaza estados y referencias inválidos antes de consultar SharePoint',async()=>{
  const response=res();await handler(req('ASC',{id:'../archivo',status:'Inactivo'}),response);assert.equal(response.statusCode,400);
});

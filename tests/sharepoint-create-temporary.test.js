const test=require('node:test');
const assert=require('node:assert/strict');
const {connectLibrary}=require('../lib/sharepoint');

test('crea un archivo temporal sin habilitar el reemplazo de otros',async()=>{
  const before={...process.env},previous=global.fetch,calls=[];
  Object.assign(process.env,{MICROSOFT_TENANT_ID:'tenant',MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'test',SHAREPOINT_SITE_URL:'https://biomont.sharepoint.com/sites/Documentacinaplicaciones',SHAREPOINT_LIBRARY_NAME:'Guías de producción'});
  global.fetch=async(url,options={})=>{
    calls.push([String(url),options]);
    if(String(url).includes('login.microsoftonline.com')) return Response.json({access_token:'test'});
    if(String(url).includes('/createUploadSession')) return Response.json({uploadUrl:'https://upload.example/session'});
    if(String(url).startsWith('https://upload.example/')) return Response.json({id:'new-item'});
    if(String(url).includes('/drives?'))return Response.json({value:[{id:'temp-drive',name:'Guías de producción',webUrl:'https://biomont.sharepoint.com/sites/Documentacinaplicaciones/Guias%20de%20produccion%20temporales'}]});
    return Response.json({id:'site'});
  };
  try {
    const library=await connectLibrary('temporary'),result=await library.createNew('Guía - Temporal - 500 kg.xlsx',Buffer.from('excel'));
    assert.equal(result.id,'new-item');
    const session=calls.find(([url])=>url.includes('/createUploadSession'));
    assert.equal(JSON.parse(session[1].body).item['@microsoft.graph.conflictBehavior'],'fail');
    const upload=calls.find(([url])=>url.startsWith('https://upload.example/'));
    assert.equal(upload[1].headers.Authorization,undefined);assert.equal(upload[1].headers['Content-Range'],'bytes 0-4/5');
  } finally {global.fetch=previous;for(const key of ['MICROSOFT_TENANT_ID','MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','SHAREPOINT_SITE_URL','SHAREPOINT_LIBRARY_NAME']) {if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});

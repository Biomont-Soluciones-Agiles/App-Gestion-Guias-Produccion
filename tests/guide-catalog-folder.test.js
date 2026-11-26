const test=require('node:test');
const assert=require('node:assert/strict');
const {catalogFolder}=require('../lib/guide-catalog-folder');
const {connectLibrary}=require('../lib/sharepoint');

test('resuelve la raíz de la biblioteca temporal seleccionada',async()=>{
  let path='';const library={drive:{id:'drive'},json:async value=>{path=value;return {id:'folder',folder:{}};}};
  const folder=await catalogFolder(library,'temporary');assert.equal(folder.id,'folder');assert.equal(path,'/drives/drive/root?$select=id');
});
test('usa la misma biblioteca para oficiales y temporales',async()=>{
  const previous=global.fetch,env={...process.env};
  process.env.MICROSOFT_TENANT_ID='tenant';process.env.MICROSOFT_CLIENT_ID='client';process.env.MICROSOFT_CLIENT_SECRET='test';
  process.env.SHAREPOINT_SITE_URL='https://biomont.sharepoint.com/sites/Documentacinaplicaciones';process.env.SHAREPOINT_LIBRARY_NAME='Guías de producción';delete process.env.SHAREPOINT_TEMPORARY_LIBRARY_PATH;
  global.fetch=async url=>{
    if(String(url).includes('login.microsoftonline.com'))return Response.json({access_token:'test'});
    if(String(url).includes('/drives?'))return Response.json({value:[{id:'principal',name:'Guías de producción',webUrl:'https://biomont.sharepoint.com/sites/Documentacinaplicaciones/Guias%20de%20produccin'},{id:'temporal',name:'Temporales',webUrl:'https://biomont.sharepoint.com/sites/Documentacinaplicaciones/Guias%20de%20produccion%20temporales'}]});
    return Response.json({id:'site',displayName:'Sitio'});
  };
  try {assert.equal((await connectLibrary()).drive.id,'principal');assert.equal((await connectLibrary('temporary')).drive.id,'principal');}
  finally {global.fetch=previous;for(const key of ['MICROSOFT_TENANT_ID','MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','SHAREPOINT_SITE_URL','SHAREPOINT_LIBRARY_NAME','SHAREPOINT_TEMPORARY_LIBRARY_PATH']) {if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
test('rechaza catálogos desconocidos',async()=>{
  await assert.rejects(catalogFolder({drive:{id:'drive'}},'otra'),/inválido/);
});

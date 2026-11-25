const crypto = require('node:crypto');
const {fail} = require('./request-state');

const bucket = 'guias-borradores';
function endpoint(path, authenticated = false) {
  return process.env.SUPABASE_URL + '/storage/v1/object/' + (authenticated ? 'authenticated/' : '') + bucket + '/' +
    path.split('/').map(encodeURIComponent).join('/');
}
function headers() {
  return {apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY};
}
async function readDraft(path) {
  const response=await fetch(endpoint(path, true),{headers:headers()});
  if(!response.ok) throw fail(502,'No se pudo leer la guía guardada en Supabase.');
  return Buffer.from(await response.arrayBuffer());
}
async function writeDraft(requestId,kind,bytes) {
  const path=requestId+'/'+kind+'/'+crypto.randomUUID()+'.xlsx';
  const response=await fetch(endpoint(path),{method:'POST',headers:{...headers(),'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','x-upsert':'false'},body:bytes});
  if(!response.ok) throw fail(502,'No se pudo guardar la guía en Supabase.');
  return path;
}
async function deleteDraft(path) {
  const response=await fetch(endpoint(path),{method:'DELETE',headers:headers()});
  if(!response.ok) console.error('No se pudo borrar el borrador no utilizado',response.status);
}
module.exports={readDraft,writeDraft,deleteDraft};

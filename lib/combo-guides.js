const {fail}=require('./request-state');

const base=()=>process.env.SUPABASE_URL+'/rest/v1/production_request_guides';
const headers=()=>({apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',Prefer:'return=representation'});
function validateComboSelection(guides) {
  if(!Array.isArray(guides) || guides.length<2 || guides.length>20) throw fail(400,'Selecciona entre 2 y 20 guías para el combo.');
  const ids=guides.map(item=>item?.sharepoint_item_id);
  if(ids.some(id=>typeof id!=='string' || !/^[A-Za-z0-9_-]+$/.test(id))) throw fail(400,'El combo contiene una guía inválida.');
  if(new Set(ids).size!==ids.length) throw fail(400,'No puedes agregar la misma guía dos veces.');
  return ids;
}
async function listComboGuides(requestId) {
  if(typeof requestId!=='string' || !/^[\w-]{1,100}$/.test(requestId)) throw fail(400,'Solicitud inválida.');
  const params=new URLSearchParams({request_id:'eq.'+requestId,select:'*',order:'created_at.asc,id.asc'});
  const response=await fetch(base()+'?'+params,{headers:headers()});
  if(!response.ok) throw fail(502,'No se pudieron consultar las guías de la solicitud.');
  return response.json();
}
async function commitComboGuide(guide,patch) {
  const params=new URLSearchParams({id:'eq.'+guide.id,request_id:'eq.'+guide.request_id,updated_at:'eq.'+guide.updated_at});
  const response=await fetch(base()+'?'+params,{method:'PATCH',headers:headers(),body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
  if(!response.ok) throw fail(502,'No se pudo guardar la guía del combo.');
  const [result]=await response.json();
  if(!result) throw fail(409,'La guía cambió. Vuelve a abrir el combo.');
  return result;
}
module.exports={listComboGuides,commitComboGuide,validateComboSelection};

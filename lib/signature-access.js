const {fail}=require('./request-state');
async function hasSignatureAccess(email,requestId) {
  const params=new URLSearchParams({request_id:'eq.'+requestId,email:'eq.'+email.toLowerCase(),select:'request_id',limit:'1'});
  const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/guide_signature_members?'+params,{headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY}});
  if(!response.ok) throw fail(502,'No se pudieron comprobar los permisos de la guía.');
  return (await response.json()).length>0;
}
module.exports={hasSignatureAccess};

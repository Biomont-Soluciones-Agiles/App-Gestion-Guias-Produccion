const {session,parse,hasRole}=require('./_auth');
const {decrypt}=require('../lib/graph-token');

function dbHeaders() {
  return {apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'};
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const user=session(req);
  if(!user) return res.status(401).json({error:'Inicia sesión nuevamente.'});
  if(!hasRole(user,'ASC')) return res.status(403).json({error:'Acceso reservado a ASC.'});
  try {
    if(req.method==='GET' && req.query.directory==='1') {
      const token=decrypt(parse(req).gp_graph || '');
      if(!token) return res.status(401).json({error:'Vuelve a iniciar sesión para consultar el directorio.'});
      const search=String(req.query.search || '').trim();
      if(search.length<2) return res.status(200).json({users:[]});
      const escaped=search.replace(/'/g,"''");
      const params=new URLSearchParams({'$select':'id,displayName,mail,userPrincipalName','$top':'25','$count':'true','$filter':"startswith(displayName,'"+escaped+"') or startswith(mail,'"+escaped+"') or startswith(userPrincipalName,'"+escaped+"')"});
      const response=await fetch('https://graph.microsoft.com/v1.0/users?'+params,{headers:{Authorization:'Bearer '+token,ConsistencyLevel:'eventual'}});
      if(!response.ok) return res.status(response.status===401?401:502).json({error:'No se pudo consultar el directorio. Vuelve a iniciar sesión y verifica el permiso concedido.'});
      const body=await response.json();
      const users=(body.value || []).filter(x=>(x.mail || x.userPrincipalName || '').toLowerCase().endsWith('@biomont.com.pe'));
      return res.json({users});
    }
    if(req.method==='GET') {
      const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/guide_licenses?select=*&order=display_name.asc',{headers:dbHeaders()});
      if(!response.ok) throw Error('db');
      return res.json(await response.json());
    }
    if(req.method==='POST' && req.body?.action==='flow') {
      const email=String(req.body.email || '').toLowerCase();
      if(!email.endsWith('@biomont.com.pe') || email.length>254 || typeof req.body.review!=='boolean' || typeof req.body.approve!=='boolean') return res.status(400).json({error:'Datos de flujo inválidos.'});
      const params=new URLSearchParams({email:'eq.'+email,license_type:'eq.Participante'});
      const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/guide_licenses?'+params,{method:'PATCH',headers:{...dbHeaders(),Prefer:'return=representation'},body:JSON.stringify({can_review:req.body.review,can_approve:req.body.approve,updated_at:new Date().toISOString()})});
      if(!response.ok) throw Error('db');
      const updated=await response.json();
      if(!updated.length) return res.status(409).json({error:'La persona ya no tiene licencia de participante.'});
      return res.json({ok:true});
    }
    if(req.method==='POST') {
      const {userId,license,review,approve}=req.body || {};
      if(!/^[0-9a-f-]{36}$/i.test(userId || '') || !['Emisor','Participante'].includes(license)) return res.status(400).json({error:'Selecciona un usuario y una licencia válidos.'});
      const token=decrypt(parse(req).gp_graph || '');
      if(!token) return res.status(401).json({error:'Vuelve a iniciar sesión para consultar el directorio.'});
      const graph=await fetch('https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(userId)+'?$select=displayName,mail,userPrincipalName',{headers:{Authorization:'Bearer '+token}});
      if(!graph.ok) return res.status(502).json({error:'No se pudo verificar al usuario en Microsoft.'});
      const person=await graph.json(),email=(person.mail || person.userPrincipalName || '').toLowerCase();
      if(!email.endsWith('@biomont.com.pe')) return res.status(400).json({error:'Selecciona una cuenta de Biomont.'});
      const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/set_guide_license',{method:'POST',headers:dbHeaders(),body:JSON.stringify({p_email:email,p_name:person.displayName || email,p_license:license,p_review:license==='Participante' && !!review,p_approve:license==='Participante' && !!approve})});
      if(!response.ok) throw Error('db');
      return res.json({ok:true});
    }
    return res.status(405).json({error:'Método no permitido.'});
  } catch {return res.status(502).json({error:'No se pudo guardar o consultar la configuración.'});}
};
